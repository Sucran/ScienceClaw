/**
 * backend_final entry point.
 *
 * Wires the three layers together:
 *   - core/      : pure agent + protocol + ports (no I/O frameworks)
 *   - adapters/  : Mongo (default) or Supabase (skeleton) impls of ports
 *   - api/       : Elysia routes + middleware exposing HTTP/SSE
 *
 * Adapter selection is controlled by env:
 *   STORAGE_BACKEND=mongo (default) | supabase
 */
import { Elysia } from 'elysia';
import cors from '@elysiajs/cors';

import { config } from '@config';

// --- adapters ---
import { connectMongoDB, getCollection } from '@adapters/mongo/connection.js';
import { hashPassword } from '@adapters/mongo/password.js';
import { MongoSessionStorage } from '@adapters/mongo/session-storage.js';
import { SupabaseSessionStorage } from '@adapters/supabase/session-storage.js';

// --- core ports ---
import { setSessionStorage } from '@core/ports.js';

// --- api layer ---
import { authPlugin } from '@api/middleware/auth.js';
import authRoutes from '@api/routes/auth.js';
import sessionsRoutes from '@api/routes/sessions.js';
import chatRoutes from '@api/routes/chat.js';
import modelsRoutes from '@api/routes/models.js';
import tooluniverseRoutes from '@api/routes/tooluniverse.js';
import taskSettingsRoutes from '@api/routes/task-settings.js';
import memoryRoutes from '@api/routes/memory.js';
import scienceRoutes from '@api/routes/science.js';
import statisticsRoutes from '@api/routes/statistics.js';
import fileRoutes from '@api/routes/file.js';
import imRoutes from '@api/routes/im.js';

// --- plugin system (cross-layer registry) ---
import {
  loadPlugins,
  getAllHttpRoutes,
  initializeServices,
} from '@plugins/index.js';
import type { PluginRegistry } from '@plugins/index.js';

const STORAGE_BACKEND = (process.env.STORAGE_BACKEND ?? 'mongo').toLowerCase();

const app = new Elysia();

app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

app.get('/health', () => ({ status: 'ok' }));

app.get('/ready', async () => {
  try {
    if (STORAGE_BACKEND === 'mongo') {
      await getCollection('sessions').findOne({}, { projection: { _id: 1 } });
      return { status: 'ready', backend: 'mongo' };
    }
    return { status: 'ready', backend: STORAGE_BACKEND };
  } catch (e) {
    return { status: 'not_ready', error: String(e) };
  }
});

// API v1 routes — 未认证等抛错须返回 { code, msg, data } JSON，否则前端 axios 会把非 JSON 当成功解析。
app.group('/api/v1', (app) => app
  .onError(({ error, set }) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized') {
      set.status = 401;
      return { code: 401, msg: 'Unauthorized', data: null };
    }
    console.error('[api/v1] unhandled error:', error);
    set.status = 500;
    return { code: 500, msg: message || 'Internal Server Error', data: null };
  })
  .use(authPlugin)
  .use(authRoutes)
  .use(sessionsRoutes)
  .use(chatRoutes)
  .use(modelsRoutes)
  .use(tooluniverseRoutes)
  .use(taskSettingsRoutes)
  .use(memoryRoutes)
  .use(scienceRoutes)
  .use(statisticsRoutes)
  .use(fileRoutes)
  .use(imRoutes)
);

async function ensureAdminUser(): Promise<void> {
  if (STORAGE_BACKEND !== 'mongo') return;
  if (!config.bootstrapAdminEnabled) {
    console.log('[Bootstrap] Admin bootstrap disabled');
    return;
  }
  const existing = await getCollection('users').findOne({ username: config.bootstrapAdminUsername });
  if (existing) {
    console.log('[Bootstrap] Admin user already exists');
    return;
  }
  console.log('[Bootstrap] Creating admin user...');
  const passwordHash = await hashPassword(config.bootstrapAdminPassword);
  const now = Math.floor(Date.now() / 1000);
  await getCollection('users').insertOne({
    username: config.bootstrapAdminUsername,
    fullname: 'Administrator',
    email: 'admin@example.com',
    password_hash: passwordHash,
    role: 'admin',
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  console.log('[Bootstrap] Admin user created');
}

function registerPluginRoutes(registry: PluginRegistry): void {
  const routes = getAllHttpRoutes(registry);
  for (const route of routes) {
    app.handle(route.method, route.path, async (ctx) => {
      return route.handler({
        body: ctx.body,
        params: ctx.params,
        query: ctx.query,
        headers: ctx.headers,
        session: ctx.store,
      });
    });
  }
  console.log(`[Plugins] Registered ${routes.length} HTTP route(s)`);
}

const start = async () => {
  try {
    if (STORAGE_BACKEND === 'mongo') {
      await connectMongoDB();
      const sessionCollection = getCollection('sessions');
      setSessionStorage(new MongoSessionStorage(sessionCollection));
      console.log('[Storage] Mongo session storage initialized');
    } else if (STORAGE_BACKEND === 'supabase') {
      setSessionStorage(new SupabaseSessionStorage());
      console.log('[Storage] Supabase session storage initialized (skeleton — see adapters/supabase/README.md)');
    } else {
      throw new Error(`Unknown STORAGE_BACKEND="${STORAGE_BACKEND}". Use "mongo" or "supabase".`);
    }

    await ensureAdminUser();

    console.log('[Plugins] Starting plugin discovery and loading...');
    const pluginRegistry = await loadPlugins({
      pluginsDir: process.env.PLUGINS_DIR || './plugins',
    });

    console.log(`[Plugins] Loaded ${pluginRegistry.plugins.size} plugin(s)`);
    console.log(`[Plugins] Registered ${pluginRegistry.tools.size} tool(s)`);
    console.log(`[Plugins] Registered ${pluginRegistry.httpRoutes.length} route(s)`);
    console.log(`[Plugins] Registered ${pluginRegistry.channels.size} channel(s)`);

    registerPluginRoutes(pluginRegistry);

    await initializeServices(pluginRegistry);

    app.listen(config.port);
    console.log(`[backend_final] listening on port ${config.port} (storage=${STORAGE_BACKEND})`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
