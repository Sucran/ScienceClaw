import { MongoClient, Db, Collection } from 'mongodb';
import { config } from '@config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<void> {
  if (client) return;

  const { mongodbHost, mongodbPort, mongodbDbName, mongodbUsername, mongodbPassword } = config;

  let uri = `mongodb://${mongodbHost}:${mongodbPort}`;
  if (mongodbUsername && mongodbPassword) {
    uri = `mongodb://${mongodbUsername}:${mongodbPassword}@${mongodbHost}:${mongodbPort}`;
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(mongodbDbName);

  // Initialize indexes
  await initIndexes();

  console.log('[MongoDB] Connected to', mongodbDbName);
}

async function initIndexes(): Promise<void> {
  if (!db) return;

  // Users collection
  await db.collection('users').createIndex('username', { unique: true });

  // Sessions collection
  await db.collection('sessions').createIndex('user_id');
  await db.collection('sessions').createIndex({ updated_at: -1 });

  // Session events
  await db.collection('session_events').createIndex('session_id');
  await db.collection('session_events').createIndex({ timestamp: 1 });

  // Blocked skills
  await db.collection('blocked_skills').createIndex(
    { user_id: 1, skill_name: 1 },
    { unique: true }
  );

  // IM bindings
  await db.collection('im_user_bindings').createIndex(
    { platform: 1, platform_user_id: 1 },
    { unique: true }
  );
  await db.collection('im_user_bindings').createIndex(
    { platform: 1, science_user_id: 1, status: 1 }
  );

  // User sessions (for auth tokens)
  await db.collection('user_sessions').createIndex('user_id');
  await db.collection('user_sessions').createIndex('refresh_token');

  // Models collection
  await db.collection('models').createIndex('user_id');
  await db.collection('models').createIndex({ user_id: 1, is_system: 1 });

  // Task settings - _id is automatically indexed with uniqueness in MongoDB
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getCollection(name: string): Collection {
  if (!db) throw new Error('Database not initialized');
  return db.collection(name);
}

export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
