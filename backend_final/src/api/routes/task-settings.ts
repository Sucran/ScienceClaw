import { Elysia } from 'elysia';
import { getCollection } from '@adapters/mongo/connection.js';
import { getCurrentUser } from '../middleware/auth.js';
import type { ApiResponse, TaskSettings } from '@core/types.js';

const router = new Elysia({ prefix: '/task-settings' });

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

const DEFAULT_SETTINGS: TaskSettings = {
  agent_stream_timeout: 10800,
  sandbox_exec_timeout: 1200,
  max_tokens: 8192,
  output_reserve: 16384,
  max_history_rounds: 10,
  max_output_chars: 50000,
};

// GET /task-settings - Get task settings
router.get('/', async ({ request }) => {
  const user = await requireAuth(request);

  const settings = await getCollection('task_settings').findOne({ _id: user.id as any });

  if (!settings) {
    return ok(DEFAULT_SETTINGS);
  }

  return ok({
    agent_stream_timeout: settings.agent_stream_timeout || DEFAULT_SETTINGS.agent_stream_timeout,
    sandbox_exec_timeout: settings.sandbox_exec_timeout || DEFAULT_SETTINGS.sandbox_exec_timeout,
    max_tokens: settings.max_tokens || DEFAULT_SETTINGS.max_tokens,
    output_reserve: settings.output_reserve || DEFAULT_SETTINGS.output_reserve,
    max_history_rounds: settings.max_history_rounds || DEFAULT_SETTINGS.max_history_rounds,
    max_output_chars: settings.max_output_chars || DEFAULT_SETTINGS.max_output_chars,
  });
});

// PUT /task-settings - Update task settings
router.put('/', async ({ request }) => {
  const user = await requireAuth(request);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  await getCollection('task_settings').updateOne(
    { _id: user.id as any },
    { $set: { ...body, _id: user.id as any } },
    { upsert: true }
  );

  return ok(null);
});

export default router;
