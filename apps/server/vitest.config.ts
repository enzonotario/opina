import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#opina-db-driver': fileURLToPath(
        new URL('./server/db/driver.node.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
