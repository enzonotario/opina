import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const widgetPath = resolve(root, 'apps/server/public/widget.js')

test('built widget exposes Opina.show / Opina.hide', async ({ page }) => {
  const code = readFileSync(widgetPath, 'utf8')
  await page.setContent('<!doctype html><html><body><h1>Host</h1></body></html>')
  await page.evaluate((src) => {
    const script = document.createElement('script')
    script.setAttribute('data-key', 'pk_test_smoke')
    script.textContent = src
    document.body.appendChild(script)
  }, code)

  await expect.poll(async () => {
    return page.evaluate(() => {
      const api = (window as unknown as { Opina?: { show?: unknown, hide?: unknown } }).Opina
      return typeof api?.show === 'function' && typeof api?.hide === 'function'
    })
  }, { timeout: 5000 }).toBe(true)
})
