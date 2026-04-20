/**
 * 参考注释：
 * - "目录变更监控器 — 通过文件列表 + mtime 快照检测变更。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/dir_watcher.py:1-8
 */
import { watch } from "node:fs"
import { resolve } from "node:path"

export type ChangeHandler = (path: string) => void

/**
 * 参考注释：
 * - "轻量级目录变更检测"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/dir_watcher.py:19-69
 */
export class DirWatcher {
  private closeFn: (() => void) | null = null

  start(path: string, handler: ChangeHandler): void {
    this.stop()
    const full = resolve(path)
    const watcher = watch(full, { recursive: true }, (_: string, file: unknown) => {
      if (!file) return
      handler(resolve(full, file.toString()))
    })
    this.closeFn = () => watcher.close()
  }

  stop(): void {
    this.closeFn?.()
    this.closeFn = null
  }
}
