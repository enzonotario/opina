import { fileURLToPath } from 'node:url'

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
  },

  routeRules: {
    '/widget.js': {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    preset: 'bun',
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
