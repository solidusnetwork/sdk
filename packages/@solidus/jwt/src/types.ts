export interface JWTPayload {
  sub: string
  iss?: string
  aud?: string
  iat?: number
  exp?: number
  type: 'access' | 'refresh' | 'api-key'
  [key: string]: unknown
}

export interface SignOptions {
  /** Duration string: '15m', '7d', '365d'. Units: s, m, h, d */
  expiresIn?: string
  issuer?: string
  audience?: string
}

export interface VerifyOptions {
  issuer?: string
  audience?: string
}

export const TOKEN_TTL = {
  ACCESS: '15m',
  REFRESH: '7d',
  API_KEY: '365d',
} as const

export class JWTExpiredError extends Error {
  constructor(message = 'Token expired') {
    super(message)
    this.name = 'JWTExpiredError'
  }
}

export class JWTInvalidError extends Error {
  constructor(message = 'Invalid token') {
    super(message)
    this.name = 'JWTInvalidError'
  }
}
