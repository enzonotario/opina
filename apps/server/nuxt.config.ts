import { fileURLToPath } from 'node:url'

// Nuxt's dev worker still runs on Node and cannot load `bun:` builtins.
// Production/Docker sets NITRO_PRESET=bun (or NODE_ENV=production) → bun:sqlite.
const nitroPreset = process.env.NITRO_PRESET
  || (process.env.NODE_ENV === 'production' ? 'bun' : undefined)
const useBunSqlite
  = nitroPreset === 'bun' || process.env.OPINA_SQLITE === 'bun'

const dbDriver = fileURLToPath(
  new URL(
    useBunSqlite ? './server/db/driver.bun.ts' : './server/db/driver.node.ts',
    import.meta.url,
  ),
)

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils',
  ],

  css: ['~/assets/css/main.css'],

  ui: {
    theme: {
      defaultVariants: {
        color: 'neutral',
      },
    },
  },

  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24 * 7, // 1 week
    },
    opinaDataDir: process.env.OPINA_DATA_DIR || './data',
    opinaBackupS3Endpoint: process.env.OPINA_BACKUP_S3_ENDPOINT || '',
    opinaBackupS3Bucket: process.env.OPINA_BACKUP_S3_BUCKET || '',
    opinaBackupS3AccessKeyId: process.env.OPINA_BACKUP_S3_ACCESS_KEY_ID || '',
    opinaBackupS3SecretAccessKey: process.env.OPINA_BACKUP_S3_SECRET_ACCESS_KEY || '',
    opinaBackupS3Region: process.env.OPINA_BACKUP_S3_REGION || 'auto',
    opinaBackupPrefix: process.env.OPINA_BACKUP_PREFIX || 'opina/',
    opinaBackupRetention: process.env.OPINA_BACKUP_RETENTION || '28',
    public: {
      url: process.env.NUXT_PUBLIC_URL || 'http://localhost:3000',
    },
  },

  alias: {
    '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    '#opina-db-driver': dbDriver,
  },

  routeRules: {
    // Short edge+browser TTL so embed script deploys propagate past Cloudflare.
    '/widget.js': {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'CDN-Cache-Control': 'public, max-age=60',
        'Cloudflare-CDN-Cache-Control': 'max-age=60',
      },
    },
    '/capture.js': {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'CDN-Cache-Control': 'public, max-age=60',
        'Cloudflare-CDN-Cache-Control': 'max-age=60',
      },
    },
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: nitroPreset,
    alias: {
      '#opina-db-driver': dbDriver,
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: process.env.OPINA_BACKUP_S3_ENDPOINT
      ? {
          [process.env.OPINA_BACKUP_CRON || '0 */6 * * *']: ['backup:r2'],
        }
      : undefined,
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'always-multiline',
        braceStyle: '1tbs',
      },
    },
  },
})
