import { Elysia } from 'elysia';
import { getCurrentUser } from '../middleware/auth.js';
import type { ApiResponse } from '@core/types.js';

const router = new Elysia({ prefix: '/science' });

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

// POST /science/optimize_prompt - Optimize user query
router.post('/optimize_prompt', async ({ request }) => {
  await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { query?: string };
  const { query } = body;

  // LLM-based prompt optimization would go here
  // For now, return the original query
  return ok({ optimized: query });
});

export default router;
