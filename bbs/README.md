# @solidus/bbs

BBS+ selective-disclosure primitives for Solidus Network. Wraps
[`@digitalbazaar/bbs-signatures`](https://www.npmjs.com/package/@digitalbazaar/bbs-signatures)
v3.0.0 with a Solidus-shaped API mirroring `solidus-crypto::bbs` in the
Rust chain crate.

**Ciphersuite:** `BLS12-381-SHA-256` per IRTF
[`draft-irtf-cfrg-bbs-signatures`](https://www.ietf.org/archive/id/draft-irtf-cfrg-bbs-signatures-10.html).

**Compatibility:** byte-compatible with the Solidus chain's BBS+
implementation (zkryptium 0.6.1) for Sign / Verify / ProofGen /
ProofVerify, verified by reproducing `solidus-crypto::bbs` test vectors
in this package's vitest suite. The same secret key bytes produce the
same public key bytes in both libraries, and signatures generated in
one verify in the other.

**One known divergence:** IKM→SK derivation. zkryptium uses IRTF
draft-10 `KeyGen`, while `@digitalbazaar/bbs-signatures` 3.0.0 uses
an earlier draft. Same IKM → different SK bytes across the two
libraries. Practical impact: zero for production (transmit SK bytes
directly, or generate randomly). Just don't expect IKM-based keygen
to roundtrip across languages.

**Audit posture:** testnet-grade. External audit pending via NLnet NGI
Zero (H2 2026 target). Do **not** use for production-grade key
material until the audit completes.

## Install

```sh
npm install @solidus/bbs
```

> Published on npm as `@solidus-network/bbs` (the public scope).

## Usage

```ts
import {
  BbsSecretKey,
  BbsPublicKey,
  BbsSignature,
  utf8,
} from '@solidus/bbs'

// Issuer side
const sk = await BbsSecretKey.generate()
const pk = await sk.publicKey()
const header = utf8('did:solidus:testnet:issuer-1')
const messages = [
  utf8('did:solidus:testnet:alice'),
  utf8('Alice Liddell'),
  utf8('1990-07-04'),
  utf8('GB'),
]
const sig = await sk.sign(header, messages)

// Verifier side
const valid = await sig.verify(pk, header, messages)

// Selective disclosure (holder side)
const proof = await sig.createProof({
  pk,
  header,
  presentationHeader: utf8('verifier-challenge-nonce'),
  messages,
  disclosedIndices: [0, 3], // reveal DID and country only
})

// Verifier-side proof check
const ok = await proof.verify({
  pk,
  header,
  presentationHeader: utf8('verifier-challenge-nonce'),
  disclosedIndices: [0, 3],
  disclosedMessages: [messages[0], messages[3]],
})
```

## Sizes

| Element | Bytes |
|---------|-------|
| Secret key (Fr scalar) | 32 |
| Public key (compressed BLS12-381 G2) | 96 |
| Signature | 80 |
| Proof (variable) | depends on undisclosed-message count |

## Out of scope

- ZK predicate proofs (e.g., proving `age ≥ 18` without revealing DOB)
  — needs Bulletproofs or Plonk on top of BBS+. Tracked under the
  Solidus Groth16/Plonk decision date 2026-07-31.
- Blind signing — supported by zkryptium, not yet exposed here.

## License

Apache-2.0.
