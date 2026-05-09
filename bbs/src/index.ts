/**
 * BBS+ selective-disclosure primitives for Solidus Network.
 *
 * Wraps {@link https://www.npmjs.com/package/@digitalbazaar/bbs-signatures @digitalbazaar/bbs-signatures}
 * v3.0.0 with a Solidus-shaped API mirroring the conventions of
 * `solidus-crypto::bbs` in the Rust chain crate.
 *
 * Ciphersuite is pinned to `BLS12-381-SHA-256` per IRTF
 * `draft-irtf-cfrg-bbs-signatures`. Verified byte-compatible with
 * `zkryptium` 0.6.1 (the chain's BBS+ implementation) — the same secret
 * key produces the same public key and the chain's signatures verify in
 * this library and vice-versa.
 *
 * Audit posture: testnet-grade. External audit pending via NLnet NGI Zero
 * (H2 2026 target). Do NOT use for production-grade key material until
 * the audit completes.
 */
import {
  CIPHERSUITES,
  generateKeyPair,
  secretKeyToPublicKey,
  sign as bbsSign,
  verifySignature as bbsVerify,
  deriveProof as bbsDeriveProof,
  verifyProof as bbsVerifyProof,
} from '@digitalbazaar/bbs-signatures'

const CIPHERSUITE = CIPHERSUITES.BLS12381_SHA256

// ---------- byte-size constants (match the Rust crate) ----------

/** Serialized size of a BBS+ secret key (BLS12-381 Fr scalar). */
export const BBS_SECRET_KEY_BYTES = 32
/** Serialized size of a BBS+ public key (compressed BLS12-381 G2 point). */
export const BBS_PUBLIC_KEY_BYTES = 96
/** Serialized size of a BBS+ signature. */
export const BBS_SIGNATURE_BYTES = 80
/**
 * Maximum number of messages signed in a single BBS+ credential.
 * Matches `BBS_MAX_MESSAGE_COUNT` in `solidus-txns/src/credential.rs`.
 */
export const BBS_MAX_MESSAGE_COUNT = 64

// ---------- error types ----------

export class BbsError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'BbsError'
  }
}

// ---------- helpers ----------

function assertLen(label: string, got: number, want: number): void {
  if (got !== want) {
    throw new BbsError(`${label}: expected ${want} bytes, got ${got}`)
  }
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

function fromHex(hex: string, label: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) {
    throw new BbsError(`${label} is not valid hex`)
  }
  return new Uint8Array(Buffer.from(hex, 'hex'))
}

// ---------- BbsSecretKey ----------

export class BbsSecretKey {
  private constructor(private readonly bytes: Uint8Array) {
    assertLen('secret key', bytes.length, BBS_SECRET_KEY_BYTES)
  }

  /** Generate a fresh random BBS+ secret key. */
  static async generate(): Promise<BbsSecretKey> {
    const { secretKey } = await generateKeyPair({ ciphersuite: CIPHERSUITE })
    return new BbsSecretKey(new Uint8Array(secretKey))
  }

  /**
   * Generate a BBS+ keypair deterministically from input key material.
   *
   * **Cross-language note:** zkryptium 0.6.1 (the Rust chain crate)
   * implements IRTF draft-10 KeyGen. The wrapped JS library implements an
   * earlier draft revision of KeyGen, so IKM-based derivation produces
   * different SK bytes between the two libraries. Sign/Verify/Proof
   * operations remain byte-compatible — only IKM→SK diverges. For
   * production cross-language workflows, transmit SK bytes directly
   * (via `fromBytes`) rather than re-deriving from IKM.
   */
  static async fromIkm(ikm: Uint8Array): Promise<BbsSecretKey> {
    if (ikm.length < 32) {
      throw new BbsError(`ikm must be ≥ 32 bytes, got ${ikm.length}`)
    }
    const { secretKey } = await generateKeyPair({
      ciphersuite: CIPHERSUITE,
      seed: ikm,
    })
    return new BbsSecretKey(new Uint8Array(secretKey))
  }

  /** Deserialize a 32-byte secret key (big-endian). */
  static fromBytes(bytes: Uint8Array): BbsSecretKey {
    return new BbsSecretKey(new Uint8Array(bytes))
  }

  /** Decode from hex. */
  static fromHex(hex: string): BbsSecretKey {
    const bytes = fromHex(hex, 'secret key')
    assertLen('secret key', bytes.length, BBS_SECRET_KEY_BYTES)
    return new BbsSecretKey(bytes)
  }

  /** Serialize to 32 bytes (big-endian). */
  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }

  /** Encode as lowercase hex. */
  toHex(): string {
    return toHex(this.bytes)
  }

  /** Derive the corresponding public key. */
  async publicKey(): Promise<BbsPublicKey> {
    const pk = await secretKeyToPublicKey({
      secretKey: this.bytes,
      ciphersuite: CIPHERSUITE,
    })
    return BbsPublicKey.fromBytes(new Uint8Array(pk))
  }

  /**
   * Sign a vector of messages with optional context header. Matches
   * `BbsSecretKey::sign(header, messages)` in the Rust crate.
   */
  async sign(header: Uint8Array, messages: Uint8Array[]): Promise<BbsSignature> {
    if (messages.length < 1) {
      throw new BbsError('at least one message is required')
    }
    if (messages.length > BBS_MAX_MESSAGE_COUNT) {
      throw new BbsError(
        `message count ${messages.length} exceeds BBS_MAX_MESSAGE_COUNT (${BBS_MAX_MESSAGE_COUNT})`,
      )
    }
    const pk = await secretKeyToPublicKey({
      secretKey: this.bytes,
      ciphersuite: CIPHERSUITE,
    })
    const sig = await bbsSign({
      secretKey: this.bytes,
      publicKey: pk,
      header,
      messages,
      ciphersuite: CIPHERSUITE,
    })
    return BbsSignature.fromBytes(new Uint8Array(sig))
  }
}

