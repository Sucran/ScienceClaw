/**
 * File-based SessionStorage for local / Bun deployments.
 * Core defaults to NullSessionStorage; call setSessionStorage(new FileSessionStorage()) to enable.
 */
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import type { ScienceSession, SessionStorage } from "../../core/deepagent/sessions.js"

export const FILE_SESSIONS_DIR = join(homedir(), ".scienceclaw", "sessions")

export class FileSessionStorage implements SessionStorage {
  private async ensureDir(): Promise<void> {
    await mkdir(FILE_SESSIONS_DIR, { recursive: true })
  }

  private sessionPath(sessionId: string): string {
    return join(FILE_SESSIONS_DIR, `${sessionId}.json`)
  }

  async create(session: ScienceSession): Promise<void> {
    await this.ensureDir()
    await writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2), "utf-8")
  }

  async get(sessionId: string): Promise<ScienceSession | null> {
    try {
      const path = this.sessionPath(sessionId)
      if (!existsSync(path)) return null
      const content = await readFile(path, "utf-8")
      return JSON.parse(content) as ScienceSession
    } catch {
      return null
    }
  }

  async list(): Promise<ScienceSession[]> {
    await this.ensureDir()
    try {
      const files = await readdir(FILE_SESSIONS_DIR)
      const sessions: ScienceSession[] = []
      for (const file of files) {
        if (!file.endsWith(".json")) continue
        try {
          const content = await readFile(join(FILE_SESSIONS_DIR, file), "utf-8")
          sessions.push(JSON.parse(content) as ScienceSession)
        } catch {
          // Skip invalid files
        }
      }
      return sessions.sort((a, b) => b.updated_at - a.updated_at)
    } catch {
      return []
    }
  }

  async update(session: ScienceSession): Promise<void> {
    await this.ensureDir()
    const tmpPath = this.sessionPath(session.id) + ".tmp"
    await writeFile(tmpPath, JSON.stringify(session, null, 2), "utf-8")
    const { rename } = await import("node:fs/promises")
    await rename(tmpPath, this.sessionPath(session.id))
  }

  async delete(sessionId: string): Promise<void> {
    const path = this.sessionPath(sessionId)
    if (existsSync(path)) {
      await unlink(path)
    }
  }
}
