import { Elysia } from 'elysia';
import type { Context } from 'elysia';
import { getCollection } from '../db/mongodb';
import { config } from '../config';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  // Try Authorization header first, then cookie
  let sessionId: string | undefined;

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    sessionId = authHeader.slice(7).trim();
  }

  if (!sessionId) {
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(new RegExp(`${config.sessionCookie}=([^;]+)`));
    sessionId = match?.[1];
  }

  if (!sessionId) return null;

  const session = await getCollection('user_sessions').findOne({ _id: sessionId as any });
  if (!session) return null;

  // Check expiration
  if (session.expires_at < Math.floor(Date.now() / 1000)) {
    await getCollection('user_sessions').deleteOne({ _id: sessionId as any });
    return null;
  }

  return {
    id: session.user_id,
    username: session.username,
    role: session.role || 'user',
  };
}

// Elysia plugin for auth
export const authPlugin = new Elysia()
  .derive(async ({ request }) => {
    const user = await getCurrentUser(request);
    return { user };
  });

// Helper to require authentication
export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
