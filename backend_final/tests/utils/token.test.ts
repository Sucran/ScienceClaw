import { describe, it, expect } from 'vitest'
import { generateAccessToken, generateRefreshToken } from '../../src/adapters/mongo/token.ts'

describe('Token Utilities', () => {
  describe('generateAccessToken', () => {
    it('should generate a token', () => {
      const token = generateAccessToken()
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should generate token with correct length', () => {
      // 32 bytes base64url encoded
      const token = generateAccessToken()
      // base64url uses 4 characters for every 3 bytes, so 32 bytes = ~43 chars
      expect(token.length).toBeGreaterThanOrEqual(42)
      expect(token.length).toBeLessThanOrEqual(44)
    })

    it('should generate URL-safe tokens', () => {
      const token = generateAccessToken()
      // base64url does not contain + or /
      expect(token).not.toMatch(/[+\/]/)
      // Should not contain padding
      expect(token).not.toMatch(/=+$/)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateAccessToken())
      }
      expect(tokens.size).toBe(100)
    })

    it('should generate non-empty tokens', () => {
      const token = generateAccessToken()
      expect(token.length).toBeGreaterThan(0)
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a token', () => {
      const token = generateRefreshToken()
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should generate token with correct length', () => {
      // 48 bytes base64url encoded
      const token = generateRefreshToken()
      // 48 bytes = ~64 chars
      expect(token.length).toBeGreaterThanOrEqual(63)
      expect(token.length).toBeLessThanOrEqual(65)
    })

    it('should generate longer tokens than access tokens', () => {
      const accessToken = generateAccessToken()
      const refreshToken = generateRefreshToken()
      expect(refreshToken.length).toBeGreaterThan(accessToken.length)
    })

    it('should generate URL-safe tokens', () => {
      const token = generateRefreshToken()
      expect(token).not.toMatch(/[+\/]/)
      expect(token).not.toMatch(/=+$/)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateRefreshToken())
      }
      expect(tokens.size).toBe(100)
    })
  })
})
