import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPluginRegistry,
  registerPlugin,
  getPlugin,
  getAllPlugins,
  registerTool,
  getTool,
  getAllTools,
  registerHook,
  getHookHandlers,
  registerHttpRoute,
  getAllHttpRoutes,
  registerService,
  getService,
  getAllServices,
  registerChannel,
  getChannel,
  getAllChannels,
  registerContextEngine,
  getContextEngine
} from '../../src/plugins/registry.ts'
import type { PluginRegistry } from '../../src/plugins/types.ts'

describe('Plugin Registry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = createPluginRegistry()
  })

  describe('createPluginRegistry', () => {
    it('should create an empty registry', () => {
      expect(registry.plugins.size).toBe(0)
      expect(registry.tools.size).toBe(0)
      expect(registry.hooks.size).toBe(0)
      expect(registry.httpRoutes.length).toBe(0)
      expect(registry.services.size).toBe(0)
      expect(registry.channels.size).toBe(0)
      expect(registry.contextEngines.size).toBe(0)
    })
  })

  describe('Plugin Management', () => {
    it('should register a plugin', () => {
      const plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        source: '/path/to/plugin',
        rootDir: '/path/to/plugin',
        manifest: { id: 'test-plugin', name: 'Test Plugin', configSchema: {} },
        enabled: true
      }

      registerPlugin(registry, plugin)
      expect(registry.plugins.size).toBe(1)
      expect(getPlugin(registry, 'test-plugin')).toEqual(plugin)
    })

    it('should get all plugins', () => {
      registerPlugin(registry, {
        id: 'plugin1',
        name: 'Plugin 1',
        source: '/path/1',
        rootDir: '/path/1',
        manifest: { id: 'plugin1', configSchema: {} },
        enabled: true
      })
      registerPlugin(registry, {
        id: 'plugin2',
        name: 'Plugin 2',
        source: '/path/2',
        rootDir: '/path/2',
        manifest: { id: 'plugin2', configSchema: {} },
        enabled: true
      })

      const plugins = getAllPlugins(registry)
      expect(plugins.length).toBe(2)
    })

    it('should return undefined for non-existent plugin', () => {
      expect(getPlugin(registry, 'non-existent')).toBeUndefined()
    })
  })

  describe('Tool Management', () => {
    it('should register a tool', () => {
      const tool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
        execute: async (input: unknown) => input
      }

      registerTool(registry, 'test-plugin', tool)
      expect(registry.tools.size).toBe(1)
      expect(getTool(registry, 'test_tool')).toEqual(tool)
    })

    it('should get all tools', () => {
      registerTool(registry, 'plugin1', {
        name: 'tool1',
        execute: async () => {}
      })
      registerTool(registry, 'plugin2', {
        name: 'tool2',
        execute: async () => {}
      })

      const tools = getAllTools(registry)
      expect(tools.length).toBe(2)
    })

    it('should return undefined for non-existent tool', () => {
      expect(getTool(registry, 'non-existent')).toBeUndefined()
    })
  })

  describe('Hook Management', () => {
    it('should register a hook handler', () => {
      const handler = async () => {}
      registerHook(registry, 'test-plugin', 'before_agent_start', handler)

      const handlers = getHookHandlers(registry, 'before_agent_start')
      expect(handlers.length).toBe(1)
      expect(handlers[0]).toBe(handler)
    })

    it('should allow multiple handlers for the same event', () => {
      const handler1 = async () => {}
      const handler2 = async () => {}
      registerHook(registry, 'plugin1', 'session_end', handler1)
      registerHook(registry, 'plugin2', 'session_end', handler2)

      const handlers = getHookHandlers(registry, 'session_end')
      expect(handlers.length).toBe(2)
    })

    it('should return empty array for non-existent event', () => {
      const handlers = getHookHandlers(registry, 'non_existent_event')
      expect(handlers.length).toBe(0)
    })
  })

  describe('HTTP Route Management', () => {
    it('should register an HTTP route', () => {
      const route = {
        method: 'GET' as const,
        path: '/api/test',
        handler: async () => ({})
      }

      registerHttpRoute(registry, route)
      expect(registry.httpRoutes.length).toBe(1)
    })

    it('should get all HTTP routes', () => {
      registerHttpRoute(registry, { method: 'GET', path: '/route1', handler: async () => {} })
      registerHttpRoute(registry, { method: 'POST', path: '/route2', handler: async () => {} })

      const routes = getAllHttpRoutes(registry)
      expect(routes.length).toBe(2)
    })
  })

  describe('Service Management', () => {
    it('should register a service', () => {
      const service = {
        id: 'test-service',
        name: 'Test Service',
        init: async () => {},
        destroy: async () => {}
      }

      registerService(registry, service)
      expect(registry.services.size).toBe(1)
      expect(getService(registry, 'test-service')?.name).toBe('Test Service')
    })

    it('should get all services', () => {
      registerService(registry, { id: 'service1', name: 'Service 1' })
      registerService(registry, { id: 'service2', name: 'Service 2' })

      const services = getAllServices(registry)
      expect(services.length).toBe(2)
    })

    it('should return undefined for non-existent service', () => {
      expect(getService(registry, 'non-existent')).toBeUndefined()
    })
  })

  describe('Channel Management', () => {
    it('should register a channel', () => {
      const channel = {
        id: 'test-channel',
        meta: { id: 'test-channel', label: 'Test Channel', selectionLabel: 'test' },
        capabilities: { chatTypes: ['direct'] },
        outbound: { deliveryMode: 'direct' as const },
        status: {
          defaultRuntime: {},
          collectStatusIssues: () => [],
          buildChannelSummary: () => ({}),
          buildAccountSnapshot: () => ({})
        },
        config: {
          listAccountIds: () => [],
          resolveAccount: () => ({}),
          isConfigured: () => false,
          describeAccount: () => ({ accountId: '' })
        }
      }

      registerChannel(registry, channel)
      expect(registry.channels.size).toBe(1)
      expect(getChannel(registry, 'test-channel')).toEqual(channel)
    })

    it('should get all channels', () => {
      const channel1 = {
        id: 'channel1',
        meta: { id: 'channel1', label: 'Channel 1', selectionLabel: 'c1' },
        capabilities: { chatTypes: ['direct'] },
        outbound: { deliveryMode: 'direct' as const },
        status: {
          defaultRuntime: {},
          collectStatusIssues: () => [],
          buildChannelSummary: () => ({}),
          buildAccountSnapshot: () => ({})
        },
        config: {
          listAccountIds: () => [],
          resolveAccount: () => ({}),
          isConfigured: () => false,
          describeAccount: () => ({ accountId: '' })
        }
      }

      registerChannel(registry, channel1)
      const channels = getAllChannels(registry)
      expect(channels.length).toBe(1)
    })

    it('should return undefined for non-existent channel', () => {
      expect(getChannel(registry, 'non-existent')).toBeUndefined()
    })
  })

  describe('Context Engine Management', () => {
    it('should register a context engine', () => {
      const engine = { type: 'test-engine', process: () => {} }
      registerContextEngine(registry, 'test-engine', engine)

      expect(registry.contextEngines.size).toBe(1)
      expect(getContextEngine(registry, 'test-engine')).toBe(engine)
    })

    it('should return undefined for non-existent context engine', () => {
      expect(getContextEngine(registry, 'non-existent')).toBeUndefined()
    })
  })
})
