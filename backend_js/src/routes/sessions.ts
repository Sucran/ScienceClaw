import { Elysia } from 'elysia';
import { getCollection } from '../db/mongodb';
import { getCurrentUser } from '../middleware/auth';
import type { ApiResponse, Session } from '../types';
import shortuuid from 'short-uuid';
import { EventType } from '../deepagent/sse-protocol';
import { runScienceTaskStream, type RunInput } from '../deepagent/runner';

const router = new Elysia({ prefix: '/sessions' });

// Helper to create API response
function ok<T>(data: T): ApiResponse<T> {
  return { code: 0, msg: 'ok', data };
}

function error(code: number, msg: string): ApiResponse<null> {
  return { code, msg, data: null };
}

// Check if user is authenticated
async function requireAuth(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// PUT /sessions - Create new session
router.put('/', async ({ request }) => {
  const user = await requireAuth(request);
  const body = await request.json().catch(() => ({})) as { mode?: string };
  const mode = body.mode || 'deep';

  const sessionId = shortuuid.generate();
  const now = Math.floor(Date.now() / 1000);

  const session = {
    _id: sessionId as any,
    session_id: sessionId,
    thread_id: sessionId,
    user_id: user.id,
    mode,
    model_config: null,
    vm_root_dir: `/home/scienceclaw/${user.id}/${sessionId}`,
    created_at: now,
    updated_at: now,
    status: 'pending',
    events: [],
    plan: [],
    title: null,
    unread_message_count: 0,
    is_shared: false,
    latest_message: '',
    latest_message_at: 0,
    pinned: false,
    source: null,
  };

  await getCollection('sessions').insertOne(session);

  return ok({ session_id: sessionId, mode });
});

// GET /sessions - List all sessions
router.get('/', async ({ request, query }) => {
  const user = await requireAuth(request);
  const cursor = getCollection('sessions').find({ user_id: user.id });
  const sessions = await cursor.sort({ updated_at: -1 }).limit(100).toArray();

  const items = sessions.map((s) => ({
    session_id: s.session_id,
    title: s.title || null,
    latest_message: s.latest_message || null,
    latest_message_at: s.latest_message_at || null,
    status: s.status || 'pending',
    unread_message_count: s.unread_message_count || 0,
    is_shared: s.is_shared || false,
    mode: s.mode || 'deep',
    pinned: s.pinned || false,
    source: s.source || null,
  }));

  return ok({ sessions: items });
});

// GET /sessions/notifications - SSE notifications stream
router.get('/notifications', async ({ request }) => {
  // For now, return an empty stream - notifications are session-specific
  return new Response(null, { status: 204 });
});

// GET /sessions/skills - List all skills
router.get('/skills', async ({ request }) => {
  await requireAuth(request);

  // Return built-in skills from the skills directory
  const skills = [
    { name: 'find-skills', description: 'Find and install community skills' },
    { name: 'pdf', description: 'PDF generation and manipulation' },
    { name: 'docx', description: 'Word document creation' },
    { name: 'pptx', description: 'PowerPoint generation' },
    { name: 'xlsx', description: 'Excel spreadsheet creation' },
  ];

  return ok({ skills });
});

// PUT /sessions/skills/:skillName/block - Block/unblock skill
router.put('/skills/:skillName/block', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { skillName } = params;
  const body = await request.json().catch(() => ({})) as { blocked?: boolean };
  const { blocked } = body;

  if (blocked) {
    await getCollection('blocked_skills').updateOne(
      { user_id: user.id, skill_name: skillName },
      { $set: { user_id: user.id, skill_name: skillName } },
      { upsert: true }
    );
  } else {
    await getCollection('blocked_skills').deleteOne({ user_id: user.id, skill_name: skillName });
  }

  return ok(null);
});

// DELETE /sessions/skills/:skillName - Delete skill
router.delete('/skills/:skillName', async ({ request, params }) => {
  await requireAuth(request);
  const { skillName } = params;
  // Skill deletion would remove from external skills directory
  return ok(null);
});

// GET /sessions/skills/:skillName/files - List skill files
router.get('/skills/:skillName/files', async ({ request, params }) => {
  await requireAuth(request);
  const { skillName } = params;
  return ok({ files: [] });
});

// POST /sessions/skills/:skillName/read - Read skill file
router.post('/skills/:skillName/read', async ({ request, params }) => {
  await requireAuth(request);
  const { skillName } = params;
  const body = await request.json().catch(() => ({})) as { path?: string };
  const { path } = body;
  return ok({ content: '' });
});

// GET /sessions/tools - List external tools
router.get('/tools', async ({ request }) => {
  await requireAuth(request);
  const tools = [
    { name: 'web_search', description: 'Web search tool' },
    { name: 'web_crawl', description: 'Web content extraction' },
  ];
  return ok({ tools });
});

// PUT /sessions/tools/:toolName/block - Block/unblock tool
router.put('/tools/:toolName/block', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { toolName } = params;
  const body = await request.json().catch(() => ({})) as { blocked?: boolean };
  const { blocked } = body;

  // Similar to skills blocking
  return ok(null);
});

// DELETE /sessions/tools/:toolName - Delete tool
router.delete('/tools/:toolName', async ({ request, params }) => {
  await requireAuth(request);
  const { toolName } = params;
  return ok(null);
});

// POST /sessions/tools/:toolName/read - Read tool file
router.post('/sessions/tools/:toolName/read', async ({ request, params }) => {
  await requireAuth(request);
  const { toolName } = params;
  return ok({ content: '' });
});

