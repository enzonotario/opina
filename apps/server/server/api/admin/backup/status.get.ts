import { requireAdminSession } from '../../../utils/auth'
import { getBackupStatus } from '../../../utils/backup'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return { backup: getBackupStatus() }
})
