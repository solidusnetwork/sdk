export interface AuthResult {
  valid: boolean
  did?: string
  claims?: Record<string, unknown>
  error?: string
}

export interface Challenge {
  challenge: string
  domain: string
  expiresAt: string
}
