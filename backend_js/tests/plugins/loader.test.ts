import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadPluginModule, getPluginEntryPath } from '../../src/plugins/loader.ts'

describe('Plugin Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadPluginModule', () => {
    it('should return error for non-existent module', async () => {
      const result = await loadPluginModule('/non/existent/path.ts', '/base/dir')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toContain('failed to load plugin')
      }
    })

    it('should return error for invalid module path', async () => {
      const result = await loadPluginModule('invalid!@#$path.ts', '/base/dir')

      expect(result.ok).toBe(false)
    })
  })

  describe('getPluginEntryPath', () => {
    it('should return default entry path', () => {
      const path = getPluginEntryPath('/plugins/my-plugin')
      expect(path).toContain('my-plugin')
      expect(path).toContain('index.ts')
    })

    it('should return custom entry path', () => {
      const path = getPluginEntryPath('/plugins/my-plugin', 'main.ts')
      expect(path).toContain('my-plugin')
      expect(path).toContain('main.ts')
    })

    it('should handle absolute paths', () => {
      const path = getPluginEntryPath('/absolute/path', 'custom.ts')
      expect(path).toBe('/absolute/path/custom.ts')
    })
  })
})
