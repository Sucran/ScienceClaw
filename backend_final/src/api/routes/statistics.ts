import { Elysia } from 'elysia';
import { getCollection } from '@adapters/mongo/connection.js';
import { getCurrentUser } from '../middleware/auth.js';
import type { ApiResponse } from '@core/types.js';

const router = new Elysia({ prefix: '/statistics' });

function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, msg: 'ok', data };
}

async function requireAuth(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// GET /statistics/summary - Get usage summary
router.get('/summary', async ({ request }) => {
  await requireAuth(request);

  return ok({
    total_cost_usd: 0,
    total_cost_cny: 0,
    total_sessions: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_tokens: 0,
    avg_per_session: 0,
    cost_trend: 0,
    session_trend: 0,
    token_trend: 0,
    distribution: [],
  });
});

// GET /statistics/models - Get model usage ranking
router.get('/models', async ({ request }) => {
  await requireAuth(request);

  return ok({ models: [] });
});

// GET /statistics/trends - Get usage trends
router.get('/trends', async ({ request }) => {
  await requireAuth(request);

  return ok({ trends: [] });
});

// GET /statistics/sessions - Get session usage details
router.get('/sessions', async ({ request }) => {
  await requireAuth(request);

  return ok({ sessions: [] });
});

export default router;
