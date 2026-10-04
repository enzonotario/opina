import { getBackupConfig, runBackup } from '../../utils/backup'

export default defineTask({
  meta: {
    name: 'backup:r2',
    description: 'Snapshot SQLite to S3-compatible storage (R2)',
  },
  async run() {
    if (!getBackupConfig()) {
      return { result: 'skipped', reason: 'backups disabled' }
    }
    const status = await runBackup()
    return { result: status.lastOk ? 'ok' : 'error', status }
  },
})
