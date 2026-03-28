CREATE TABLE IF NOT EXISTS stub_signing_key (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  private_key TEXT NOT NULL,
  public_key  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stub_dids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did         TEXT NOT NULL UNIQUE,
  public_key  TEXT NOT NULL,
  controller  TEXT NOT NULL,
  network     TEXT NOT NULL DEFAULT 'stub',
  deactivated BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stub_credentials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id    TEXT NOT NULL UNIQUE,
  subject_did      TEXT NOT NULL,
  issuer_did       TEXT NOT NULL,
  type             TEXT[] NOT NULL,
  claims           JSONB NOT NULL,
  proof_value      TEXT NOT NULL,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  revoked          BOOLEAN NOT NULL DEFAULT false,
  revoked_at       TIMESTAMPTZ,
  network          TEXT NOT NULL DEFAULT 'stub'
);

CREATE TABLE IF NOT EXISTS stub_revocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id TEXT NOT NULL,
  revoked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stub_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge  TEXT NOT NULL UNIQUE,
  domain     TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stub_dids_did      ON stub_dids (did);
CREATE INDEX IF NOT EXISTS idx_stub_creds_subject ON stub_credentials (subject_did);
CREATE INDEX IF NOT EXISTS idx_stub_creds_id      ON stub_credentials (credential_id);
