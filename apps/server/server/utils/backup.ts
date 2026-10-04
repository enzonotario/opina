import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSqlite } from '../db/client'
import { getSetting, setSetting } from './settings'

const execFileAsync = promisify(execFile)

export type BackupStatus = {
  enabled: boolean
  lastRunAt: number | null
  lastOk: boolean | null
  lastError: string | null
  lastKey: string | null
  lastBytes: number | null
  lastFilesKey: string | null
  retention: number
}

type BackupConfig = {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  prefix: string
  retention: number
}

function dataDir() {
  const config = useRuntimeConfig()
  return String(config.opinaDataDir || './data')
}

export function getBackupConfig(): BackupConfig | null {
  const config = useRuntimeConfig()
  const endpoint = String(config.opinaBackupS3Endpoint || '')
  const bucket = String(config.opinaBackupS3Bucket || '')
  const accessKeyId = String(config.opinaBackupS3AccessKeyId || '')
  const secretAccessKey = String(config.opinaBackupS3SecretAccessKey || '')
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: String(config.opinaBackupS3Region || 'auto'),
    prefix: String(config.opinaBackupPrefix || 'opina/').replace(/\/?$/, '/'),
    retention: Math.max(1, Number(config.opinaBackupRetention) || 28),
  }
}

export function getBackupStatus(): BackupStatus {
  const cfg = getBackupConfig()
  const raw = getSetting('backup:last')
  let last: Partial<BackupStatus> = {}
  if (raw) {
    try {
      last = JSON.parse(raw)
    } catch { /* ignore */ }
  }
  return {
    enabled: Boolean(cfg),
    lastRunAt: last.lastRunAt ?? null,
    lastOk: last.lastOk ?? null,
    lastError: last.lastError ?? null,
    lastKey: last.lastKey ?? null,
    lastBytes: last.lastBytes ?? null,
    lastFilesKey: last.lastFilesKey ?? null,
    retention: cfg?.retention ?? (Number(useRuntimeConfig().opinaBackupRetention) || 28),
  }
}

function saveStatus(partial: Partial<BackupStatus>) {
  const current = getBackupStatus()
  const next = { ...current, ...partial, enabled: Boolean(getBackupConfig()) }
  setSetting('backup:last', JSON.stringify(next))
  return next
}

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

function s3(cfg: BackupConfig) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
  })
}

function hasScreenshots(dir: string) {
  const shots = join(dir, 'screenshots')
  if (!existsSync(shots)) return false
  try {
    return readdirSync(shots).some(name => name.endsWith('.jpg') || name.endsWith('.jpeg'))
  } catch {
    return false
  }
}

async function packScreenshots(dir: string, outPath: string) {
  await execFileAsync('tar', ['-czf', outPath, '-C', dir, 'screenshots'])
}

async function uploadFile(
  client: S3Client,
  cfg: BackupConfig,
  key: string,
  path: string,
  contentType: string,
) {
  const bytes = statSync(path).size
  await client.send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: createReadStream(path),
    ContentType: contentType,
    ContentLength: bytes,
  }))
  const head = await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }))
  if (Number(head.ContentLength || 0) !== bytes) {
    throw new Error('Upload size mismatch')
  }
  return bytes
}

function screenshotsKeyForDb(dbKey: string) {
  return dbKey.replace(/\.db\.gz$/, '.screenshots.tar.gz')
}

function retentionKeys(
  dbObjects: Array<{ Key?: string, LastModified?: Date }>,
  retention: number,
) {
  const keep = new Set(dbObjects.slice(0, retention).map(o => o.Key!).filter(Boolean))
  for (const key of [...keep]) keep.add(screenshotsKeyForDb(key))

  const monthly = new Map<string, string>()
  for (const obj of dbObjects.slice(retention)) {
    if (!obj.Key || !obj.LastModified) continue
    const month = `${obj.LastModified.getUTCFullYear()}-${obj.LastModified.getUTCMonth() + 1}`
    if (monthly.has(month) || monthly.size >= 12) continue
    monthly.set(month, obj.Key)
    keep.add(obj.Key)
    keep.add(screenshotsKeyForDb(obj.Key))
  }
  return keep
}

async function prune(cfg: BackupConfig, client: S3Client) {
  const listed = await client.send(new ListObjectsV2Command({
    Bucket: cfg.bucket,
    Prefix: cfg.prefix,
  }))
  const objects = (listed.Contents || [])
    .filter(o => o.Key?.endsWith('.db.gz') || o.Key?.endsWith('.screenshots.tar.gz'))
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))

  const keep = retentionKeys(
    objects.filter(o => o.Key?.endsWith('.db.gz')),
    cfg.retention,
  )

  for (const obj of objects) {
    if (!obj.Key || keep.has(obj.Key)) continue
    await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: obj.Key }))
  }
}

export async function runBackup(): Promise<BackupStatus> {
  const cfg = getBackupConfig()
  if (!cfg) {
    return saveStatus({
      lastRunAt: Date.now(),
      lastOk: false,
      lastError: 'Backups disabled — set OPINA_BACKUP_S3_* env vars',
      lastKey: null,
      lastBytes: null,
      lastFilesKey: null,
    })
  }

  const dir = dataDir()
  const tmpDir = join(dir, 'tmp')
  mkdirSync(tmpDir, { recursive: true })
  const stampStr = stamp()
  const snapPath = join(tmpDir, `opina-${stampStr}.db`)
  const gzPath = `${snapPath}.gz`
  const shotsPath = join(tmpDir, `opina-${stampStr}.screenshots.tar.gz`)
  const key = `${cfg.prefix}opina-${stampStr}.db.gz`
  const filesKey = `${cfg.prefix}opina-${stampStr}.screenshots.tar.gz`
  const cleanup = [snapPath, gzPath, shotsPath]

  try {
    await getSqlite().backup(snapPath)
    await pipeline(createReadStream(snapPath), createGzip(), createWriteStream(gzPath))
    const client = s3(cfg)
    const bytes = await uploadFile(client, cfg, key, gzPath, 'application/gzip')

    let lastFilesKey: string | null = null
    if (hasScreenshots(dir)) {
      await packScreenshots(dir, shotsPath)
      await uploadFile(client, cfg, filesKey, shotsPath, 'application/gzip')
      lastFilesKey = filesKey
    }

    await prune(cfg, client)
    return saveStatus({
      lastRunAt: Date.now(),
      lastOk: true,
      lastError: null,
      lastKey: key,
      lastBytes: bytes,
      lastFilesKey,
    })
  } catch (e) {
    return saveStatus({
      lastRunAt: Date.now(),
      lastOk: false,
      lastError: e instanceof Error ? e.message : 'Backup failed',
      lastKey: null,
      lastBytes: null,
      lastFilesKey: null,
    })
  } finally {
    for (const p of cleanup) {
      if (existsSync(p)) {
        try {
          unlinkSync(p)
        } catch { /* ignore */ }
      }
    }
  }
}
