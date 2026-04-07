/**
 * MongoDB-backed session storage for SuperClaw
 * This replaces the file-based storage in sessions.ts
 */
import type { Collection } from 'mongodb';
import type { ScienceSession, SessionStorage } from './sessions';

export class MongoSessionStorage implements SessionStorage {
  constructor(private collection: Collection) {}

  async create(session: ScienceSession): Promise<void> {
    await this.collection.insertOne({
      _id: session.id as any,
      ...session,
    });
  }

  async get(sessionId: string): Promise<ScienceSession | null> {
    const doc = await this.collection.findOne({ _id: sessionId as any });
    if (!doc) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...session } = doc as any;
    return { ...session, id: sessionId } as ScienceSession;
  }

  async list(): Promise<ScienceSession[]> {
    const docs = await this.collection.find({}).toArray();
    return docs.map((doc: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...session } = doc;
      return { ...session, id: doc._id } as ScienceSession;
    });
  }

  async update(session: ScienceSession): Promise<void> {
    await this.collection.replaceOne(
      { _id: session.id as any },
      { _id: session.id as any, ...session }
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.collection.deleteOne({ _id: sessionId as any });
  }
}
