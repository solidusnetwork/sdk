// Typed inter-service event definitions for RabbitMQ
// Every service publishes and subscribes to a shared durable exchange

export type SolidusEventType =
  | 'credential.issued'
  | 'credential.revoked'
  | 'did.created'
  | 'verification.completed'
  | 'verification.failed'
  | 'payment.confirmed'

export interface BaseEvent {
  id: string          // UUID, for idempotency
  type: SolidusEventType
  timestamp: string   // ISO 8601
  source: string      // service name, e.g. "verify-backend"
}

export interface CredentialIssuedEvent extends BaseEvent {
  type: 'credential.issued'
  payload: {
    credentialId: string
    subjectDid: string
    issuerDid: string
    credentialType: string[]
    organizationId: string
  }
}

export interface CredentialRevokedEvent extends BaseEvent {
  type: 'credential.revoked'
  payload: {
    credentialId: string
    subjectDid: string
    organizationId: string
  }
}

export interface DidCreatedEvent extends BaseEvent {
  type: 'did.created'
  payload: {
    did: string
    userId?: string
  }
}

export interface VerificationCompletedEvent extends BaseEvent {
  type: 'verification.completed'
  payload: {
    verificationId: string
    organizationId: string
    subjectDid: string
    level: number
    credentialId: string
  }
}

export interface VerificationFailedEvent extends BaseEvent {
  type: 'verification.failed'
  payload: {
    verificationId: string
    organizationId: string
    reason: string
  }
}

export interface PaymentConfirmedEvent extends BaseEvent {
  type: 'payment.confirmed'
  payload: {
    paymentId: string
    organizationId: string
    amountCents: number
    currency: string
  }
}

export type SolidusEvent =
  | CredentialIssuedEvent
  | CredentialRevokedEvent
  | DidCreatedEvent
  | VerificationCompletedEvent
  | VerificationFailedEvent
  | PaymentConfirmedEvent
