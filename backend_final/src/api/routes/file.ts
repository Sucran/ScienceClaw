import { Elysia } from 'elysia';
import { getCurrentUser } from '../middleware/auth.js';
import type { ApiResponse } from '@core/types.js';

const router = new Elysia({ prefix: '/file' });

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

// Allowed download paths
const ALLOWED_PREFIXES = ['/home/scienceclaw/', '/tmp/'];

// GET /file/download - Download file
router.get('/download', async ({ request }) => {
  await requireAuth(request);

  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return error(400, 'Path is required');
  }

  // Security check - only allow specific paths
  const allowed = ALLOWED_PREFIXES.some(prefix => filePath.startsWith(prefix));
  if (!allowed) {
    return error(403, 'Path not allowed');
  }

  // File download would be implemented here
  return error(501, 'File download not yet implemented');
});

export default router;
