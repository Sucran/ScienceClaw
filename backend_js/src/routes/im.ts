import { Elysia } from 'elysia';
import { getCollection } from '../db/mongodb';
import { getCurrentUser } from '../middleware/auth';
import type { ApiResponse } from '../types';

const router = new Elysia({ prefix: '/im' });

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, msg: 'ok', data };
}

function error(code: number, msg: string): ApiResponse<null> {
  return { code, msg, data: null };
}

async function requireAuth(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

async function requireAdmin(request: Request) {
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new Error('Admin required');
  }
  return user;
}

// POST /im/bind/lark - Bind Lark user
router.post('/bind/lark', async ({ request }) => {
  const user = await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { code?: string };
  const { code } = body;

  // Lark binding would go here
  return ok(null);
});

// DELETE /im/bind/lark - Unbind Lark user
router.delete('/bind/lark', async ({ request }) => {
  const user = await requireAuth(request);

  await getCollection('im_user_bindings').deleteOne({
    platform: 'lark',
    science_user_id: user.id,
  });

  return ok(null);
});

// GET /im/bind/lark/status - Get Lark binding status
router.get('/bind/lark/status', async ({ request }) => {
  const user = await requireAuth(request);

  const binding = await getCollection('im_user_bindings').findOne({
    platform: 'lark',
    science_user_id: user.id,
  });

  return ok({
    bound: !!binding,
    platform_user_id: binding?.platform_user_id || null,
  });
});

// GET /im/settings - Get IM settings (admin only)
router.get('/settings', async ({ request }) => {
  await requireAdmin(request);

  return ok({
    lark_enabled: false,
    wechat_enabled: false,
  });
});

// PUT /im/settings - Update IM settings (admin only)
router.put('/settings', async ({ request }) => {
  await requireAdmin(request);

  const body = await request.json().catch(() => ({}));

  // Update IM settings would go here
  return ok(null);
});

// WeChat bridge endpoints
// POST /im/wechat/start - Start WeChat bridge
router.post('/wechat/start', async ({ request }) => {
  await requireAdmin(request);
  return ok({ status: 'starting' });
});

// POST /im/wechat/resume - Resume WeChat bridge
router.post('/wechat/resume', async ({ request }) => {
  await requireAdmin(request);
  return ok({ status: 'resuming' });
});

// POST /im/wechat/stop - Stop WeChat bridge
router.post('/wechat/stop', async ({ request }) => {
  await requireAdmin(request);
  return ok({ status: 'stopping' });
});

// POST /im/wechat/logout - Logout WeChat
router.post('/wechat/logout', async ({ request }) => {
  await requireAdmin(request);
  return ok(null);
});

// GET /im/wechat/status - Get WeChat status
router.get('/wechat/status', async ({ request }) => {
  await requireAdmin(request);

  return ok({
    connected: false,
    qr_code: null,
  });
});

// POST /im/internal/feishu-setup - Internal Feishu setup (sandbox only)
router.post('/internal/feishu-setup', async ({ request }) => {
  // Internal endpoint for sandbox setup
  return ok(null);
});

export default router;
