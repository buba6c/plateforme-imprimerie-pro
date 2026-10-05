import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://evocom:evocom_dev@localhost:5432/evocom_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-0123456789',
      // Un dossier par suite lancée en parallèle (helpers.app() le vide au démarrage).
      STORAGE_DIR: process.env.TEST_STORAGE_DIR ?? '/tmp/evocom-test-storage',
    },
  },
});
