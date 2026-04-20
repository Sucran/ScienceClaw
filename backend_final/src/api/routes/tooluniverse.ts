import { Elysia } from 'elysia';
import { getCurrentUser } from '../middleware/auth.js';
import type { ApiResponse } from '@core/types.js';

const router = new Elysia({ prefix: '/tooluniverse' });

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

// GET /tooluniverse/tools - List tools
router.get('/tools', async ({ request, query }) => {
  await requireAuth(request);

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || '';
  const category = url.searchParams.get('category') || '';

  // ToolUniverse tools would be loaded from the Python backend or a direct integration
  // For now, return empty list
  return ok({ tools: [], total: 0, page: 1, page_size: 20 });
});

// GET /tooluniverse/tools/:toolName - Get tool spec
router.get('/tools/:toolName', async ({ request, params }) => {
  await requireAuth(request);
  const { toolName } = params;

  return ok({
    name: toolName,
    description: '',
    parameters: {},
  });
});

// POST /tooluniverse/tools/:toolName/run - Run tool
router.post('/tools/:toolName/run', async ({ request, params }) => {
  await requireAuth(request);
  const { toolName } = params;

  const body = await request.json().catch(() => ({}));

  // ToolUniverse tool execution would go here
  return ok({ result: null });
});

// GET /tooluniverse/categories - List categories
router.get('/categories', async ({ request }) => {
  await requireAuth(request);

  const categories = [
    { id: 'drug_discovery', name: 'Drug Discovery' },
    { id: 'astronomy', name: 'Astronomy' },
    { id: 'earth_science', name: 'Earth Science' },
    { id: 'chemistry', name: 'Chemistry' },
    { id: 'biodiversity', name: 'Biodiversity' },
    { id: 'literature', name: 'Academic Literature' },
  ];

  return ok({ categories });
});

export default router;