// GET /sessions/shared/:sessionId - Get shared session (no auth)
router.get('/shared/:sessionId', async ({ params }) => {
  const { sessionId } = params;
  const session = await getCollection('sessions').findOne({ session_id: sessionId, is_shared: true });

  if (!session) {
    return error(404, 'Shared session not found');
  }

  return ok({
    session_id: session.session_id,
    title: session.title || null,
    status: session.status,
    events: session.events || [],
    mode: session.mode || 'deep',
  });
});

// GET /sessions/:sessionId - Get session details
router.get('/:sessionId', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  const session = await getCollection('sessions').findOne({ session_id: sessionId, user_id: user.id });

  if (!session) {
    return error(404, 'Session not found');
  }

  return ok({
    session_id: session.session_id,
    title: session.title || null,
    status: session.status,
    events: session.events || [],
    is_shared: session.is_shared || false,
    mode: session.mode || 'deep',
    model_config_id: session.model_config_id || null,
  });
});

// DELETE /sessions/:sessionId - Delete session
router.delete('/:sessionId', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  await getCollection('sessions').deleteOne({ session_id: sessionId, user_id: user.id });

  return ok(null);
});

// PATCH /sessions/:sessionId/pin - Pin/unpin session
router.patch('/:sessionId/pin', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;
  const body = await request.json().catch(() => ({})) as { pinned?: boolean };
  const { pinned } = body;

  await getCollection('sessions').updateOne(
    { session_id: sessionId, user_id: user.id },
    { $set: { pinned: !!pinned, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// PATCH /sessions/:sessionId/title - Update session title
router.patch('/:sessionId/title', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;
  const body = await request.json().catch(() => ({})) as { title?: string };
  const { title } = body;

  await getCollection('sessions').updateOne(
    { session_id: sessionId, user_id: user.id },
    { $set: { title, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// POST /sessions/:sessionId/clear_unread_message_count - Clear unread count
router.post('/:sessionId/clear_unread_message_count', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  await getCollection('sessions').updateOne(
    { session_id: sessionId, user_id: user.id },
    { $set: { unread_message_count: 0 } }
  );

  return ok(null);
});

// POST /sessions/:sessionId/stop - Stop session execution
router.post('/:sessionId/stop', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  await getCollection('sessions').updateOne(
    { session_id: sessionId, user_id: user.id },
    { $set: { status: 'paused', updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// POST /sessions/:sessionId/share - Share session
router.post('/:sessionId/share', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  await getCollection('sessions').updateOne(
    { session_id: sessionId, user_id: user.id },
    { $set: { is_shared: true, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// DELETE /sessions/:sessionId/share - Unshare session
router.delete('/:sessionId/share', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  await getCollection('sessions').updateOne(
    { session_id: sessionId, user_id: user.id },
    { $set: { is_shared: false, updated_at: Math.floor(Date.now() / 1000) } }
  );

  return ok(null);
});

// GET /sessions/:sessionId/files - List session workspace files
router.get('/:sessionId/files', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  // Return empty file list - actual file listing would need sandbox integration
  return ok({ files: [] });
});

// GET /sessions/:sessionId/sandbox-file - Read sandbox file
router.get('/:sessionId/sandbox-file', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;
  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!path) {
    return error(400, 'Path is required');
  }

  return ok({ content: '', path });
});

// GET /sessions/:sessionId/sandbox-file/download - Download sandbox file
router.get('/:sessionId/sandbox-file/download', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;
  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!path) {
    return error(400, 'Path is required');
  }

  return ok({ url: '' });
});

// POST /sessions/:sessionId/upload - Upload file to session
router.post('/:sessionId/upload', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  // File upload handling would go here
  return ok({
    file_id: '',
    filename: '',
    size: 0,
    upload_date: new Date().toISOString(),
    content_type: '',
    file_url: '',
    metadata: {},
  });
});

// POST /sessions/:sessionId/chat - SSE chat endpoint
router.post('/:sessionId/chat', async ({ request, params }) => {
  const user = await requireAuth(request);
  const { sessionId } = params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error(400, 'Invalid JSON body');
  }

  const message = String(body.message || '');
  const language = String(body.language || 'zh');
  const modelConfigId = body.model_config_id as string | undefined;

  // Get session
  const session = await getCollection('sessions').findOne({ session_id: sessionId, user_id: user.id });
  if (!session) {
    return error(404, 'Session not found');
  }

  // Update session status
  await getCollection('sessions').updateOne(
    { session_id: sessionId },
    { $set: { status: 'running', updated_at: Math.floor(Date.now() / 1000) } }
  );

  // Build SSE response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      };

      try {
        const runInput: RunInput = {
          sessionId,
          userMessage: message,
          userId: user.id,
          language,
          modelConfig: modelConfigId ? { id: modelConfigId } as any : undefined,
        };

        for await (const chunk of runScienceTaskStream(runInput)) {
          sendEvent(chunk.event, chunk.data);
        }

        // Update session status on completion
        await getCollection('sessions').updateOne(
          { session_id: sessionId },
          { $set: { status: 'completed', updated_at: Math.floor(Date.now() / 1000) } }
        );

        sendEvent('done', { session_id: sessionId });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        const errStack = err instanceof Error ? err.stack : String(err);
        console.error("[Chat SSE] Error:", errStack);
        sendEvent('error', { message: errMsg });

        await getCollection('sessions').updateOne(
          { session_id: sessionId },
          { $set: { status: 'pending', updated_at: Math.floor(Date.now() / 1000) } }
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});

// POST /sessions/:sessionId/skills/save - Save skill from session
router.post('/:sessionId/skills/save', async ({ request, params }) => {
  await requireAuth(request);
  const { sessionId } = params;
  return ok({ path: '' });
});

// POST /sessions/:sessionId/tools/save - Save tool from session
router.post('/:sessionId/tools/save', async ({ request, params }) => {
  await requireAuth(request);
  const { sessionId } = params;
  return ok({ path: '' });
});

export default router;
