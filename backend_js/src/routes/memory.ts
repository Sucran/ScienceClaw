import { Elysia } from 'elysia';
import { getCurrentUser } from '../middleware/auth';
import type { ApiResponse } from '../types';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { config } from '../config';

const router = new Elysia({ prefix: '/memory' });

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

function getMemoryPath(userId: string): string {
  return join(config.workspaceDir, '_memory', userId, 'AGENTS.md');
}

// GET /memory - Get user memory
router.get('/', async ({ request }) => {
  const user = await requireAuth(request);

  const memoryPath = getMemoryPath(user.id);

  if (!existsSync(memoryPath)) {
    return ok({ content: '' });
  }

  const content = await readFile(memoryPath, 'utf-8').catch(() => '');
  return ok({ content });
});

// PUT /memory - Update user memory
router.put('/', async ({ request }) => {
  const user = await requireAuth(request);

  const body = await request.json().catch(() => ({})) as { content?: string };
  const { content } = body;

  const memoryPath = getMemoryPath(user.id);
  const dir = join(config.workspaceDir, '_memory', user.id);

  await mkdir(dir, { recursive: true });
  await writeFile(memoryPath, content || '', 'utf-8');

  return ok(null);
});

export default router;
