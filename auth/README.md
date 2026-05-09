# @solidus/auth

DID-based authentication primitives for the [Solidus Network](https://solidus.network) protocol.

Ed25519 challenge / signature / verification, designed to drop into any Node.js or edge backend that needs to authenticate a holder of a DID without operating its own user database.

## Install

```bash
npm install @solidus/auth
# or
pnpm add @solidus/auth
```

## Quick start

```ts
import { generateChallenge, verifyChallenge } from '@solidus/auth'

// Server: issue a challenge
const challenge = generateChallenge({
  did: 'did:solidus:testnet:abc123',
  domain: 'app.example.com',
  ttlMs: 5 * 60_000,
})

// Client signs `challenge.nonce` with the DID's signing key, returns the signature

// Server: verify
const result = await verifyChallenge({
  challenge,
  signature,
  publicKey,
})

if (result.ok) {
  // authenticated
}
```

## Features

- Ed25519 signature verification via [@noble/ed25519](https://www.npmjs.com/package/@noble/ed25519)
- BLAKE3 hashing for challenge digests via [@noble/hashes](https://www.npmjs.com/package/@noble/hashes)
- Time-bounded challenges with TTL enforcement
- Domain-bound challenges (prevents replay across origins)
- Zero runtime dependencies on a database or framework

## License

Apache-2.0 — see [LICENSE](./LICENSE).
