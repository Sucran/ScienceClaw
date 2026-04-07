import { Elysia } from 'elysia';
import { getCollection } from '../db/mongodb';
import { getCurrentUser } from '../middleware/auth';
import type { ApiResponse, ModelConfig } from '../types';
import shortuuid from 'short-uuid';

const router = new Elysia({ prefix: '/models' });

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

// GET /models - List all models
router.get('/', async ({ request }) => {
  const user = await requireAuth(request);

  // Get system models and user models
  const models = await getCollection('models').find({
    $or: [{ is_system: true }, { user_id: user.id }],
  }).toArray();

  return ok({ models });
});

// POST /models - Create model
router.post('/', async ({ request }) => {
  const user = await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { name?: string; provider?: string; base_url?: string; api_key?: string; model_name?: string; context_window?: number };
  const { name, provider, base_url, api_key, model_name, context_window } = body;

  const now = Math.floor(Date.now() / 1000);
  const model: ModelConfig = {
    id: shortuuid.generate(),
    name: name || '',
    provider: provider || '',
    base_url,
    api_key,
    model_name: model_name || '',
    context_window,
    is_system: false,
    user_id: user.id,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  await getCollection('models').insertOne(model);

  return ok(model);
});

// PUT /models/:modelId - Update model
router.put('/:modelId', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { modelId } = params;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  await getCollection('models').updateOne(
    { _id: modelId as any, user_id: user.id },
    { $set: { ...body, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// DELETE /models/:modelId - Delete model
router.delete('/:modelId', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { modelId } = params;

  await getCollection('models').deleteOne({ _id: modelId as any, user_id: user.id });

  return ok(null);
});

// POST /models/detect-context-window - Auto-detect model context window
router.post('/detect-context-window', async ({ request }) => {
  await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { model_name?: string; provider?: string };
  const { model_name, provider } = body;

  // Simple context window detection based on model name
  const contextWindows: Record<string, number> = {
    'deepseek-chat': 64000,
    'deepseek-coder': 16000,
    'gpt-4': 128000,
    'gpt-3.5-turbo': 16000,
  };

  const contextWindow = contextWindows[model_name || ''] || 4096;

  return ok({ context_window: contextWindow });
});

export default router;
