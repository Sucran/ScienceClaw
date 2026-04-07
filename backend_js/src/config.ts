import { config as dotenv } from 'dotenv';

dotenv();

export const config = {
  port: parseInt(process.env.PORT || '12001'),
  environment: process.env.ENVIRONMENT || 'local',

  // MongoDB
  mongodbHost: process.env.MONGODB_HOST || 'localhost',
  mongodbPort: parseInt(process.env.MONGODB_PORT || '27014'),
  mongodbDbName: process.env.MONGODB_DB || 'ai_agent',
  mongodbUsername: process.env.MONGODB_USER || '',
  mongodbPassword: process.env.MONGODB_PASSWORD || '',

  // Session
  sessionCookie: process.env.SESSION_COOKIE || 'zdtc-agent-session',
  sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || String(3600 * 24 * 7)),

  // Auth
  bootstrapAdminEnabled: process.env.BOOTSTRAP_ADMIN_ENABLED === 'true',
  bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin',
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin123',

  // LLM Model
  dsModel: process.env.DS_MODEL || 'deepseek-chat',
  dsApiKey: process.env.DS_API_KEY || '',
  dsBaseUrl: process.env.DS_URL || 'https://api.deepseek.com/v1',

  // Workspace
  workspaceDir: process.env.WORKSPACE_DIR || '/home/scienceclaw',
  toolsDir: process.env.TOOLS_DIR || '/app/Tools',
  builtinSkillsDir: process.env.BUILTIN_SKILLS_DIR || '/app/builtin_skills',
  externalSkillsDir: process.env.EXTERNAL_SKILLS_DIR || '/app/Skills',

  // Sandbox
  sandboxRestUrl: process.env.SANDBOX_REST_URL || 'http://localhost:18080',

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
};
