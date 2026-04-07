import { Elysia } from 'elysia';
import cors from '@elysiajs/cors';
import { config } from './config';
import { connectMongoDB, getCollection } from './db/mongodb';
import { authPlugin } from './middleware/auth';
import { hashPassword } from './utils/password';
import { setSessionStorage } from './deepagent/sessions';
import { MongoSessionStorage } from './deepagent/mongo-session-storage';
import authRoutes from './routes/auth';
import sessionsRoutes from './routes/sessions';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import tooluniverseRoutes from './routes/tooluniverse';
import taskSettingsRoutes from './routes/task-settings';
import memoryRoutes from './routes/memory';
import scienceRoutes from './routes/science';
import statisticsRoutes from './routes/statistics';
import fileRoutes from './routes/file';
import imRoutes from './routes/im';

// Plugin system imports
import { loadPlugins, getAllHttpRoutes, initializeServices, createPluginRegistry } from './plugins/index.js';
import type { PluginRegistry } from './plugins/index.js';

// Create Elysia app
const app = new Elysia();

// CORS middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Health check endpoints
app.get('/health', () => ({ status: 'ok' }));

app.get('/ready', async () => {
  try {
    await getCollection('sessions').findOne({}, { projection: { _id: 1 } });
    return { status: 'ready', mongodb: 'ok' };
  } catch (e) {
    return { status: 'not_ready', mongodb: String(e) };
  }
});

// API v1 routes
app.group('/api/v1', (app) => app
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

// Ensure admin user exists on startup
async function ensureAdminUser(): Promise<void> {
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

// Register plugin HTTP routes with Elysia
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

// Startup
const start = async () => {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Initialize SuperClaw with MongoDB storage
    const sessionCollection = getCollection('sessions');
    const storage = new MongoSessionStorage(sessionCollection);
    setSessionStorage(storage);
    console.log('[SuperClaw] MongoDB session storage initialized');

    // Ensure admin user exists
    await ensureAdminUser();

    // Load plugins
    console.log('[Plugins] Starting plugin discovery and loading...');
    const pluginRegistry = await loadPlugins({
      pluginsDir: process.env.PLUGINS_DIR || './plugins',
    });

    console.log(`[Plugins] Loaded ${pluginRegistry.plugins.size} plugin(s)`);
    console.log(`[Plugins] Registered ${pluginRegistry.tools.size} tool(s)`);
    console.log(`[Plugins] Registered ${pluginRegistry.httpRoutes.length} route(s)`);
    console.log(`[Plugins] Registered ${pluginRegistry.channels.size} channel(s)`);

    // Register plugin HTTP routes
    registerPluginRoutes(pluginRegistry);

    // Initialize plugin services
    await initializeServices(pluginRegistry);

    // Start server
    app.listen(config.port);
    console.log(`ScienceClaw JS backend running on port ${config.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
