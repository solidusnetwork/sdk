import { describe, it, expect, beforeAll } from 'vitest'
import * as ed from '@noble/ed25519'
import { sign } from '../sign.js'
import { verify } from '../verify.js'
import { JWTExpiredError, JWTInvalidError, TOKEN_TTL } from '../types.js'

describe('@solidus/jwt', () => {
  let privateKey: Uint8Array
  let publicKey: Uint8Array

  beforeAll(async () => {
    privateKey = ed.utils.randomPrivateKey()
    publicKey = await ed.getPublicKeyAsync(privateKey)
  })

  describe('sign + verify roundtrip', () => {
    it('encodes and decodes payload correctly', async () => {
      const token = await sign(
        { sub: 'user-123', type: 'access' },
        privateKey,
        { expiresIn: '1h' },
      )
      const decoded = await verify(token, publicKey)
      expect(decoded.sub).toBe('user-123')
      expect(decoded.type).toBe('access')
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
    })

    it('respects expiresIn option', async () => {
      const before = Math.floor(Date.now() / 1000)
      const token = await sign({ sub: 'u', type: 'access' }, privateKey, {
        expiresIn: '30s',
      })
      const payload = await verify(token, publicKey)
      expect(payload.exp).toBeGreaterThanOrEqual(before + 30)
      expect(payload.exp).toBeLessThanOrEqual(before + 32)
    })

    it('preserves exp if already set in payload', async () => {
      const fixedExp = Math.floor(Date.now() / 1000) + 9999
      const token = await sign(
        { sub: 'u', type: 'access', exp: fixedExp },
        privateKey,
        { expiresIn: '1h' },
      )
      const payload = await verify(token, publicKey)
      expect(payload.exp).toBe(fixedExp)
    })

    it('sets issuer and audience from options', async () => {
      const token = await sign({ sub: 'u', type: 'access' }, privateKey, {
        issuer: 'solidus-verify',
        audience: 'solidus-api',
      })
      const payload = await verify(token, publicKey, {
        issuer: 'solidus-verify',
        audience: 'solidus-api',
      })
      expect(payload.iss).toBe('solidus-verify')
      expect(payload.aud).toBe('solidus-api')
    })
  })

  describe('verify error cases', () => {
    it('throws JWTExpiredError for expired token', async () => {
      const token = await sign(
        { sub: 'u', type: 'access', exp: Math.floor(Date.now() / 1000) - 60 },
        privateKey,
      )
      await expect(verify(token, publicKey)).rejects.toThrow(JWTExpiredError)
    })

    it('throws JWTInvalidError for wrong public key', async () => {
      const otherKey = ed.utils.randomPrivateKey()
      const otherPublic = await ed.getPublicKeyAsync(otherKey)
      const token = await sign({ sub: 'u', type: 'access' }, privateKey, {
        expiresIn: '1h',
      })
      await expect(verify(token, otherPublic)).rejects.toThrow(JWTInvalidError)
    })

    it('throws JWTInvalidError for tampered token', async () => {
      const token = await sign({ sub: 'u', type: 'access' }, privateKey, {
        expiresIn: '1h',
      })
      const [h, , s] = token.split('.')
      const tampered = `${h}.${Buffer.from('{"sub":"hacked","type":"access"}').toString('base64url')}.${s}`
      await expect(verify(tampered, publicKey)).rejects.toThrow(JWTInvalidError)
    })

    it('throws JWTInvalidError for malformed token', async () => {
      await expect(verify('not.a.valid.jwt.string', publicKey)).rejects.toThrow(
        JWTInvalidError,
      )
    })

    it('throws JWTInvalidError for issuer mismatch', async () => {
      const token = await sign({ sub: 'u', type: 'access' }, privateKey, {
        issuer: 'solidus-verify',
        expiresIn: '1h',
      })
      await expect(
        verify(token, publicKey, { issuer: 'wrong-issuer' }),
      ).rejects.toThrow(JWTInvalidError)
    })
  })

  describe('sign error cases', () => {
    it('throws if privateKey is not 32 bytes', async () => {
      await expect(
        sign({ sub: 'u', type: 'access' }, new Uint8Array(16)),
      ).rejects.toThrow('privateKey must be 32 bytes')
    })
  })

  describe('TOKEN_TTL', () => {
    it('exports correct duration strings', () => {
      expect(TOKEN_TTL.ACCESS).toBe('15m')
      expect(TOKEN_TTL.REFRESH).toBe('7d')
      expect(TOKEN_TTL.API_KEY).toBe('365d')
    })
  })
})
