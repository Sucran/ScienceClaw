import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/utils/password.ts'

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const hash = await hashPassword('test_password')
      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
    })

    it('should generate a bcrypt hash', async () => {
      const hash = await hashPassword('test_password')
      expect(hash.startsWith('$2')).toBe(true) // bcrypt hashes start with $2a$, $2b$, etc.
    })

    it('should generate different hashes for same password', async () => {
      const hash1 = await hashPassword('test_password')
      const hash2 = await hashPassword('test_password')
      // bcrypt generates unique salts, so hashes should be different
      expect(hash1).not.toBe(hash2)
    })

    it('should generate hash of correct length', async () => {
      const hash = await hashPassword('test')
      // bcrypt hash with cost 12 is typically 60 characters
      expect(hash.length).toBe(60)
    })

    it('should handle empty password', async () => {
      const hash = await hashPassword('')
      expect(hash).toBeDefined()
      expect(hash.length).toBe(60)
    })

    it('should handle long password', async () => {
      const longPassword = 'a'.repeat(1000)
      const hash = await hashPassword(longPassword)
      expect(hash).toBeDefined()
      expect(hash.length).toBe(60)
    })

    it('should handle unicode password', async () => {
      const unicodePassword = '密码テスト🔐'
      const hash = await hashPassword(unicodePassword)
      expect(hash).toBeDefined()
      expect(hash.length).toBe(60)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'test_password'
      const hash = await hashPassword(password)

      const result = await verifyPassword(password, hash)
      expect(result).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const hash = await hashPassword('correct_password')

      const result = await verifyPassword('wrong_password', hash)
      expect(result).toBe(false)
    })

    it('should reject empty password when hash is for non-empty', async () => {
      const hash = await hashPassword('password')

      const result = await verifyPassword('', hash)
      expect(result).toBe(false)
    })

    it('should verify password with unicode', async () => {
      const password = '密码テスト🔐'
      const hash = await hashPassword(password)

      const result = await verifyPassword(password, hash)
      expect(result).toBe(true)
    })

    it('should handle Buffer hash input', async () => {
      const password = 'test_password'
      const hash = await hashPassword(password)
      const hashBuffer = Buffer.from(hash, 'utf-8')

      const result = await verifyPassword(password, hashBuffer)
      expect(result).toBe(true)
    })

    it('should reject invalid hash format', async () => {
      const result = await verifyPassword('password', 'invalid_hash')
      expect(result).toBe(false)
    })

    it('should handle different passwords with same hash length', async () => {
      const hash = await hashPassword('password1')

      const result1 = await verifyPassword('password1', hash)
      const result2 = await verifyPassword('password2', hash)

      expect(result1).toBe(true)
      expect(result2).toBe(false)
    })
  })

  describe('hashPassword and verifyPassword integration', () => {
    it('should work together for password verification', async () => {
      const passwords = [
        'simple',
        'Complex!123',
        '中文密码',
        'emoji🔐password',
        'very_long_password_with_many_characters_that_should_still_work'
      ]

      for (const password of passwords) {
        const hash = await hashPassword(password)
        const verified = await verifyPassword(password, hash)
        expect(verified).toBe(true)
      }
    })

    it('should not verify different passwords', async () => {
      const hash = await hashPassword('correct_password')

      const passwords = [
        'incorrect',
        '',
        'another_wrong',
        'C'
      ]

      for (const password of passwords) {
        const verified = await verifyPassword(password, hash)
        expect(verified).toBe(false)
      }
    })
  })
})
