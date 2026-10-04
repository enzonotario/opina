type Bucket = { tokens: number, updatedAt: number }

const buckets = new Map<string, Bucket>()

const CAPACITY = Number(process.env.OPINA_RATE_LIMIT_PER_MIN || 30)
const REFILL_PER_MS = CAPACITY / 60_000
const LOGIN_CAPACITY = Number(process.env.OPINA_LOGIN_RATE_LIMIT_PER_MIN || 10)
const LOGIN_REFILL_PER_MS = LOGIN_CAPACITY / 60_000
const STALE_MS = 10 * 60_000
const MAX_KEYS = 5_000

function refill(bucket: Bucket, now: number, capacity: number, refillPerMs: number) {
  const elapsed = now - bucket.updatedAt
  return Math.min(capacity, bucket.tokens + elapsed * refillPerMs)
}

function dropOldestHalf() {
  const sorted = [...buckets.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)
  for (const [key] of sorted.slice(0, Math.floor(sorted.length / 2))) {
    buckets.delete(key)
  }
}

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > STALE_MS) buckets.delete(key)
  }
  if (buckets.size > MAX_KEYS) dropOldestHalf()
}

function consume(
  key: string,
  cost: number,
  capacity: number,
  refillPerMs: number,
): boolean {
  const now = Date.now()
  sweep(now)
  const current = buckets.get(key) || { tokens: capacity, updatedAt: now }
  const tokens = refill(current, now, capacity, refillPerMs)
  if (tokens < cost) {
    buckets.set(key, { tokens, updatedAt: now })
    return false
  }
  buckets.set(key, { tokens: tokens - cost, updatedAt: now })
  return true
}

/** In-memory only — never write client IPs to disk. */
export function consumeRateLimit(key: string, cost = 1): boolean {
  return consume(key, cost, CAPACITY, REFILL_PER_MS)
}

export function consumeLoginRateLimit(key: string, cost = 1): boolean {
  return consume(`login:${key}`, cost, LOGIN_CAPACITY, LOGIN_REFILL_PER_MS)
}

export function resetRateLimitForTests() {
  buckets.clear()
}
