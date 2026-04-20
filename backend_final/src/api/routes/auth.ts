import { Elysia } from 'elysia';
import { getCollection } from '@adapters/mongo/connection.js';
import { config } from '@config';
import { hashPassword, verifyPassword } from '@adapters/mongo/password.js';
import { generateAccessToken, generateRefreshToken } from '@adapters/mongo/token.js';
import { getCurrentUser } from '../middleware/auth.js';
import type { ApiResponse, AuthUser, TokenResponse } from '@core/types.js';

const router = new Elysia({ prefix: '/auth' });

// Helper to create API response
function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, msg: 'ok', data };
}

function error(code: number, msg: string): ApiResponse<null> {
  return { code, msg, data: null };
}

// GET /auth/check-default-password
router.get('/check-default-password', async () => {
  const username = config.bootstrapAdminUsername;
  const defaultPwd = config.bootstrapAdminPassword;

  const userDoc = await getCollection('users').findOne({ username });
  if (!userDoc) {
    return ok({ is_default: false });
  }

  const storedHash = userDoc.password_hash;
  if (!storedHash) {
    return ok({ is_default: false });
  }

  const isDefault = await verifyPassword(defaultPwd, storedHash);
  return ok({
    is_default: isDefault,
    username: isDefault ? username : null,
    password: isDefault ? defaultPwd : null,
  });
});

// POST /auth/login
router.post('/login', async ({ body }) => {
  const { username, password } = body as { username: string; password: string };

  const userDoc = await getCollection('users').findOne({ username });
  if (!userDoc) {
    return error(401, 'Invalid username or password');
  }

  const storedHash = userDoc.password_hash;
  const valid = await verifyPassword(password, storedHash);
  if (!valid) {
    return error(401, 'Invalid username or password');
  }

  if (!userDoc.is_active) {
    return error(403, 'User is deactivated');
  }

  // Create session tokens
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + config.sessionMaxAge;
  const refreshExpiresAt = now + config.sessionMaxAge * 4;

  await getCollection('user_sessions').insertOne({
    _id: accessToken as any,
    user_id: String(userDoc._id),
    username: userDoc.username,
    role: userDoc.role || 'user',
    created_at: now,
    expires_at: expiresAt,
    refresh_token: refreshToken,
    refresh_expires_at: refreshExpiresAt,
  });

  const user: AuthUser = {
    id: String(userDoc._id),
    username: userDoc.username,
    fullname: userDoc.fullname || userDoc.username,
    email: userDoc.email || '',
    role: userDoc.role || 'user',
    is_active: userDoc.is_active ?? true,
    created_at: userDoc.created_at ? new Date(userDoc.created_at * 1000).toISOString() : '',
    updated_at: userDoc.updated_at ? new Date(userDoc.updated_at * 1000).toISOString() : '',
    last_login_at: new Date().toISOString(),
  };

  const response: ApiResponse<TokenResponse> = ok({
    user,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
  });

  // Set cookie
  response.data; // ensure we have data

  return response;
});

// POST /auth/register
router.post('/register', async ({ body }) => {
  const { username, fullname, email, password } = body as {
    username?: string;
    fullname: string;
    email: string;
    password: string;
  };

  // Generate username if not provided
  const finalUsername = username || `user_${Date.now()}`;

  // Check if username exists
  const existing = await getCollection('users').findOne({ username: finalUsername });
  if (existing) {
    return error(400, 'Username already exists');
  }

  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  const result = await getCollection('users').insertOne({
    username: finalUsername,
    fullname,
    email,
    password_hash: passwordHash,
    role: 'user',
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  const user: AuthUser = {
    id: String(result.insertedId),
    username: finalUsername,
    fullname,
    email,
    role: 'user',
    is_active: true,
    created_at: new Date(now * 1000).toISOString(),
    updated_at: new Date(now * 1000).toISOString(),
  };

  return ok(user);
});

// GET /auth/status
router.get('/status', async ({ request }) => {
  const user = await getCurrentUser(request);
  return ok({
    authenticated: !!user,
    auth_provider: 'local',
    user: user ? {
      id: user.id,
      username: user.username,
      fullname: '',
      email: '',
      role: user.role,
      is_active: true,
      created_at: '',
      updated_at: '',
    } : null,
  });
});

// GET /auth/me
router.get('/me', async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) {
    return error(401, 'Not authenticated');
  }

  const userDoc = await getCollection('users').findOne({ _id: user.id as any });
  if (!userDoc) {
    return error(404, 'User not found');
  }

  const authUser: AuthUser = {
    id: String(userDoc._id),
    username: userDoc.username,
    fullname: userDoc.fullname || userDoc.username,
    email: userDoc.email || '',
    role: userDoc.role || 'user',
    is_active: userDoc.is_active ?? true,
    created_at: userDoc.created_at ? new Date(userDoc.created_at * 1000).toISOString() : '',
    updated_at: userDoc.updated_at ? new Date(userDoc.updated_at * 1000).toISOString() : '',
    last_login_at: userDoc.last_login_at,
  };

  return ok(authUser);
});

// POST /auth/refresh
router.post('/refresh', async ({ body }) => {
  const { refresh_token } = body as { refresh_token: string };

  const session = await getCollection('user_sessions').findOne({ refresh_token });
  if (!session) {
    return error(401, 'Invalid refresh token');
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.refresh_expires_at < now) {
    await getCollection('user_sessions').deleteOne({ _id: session._id });
    return error(401, 'Refresh token expired');
  }

  // Delete old session
  await getCollection('user_sessions').deleteOne({ _id: session._id });

  // Create new tokens
  const newAccessToken = generateAccessToken();
  const newRefreshToken = generateRefreshToken();
  const expiresAt = now + config.sessionMaxAge;
  const refreshExpiresAt = now + config.sessionMaxAge * 4;

  await getCollection('user_sessions').insertOne({
    _id: newAccessToken as any,
    user_id: session.user_id,
    username: session.username,
    role: session.role,
    created_at: now,
    expires_at: expiresAt,
    refresh_token: newRefreshToken,
    refresh_expires_at: refreshExpiresAt,
  });

  return ok({
    access_token: newAccessToken,
    token_type: 'Bearer',
  });
});

// POST /auth/change-password
router.post('/change-password', async ({ request, body }) => {
  const user = await getCurrentUser(request);
  if (!user) {
    return error(401, 'Not authenticated');
  }

  const { old_password, new_password } = body as { old_password: string; new_password: string };

  const userDoc = await getCollection('users').findOne({ _id: user.id as any });
  if (!userDoc) {
    return error(404, 'User not found');
  }

  const valid = await verifyPassword(old_password, userDoc.password_hash);
  if (!valid) {
    return error(400, 'Invalid old password');
  }

  const newHash = await hashPassword(new_password);
  await getCollection('users').updateOne(
    { _id: user.id as any },
    { $set: { password_hash: newHash, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// POST /auth/change-fullname
router.post('/change-fullname', async ({ request, body }) => {
  const user = await getCurrentUser(request);
  if (!user) {
    return error(401, 'Not authenticated');
  }

  const { fullname } = body as { fullname: string };

  await getCollection('users').updateOne(
    { _id: user.id as any },
    { $set: { fullname, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// POST /auth/logout
router.post('/logout', async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    await getCollection('user_sessions').deleteOne({ _id: token as any });
  }

  return ok(null);
});

export default router;
