/**
 * 参考注释：
 * - "FilteredFilesystemBackend — 支持屏蔽特定 skills 的文件系统后端。"
 * - "对所有文件操作（ls/read/write/edit/glob/grep）进行屏蔽检查"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/filtered_backend.py:1-128
 */
import {
  FilesystemBackend,
  type EditResult,
  type FileInfo,
  type GrepMatch,
  type WriteResult
} from "deepagents"

export class FilteredFilesystemBackend extends FilesystemBackend {
  private readonly blocked: Set<string>

  constructor(options: { rootDir: string; virtualMode?: boolean; blockedSkills?: Set<string> }) {
    super({ rootDir: options.rootDir, virtualMode: options.virtualMode ?? true })
    this.blocked = new Set(options.blockedSkills ?? [])
  }

  private topLevel(path: string): string {
    const clean = path.replace(/^\/+/, "")
    return clean ? clean.split("/")[0] : ""
  }

  private pathBlocked(path: string): boolean {
    const top = this.topLevel(path)
    return top.length > 0 && this.blocked.has(top)
  }

  private entryBlocked(entry: FileInfo): boolean {
    return this.pathBlocked(entry.path)
  }

  async lsInfo(path: string): Promise<FileInfo[]> {
    if (this.pathBlocked(path)) return []
    const entries = await super.lsInfo(path)
    return entries.filter((e) => !this.entryBlocked(e))
  }

  async lsInfoAsync(path: string): Promise<FileInfo[]> {
    return this.lsInfo(path)
  }

  async read(filePath: string, offset = 0, limit = 2000): Promise<string> {
    if (this.pathBlocked(filePath)) throw new Error(`Skill is blocked: ${this.topLevel(filePath)}`)
    return super.read(filePath, offset, limit)
  }

  async readAsync(filePath: string, offset = 0, limit = 2000): Promise<string> {
    return this.read(filePath, offset, limit)
  }

  async write(filePath: string, content: string): Promise<WriteResult> {
    if (this.pathBlocked(filePath)) throw new Error(`Skill is blocked: ${this.topLevel(filePath)}`)
    return super.write(filePath, content)
  }

  async writeAsync(filePath: string, content: string): Promise<WriteResult> {
    return this.write(filePath, content)
  }

  async edit(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    if (this.pathBlocked(filePath)) throw new Error(`Skill is blocked: ${this.topLevel(filePath)}`)
    return super.edit(filePath, oldString, newString, replaceAll)
  }

  async editAsync(filePath: string, oldString: string, newString: string, replaceAll = false): Promise<EditResult> {
    return this.edit(filePath, oldString, newString, replaceAll)
  }

  async globInfo(pattern: string, path = "/"): Promise<FileInfo[]> {
    if (this.pathBlocked(path)) return []
    const entries = await super.globInfo(pattern, path)
    return entries.filter((e) => !this.entryBlocked(e))
  }

  async globInfoAsync(pattern: string, path = "/"): Promise<FileInfo[]> {
    return this.globInfo(pattern, path)
  }

  async grepRaw(pattern: string, path?: string | null, glob?: string | null): Promise<GrepMatch[] | string> {
    if (path && this.pathBlocked(path)) return []
    const result = await super.grepRaw(pattern, path ?? undefined, glob ?? null)
    if (Array.isArray(result)) {
      return result.filter((m) => !this.pathBlocked(m.path))
    }
    return result
  }

  async grepRawAsync(pattern: string, path?: string | null, glob?: string | null): Promise<GrepMatch[] | string> {
    return this.grepRaw(pattern, path, glob)
  }
}