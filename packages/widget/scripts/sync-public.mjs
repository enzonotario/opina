import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const publicDir = resolve(root, '../../apps/server/public')

mkdirSync(publicDir, { recursive: true })

for (const file of ['widget.js', 'capture.js']) {
  copyFileSync(resolve(dist, file), resolve(publicDir, file))
  rmSync(resolve(publicDir, `${file}.map`), { force: true })
  rmSync(resolve(dist, `${file}.map`), { force: true })
}
