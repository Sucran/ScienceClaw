import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parsePluginManifest } from '../../src/plugins/manifest.ts'
import { readFile } from 'node:fs/promises'

vi.mock('node:fs/promises')

describe('Plugin Manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parsePluginManifest', () => {
    it('should parse a valid manifest', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'test-plugin',
        configSchema: { type: 'object' },
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin'
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.manifest.id).toBe('test-plugin')
        expect(result.manifest.name).toBe('Test Plugin')
        expect(result.manifest.version).toBe('1.0.0')
      }
    })

    it('should return error for missing manifest', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toContain('failed to parse manifest')
      }
    })

    it('should return error for invalid JSON', async () => {
      vi.mocked(readFile).mockResolvedValue('invalid json')

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toContain('failed to parse manifest')
      }
    })

    it('should return error for missing id field', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        configSchema: { type: 'object' }
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors).toContain("manifest must have a string 'id' field")
      }
    })

    it('should return error for missing configSchema field', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'test-plugin'
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors).toContain("manifest must have an object 'configSchema' field")
      }
    })

    it('should handle manifest with optional fields', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'minimal-plugin',
        configSchema: { type: 'object' },
        enabledByDefault: false,
        kind: 'memory',
        channels: ['slack'],
        providers: ['openai'],
        cliBackends: ['cli'],
        skills: ['skill1'],
        contracts: {
          tools: ['tool1', 'tool2']
        }
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.manifest.enabledByDefault).toBe(false)
        expect(result.manifest.kind).toBe('memory')
        expect(result.manifest.channels).toEqual(['slack'])
      }
    })

    it('should accept array of kinds', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'multi-kind-plugin',
        configSchema: { type: 'object' },
        kind: ['memory', 'context-engine']
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.manifest.kind).toEqual(['memory', 'context-engine'])
      }
    })

    it('should default enabledByDefault to true', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'test-plugin',
        configSchema: { type: 'object' }
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.manifest.enabledByDefault).toBe(true)
      }
    })

    it('should accept memory kind', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'memory-plugin',
        configSchema: { type: 'object' },
        kind: 'memory'
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(true)
    })

    it('should accept context-engine kind', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        id: 'context-engine-plugin',
        configSchema: { type: 'object' },
        kind: 'context-engine'
      }))

      const result = await parsePluginManifest('/path/to/plugin')

      expect(result.ok).toBe(true)
    })
  })
})
