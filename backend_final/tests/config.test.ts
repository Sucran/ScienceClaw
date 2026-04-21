import { describe, it, expect, vi, beforeEach } from 'vitest'
import { config } from '../src/config.ts'

// Note: The config module loads environment variables at import time
// We need to test the actual values

describe('Config', () => {
  describe('port', () => {
    it('should have a numeric port value', () => {
      expect(typeof config.port).toBe('number')
      expect(config.port).toBeGreaterThan(0)
      expect(config.port).toBeLessThanOrEqual(65535)
    })

    it('should default to 12001', () => {
      // In test environment without PORT env var, should be 12001
      expect(config.port).toBe(12001)
    })
  })

  describe('environment', () => {
    it('should have an environment string', () => {
      expect(typeof config.environment).toBe('string')
    })

    it('should default to local', () => {
      expect(config.environment).toBe('local')
    })
  })

  describe('MongoDB configuration', () => {
    it('should have mongodbHost', () => {
      expect(typeof config.mongodbHost).toBe('string')
      expect(config.mongodbHost.length).toBeGreaterThan(0)
    })

    it('should have mongodbPort', () => {
      expect(typeof config.mongodbPort).toBe('number')
      expect(config.mongodbPort).toBeGreaterThan(0)
    })

    it('should have mongodbDbName', () => {
      expect(typeof config.mongodbDbName).toBe('string')
      expect(config.mongodbDbName.length).toBeGreaterThan(0)
    })

    it('should have mongodbUsername', () => {
      expect(typeof config.mongodbUsername).toBe('string')
    })

    it('should have mongodbPassword', () => {
      expect(typeof config.mongodbPassword).toBe('string')
    })
  })

  describe('Session configuration', () => {
    it('should have sessionCookie', () => {
      expect(typeof config.sessionCookie).toBe('string')
      expect(config.sessionCookie.length).toBeGreaterThan(0)
    })

    it('should have sessionMaxAge', () => {
      expect(typeof config.sessionMaxAge).toBe('number')
      expect(config.sessionMaxAge).toBeGreaterThan(0)
    })

    it('should default sessionMaxAge to 7 days', () => {
      const sevenDaysInSeconds = 3600 * 24 * 7
      expect(config.sessionMaxAge).toBe(sevenDaysInSeconds)
    })
  })

  describe('Auth configuration', () => {
    it('should have bootstrapAdminEnabled', () => {
      expect(typeof config.bootstrapAdminEnabled).toBe('boolean')
    })

    it('should have bootstrapAdminUsername', () => {
      expect(typeof config.bootstrapAdminUsername).toBe('string')
      expect(config.bootstrapAdminUsername.length).toBeGreaterThan(0)
    })

    it('should have bootstrapAdminPassword', () => {
      expect(typeof config.bootstrapAdminPassword).toBe('string')
      expect(config.bootstrapAdminPassword.length).toBeGreaterThan(0)
    })
  })

  describe('LLM Model configuration', () => {
    it('should have dsModel', () => {
      expect(typeof config.dsModel).toBe('string')
      expect(config.dsModel.length).toBeGreaterThan(0)
    })

    it('should resolve dsModel (env or default)', () => {
      expect(config.dsModel.length).toBeGreaterThan(0)
    })

    it('should have dsApiKey', () => {
      expect(typeof config.dsApiKey).toBe('string')
    })

    it('should have dsBaseUrl', () => {
      expect(typeof config.dsBaseUrl).toBe('string')
      expect(config.dsBaseUrl.length).toBeGreaterThan(0)
    })

    it('should resolve dsBaseUrl (env or default)', () => {
      expect(config.dsBaseUrl.startsWith('http')).toBe(true)
    })
  })

  describe('Workspace configuration', () => {
    it('should have workspaceDir', () => {
      expect(typeof config.workspaceDir).toBe('string')
      expect(config.workspaceDir.length).toBeGreaterThan(0)
    })

    it('should have toolsDir', () => {
      expect(typeof config.toolsDir).toBe('string')
    })

    it('should have builtinSkillsDir', () => {
      expect(typeof config.builtinSkillsDir).toBe('string')
    })

    it('should have externalSkillsDir', () => {
      expect(typeof config.externalSkillsDir).toBe('string')
    })
  })

  describe('Sandbox configuration', () => {
    it('should have sandboxRestUrl', () => {
      expect(typeof config.sandboxRestUrl).toBe('string')
      expect(config.sandboxRestUrl.length).toBeGreaterThan(0)
    })

    it('should default sandboxRestUrl to localhost', () => {
      expect(config.sandboxRestUrl).toBe('http://localhost:18080')
    })
  })

  describe('CORS configuration', () => {
    it('should have corsOrigins as array', () => {
      expect(Array.isArray(config.corsOrigins)).toBe(true)
    })

    it('should include default localhost origins', () => {
      expect(config.corsOrigins).toContain('http://localhost:5173')
      expect(config.corsOrigins).toContain('http://127.0.0.1:5173')
    })

    it('should parse comma-separated CORS origins', () => {
      // Default should have at least 2 origins
      expect(config.corsOrigins.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('complete config object', () => {
    it('should have all required properties', () => {
      const requiredProps = [
        'port',
        'environment',
        'mongodbHost',
        'mongodbPort',
        'mongodbDbName',
        'mongodbUsername',
        'mongodbPassword',
        'sessionCookie',
        'sessionMaxAge',
        'bootstrapAdminEnabled',
        'bootstrapAdminUsername',
        'bootstrapAdminPassword',
        'dsModel',
        'dsApiKey',
        'dsBaseUrl',
        'workspaceDir',
        'toolsDir',
        'builtinSkillsDir',
        'externalSkillsDir',
        'sandboxRestUrl',
        'corsOrigins'
      ]

      for (const prop of requiredProps) {
        expect(config).toHaveProperty(prop)
      }
    })

    it('should not have undefined properties', () => {
      const values = Object.values(config)
      for (const value of values) {
        expect(value).toBeDefined()
      }
    })
  })
})
