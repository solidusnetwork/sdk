import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    testTimeout: 20000,
    env: {
      SOLIDUS_STUB_DB_URL: 'postgresql://localhost/solidus_stub_test',
      SOLIDUS_SDK_MODE: 'stub',
    },
  },
})
