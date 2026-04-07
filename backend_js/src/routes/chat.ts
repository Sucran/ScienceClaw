import { Elysia } from 'elysia';
import { getCurrentUser } from '../middleware/auth';
import type { ApiResponse } from '../types';

const router = new Elysia({ prefix: '/chat' });

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

// POST /chat - Task-invoked chat (JSON response)
router.post('/', async ({ request }) => {
  await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { message?: string };
  const { message } = body;

  // This would create a temporary session, run agent, return JSON
  // For now, return an error indicating not implemented
  return error(501, 'Task chat not yet implemented');
});

// POST /task/parse-schedule - Parse natural language schedule to crontab
router.post('/task/parse-schedule', async ({ request }) => {
  await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { description?: string };
  const { description } = body;

  // Simple crontab parsing would go here
  return ok({ schedule: '', next_run: null });
});

export default router;
