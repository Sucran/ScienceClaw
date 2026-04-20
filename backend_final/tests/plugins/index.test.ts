import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  loadPlugins,
  executeHooks,
  getPlugin,
  getAllPlugins,
  getTool,
  getAllTools,
  getAllHttpRoutes,
  getAllChannels,
  getContextEngine,
  createPluginRegistry
} from '../../src/plugins/index.ts'
import { setGlobalRegistry } from '../../src/plugins/api-builder.ts'
import { mkdir, readdir, stat, access, readFile } from 'node:fs/promises'

vi.mock('node:fs/promises')

describe('Plugins Index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setGlobalRegistry(createPluginRegistry())
  })

  describe('executeHooks', () => {
    it('should execute all handlers for an event', async () => {
      const registry = createPluginRegistry()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      registry.hooks.set('test_event', new Set([handler1, handler2]))

      await executeHooks(registry, 'test_event', { data: 'test' }, { sessionId: 's1' })

      expect(handler1).toHaveBeenCalledWith({ data: 'test' }, { sessionId: 's1' })
      expect(handler2).toHaveBeenCalledWith({ data: 'test' }, { sessionId: 's1' })
    })

    it('should handle handler errors gracefully', async () => {
      const registry = createPluginRegistry()
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'))
      const normalHandler = vi.fn()

      registry.hooks.set('test_event', new Set([errorHandler, normalHandler]))

      // Should not throw
      await executeHooks(registry, 'test_event', {}, {})

      expect(errorHandler).toHaveBeenCalled()
      expect(normalHandler).toHaveBeenCalled()
    })

    it('should do nothing when no handlers registered', async () => {
      const registry = createPluginRegistry()

      await executeHooks(registry, 'non_existent_event', {}, {})

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('loadPlugins', () => {
    it('should return empty registry when no plugins found', async () => {
      vi.mocked(readdir).mockResolvedValue([])

      const registry = await loadPlugins({ pluginsDir: '/empty' })

      expect(registry.plugins.size).toBe(0)
    })

    it('should include default runtime', async () => {
      vi.mocked(readdir).mockResolvedValue([])

      const registry = await loadPlugins({ pluginsDir: '/empty' })

      expect(registry).toBeDefined()
    })

    it('should pass options to discovery', async () => {
      vi.mocked(readdir).mockResolvedValue([])

      await loadPlugins({
        pluginsDir: '/custom/path',
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        config: { key: 'value' },
        enabledPlugins: ['plugin-a'],
        disabledPlugins: ['plugin-b']
      })

      expect(vi.mocked(readdir)).toHaveBeenCalled()
    })
  })

  describe('re-exports', () => {
    it('should export getPlugin', () => {
      expect(getPlugin).toBeDefined()
      expect(typeof getPlugin).toBe('function')
    })

    it('should export getAllPlugins', () => {
      expect(getAllPlugins).toBeDefined()
      expect(typeof getAllPlugins).toBe('function')
    })

    it('should export getTool', () => {
      expect(getTool).toBeDefined()
      expect(typeof getTool).toBe('function')
    })

    it('should export getAllTools', () => {
      expect(getAllTools).toBeDefined()
      expect(typeof getAllTools).toBe('function')
    })

    it('should export getAllHttpRoutes', () => {
      expect(getAllHttpRoutes).toBeDefined()
      expect(typeof getAllHttpRoutes).toBe('function')
    })

    it('should export getAllChannels', () => {
      expect(getAllChannels).toBeDefined()
      expect(typeof getAllChannels).toBe('function')
    })

    it('should export getContextEngine', () => {
      expect(getContextEngine).toBeDefined()
      expect(typeof getContextEngine).toBe('function')
    })

    it('should export createPluginRegistry', () => {
      expect(createPluginRegistry).toBeDefined()
      expect(typeof createPluginRegistry).toBe('function')
    })
  })
})
