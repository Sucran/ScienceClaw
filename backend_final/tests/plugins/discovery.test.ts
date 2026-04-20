import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverPlugins, getPluginsDir } from '../../src/plugins/discovery.ts'

describe('Plugin Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPluginsDir', () => {
    it('should return default plugins directory', () => {
      const dir = getPluginsDir()
      expect(dir).toBeDefined()
      expect(typeof dir).toBe('string')
    })

    it('should use PLUGINS_DIR environment variable if set', () => {
      const original = process.env.PLUGINS_DIR
      process.env.PLUGINS_DIR = '/custom/plugins/path'
      const dir = getPluginsDir()
      expect(dir).toBe('/custom/plugins/path')
      if (original) {
        process.env.PLUGINS_DIR = original
      } else {
        delete process.env.PLUGINS_DIR
      }
    })

    it('should fall back to default when PLUGINS_DIR is removed', () => {
      const original = process.env.PLUGINS_DIR
      delete process.env.PLUGINS_DIR
      const dir = getPluginsDir()
      expect(dir).toBe('./plugins')
      if (original) {
        process.env.PLUGINS_DIR = original
      }
    })
  })

  describe('discoverPlugins', () => {
    it('should return empty array when directory does not exist', async () => {
      // The function handles ENOENT errors gracefully
      const plugins = await discoverPlugins('/non/existent/directory')
      expect(Array.isArray(plugins)).toBe(true)
      expect(plugins.length).toBe(0)
    })

    it('should return array type when called', async () => {
      const plugins = await discoverPlugins('/empty/dir')
      expect(Array.isArray(plugins)).toBe(true)
    })
  })
})
