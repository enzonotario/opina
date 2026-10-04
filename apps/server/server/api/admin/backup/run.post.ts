import { requireAdminSession } from '../../../utils/auth'
import { getBackupConfig, runBackup } from '../../../utils/backup'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  if (!getBackupConfig()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Backups disabled — set OPINA_BACKUP_S3_* env vars',
    })
  }
  const backup = await runBackup()
  if (!backup.lastOk) {
    throw createError({
      statusCode: 500,
      statusMessage: backup.lastError || 'Backup failed',
    })
  }
  return { backup }
})