// ---------- BbsPublicKey ----------

export class BbsPublicKey {
  private constructor(private readonly bytes: Uint8Array) {
    assertLen('public key', bytes.length, BBS_PUBLIC_KEY_BYTES)
  }

  static fromBytes(bytes: Uint8Array): BbsPublicKey {
    return new BbsPublicKey(new Uint8Array(bytes))
  }

  static fromHex(hex: string): BbsPublicKey {
    const bytes = fromHex(hex, 'public key')
    assertLen('public key', bytes.length, BBS_PUBLIC_KEY_BYTES)
    return new BbsPublicKey(bytes)
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }

  toHex(): string {
    return toHex(this.bytes)
  }

  equals(other: BbsPublicKey): boolean {
    if (this.bytes.length !== other.bytes.length) return false
    for (let i = 0; i < this.bytes.length; i++) {
      if (this.bytes[i] !== other.bytes[i]) return false
    }
    return true
  }
}

// ---------- BbsSignature ----------

export class BbsSignature {
  private constructor(private readonly bytes: Uint8Array) {
    assertLen('signature', bytes.length, BBS_SIGNATURE_BYTES)
  }

  static fromBytes(bytes: Uint8Array): BbsSignature {
    return new BbsSignature(new Uint8Array(bytes))
  }

  static fromHex(hex: string): BbsSignature {
    const bytes = fromHex(hex, 'signature')
    assertLen('signature', bytes.length, BBS_SIGNATURE_BYTES)
    return new BbsSignature(bytes)
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }

  toHex(): string {
    return toHex(this.bytes)
  }

  /** Verify this signature against a public key, header, and message vector. */
  async verify(
    pk: BbsPublicKey,
    header: Uint8Array,
    messages: Uint8Array[],
  ): Promise<boolean> {
    return bbsVerify({
      publicKey: pk.toBytes(),
      signature: this.bytes,
      header,
      messages,
      ciphersuite: CIPHERSUITE,
    })
  }

  /**
   * Generate a selective-disclosure proof from this signature.
   * `disclosedIndices` must be in strictly ascending order.
   */
  async createProof(opts: {
    pk: BbsPublicKey
    header: Uint8Array
    presentationHeader: Uint8Array
    messages: Uint8Array[]
    disclosedIndices: number[]
  }): Promise<BbsProof> {
    for (let i = 1; i < opts.disclosedIndices.length; i++) {
      if (opts.disclosedIndices[i - 1]! >= opts.disclosedIndices[i]!) {
        throw new BbsError('disclosedIndices must be strictly ascending')
      }
    }
    if (opts.disclosedIndices.some((i) => i < 0 || i >= opts.messages.length)) {
      throw new BbsError('disclosedIndices contains out-of-range value')
    }
    const proof = await bbsDeriveProof({
      publicKey: opts.pk.toBytes(),
      signature: this.bytes,
      header: opts.header,
      presentationHeader: opts.presentationHeader,
      messages: opts.messages,
      disclosedMessageIndexes: opts.disclosedIndices,
      ciphersuite: CIPHERSUITE,
    })
    return BbsProof.fromBytes(new Uint8Array(proof))
  }
}

// ---------- BbsProof ----------

export class BbsProof {
  private constructor(private readonly bytes: Uint8Array) {}

  static fromBytes(bytes: Uint8Array): BbsProof {
    return new BbsProof(new Uint8Array(bytes))
  }

  static fromHex(hex: string): BbsProof {
    return new BbsProof(fromHex(hex, 'proof'))
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.bytes)
  }

  toHex(): string {
    return toHex(this.bytes)
  }

  /**
   * Verify this proof against a public key, header, presentation header,
   * disclosed messages, and the indices those messages occupied in the
   * original signed vector.
   */
  async verify(opts: {
    pk: BbsPublicKey
    header: Uint8Array
    presentationHeader: Uint8Array
    disclosedIndices: number[]
    disclosedMessages: Uint8Array[]
  }): Promise<boolean> {
    if (opts.disclosedIndices.length !== opts.disclosedMessages.length) {
      throw new BbsError('disclosedIndices and disclosedMessages length mismatch')
    }
    return bbsVerifyProof({
      publicKey: opts.pk.toBytes(),
      proof: this.bytes,
      header: opts.header,
      presentationHeader: opts.presentationHeader,
      disclosedMessages: opts.disclosedMessages,
      disclosedMessageIndexes: opts.disclosedIndices,
      ciphersuite: CIPHERSUITE,
    })
  }
}

// ---------- convenience helpers ----------

/** Encode a UTF-8 string as raw bytes (for use as a message or header). */
export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}
