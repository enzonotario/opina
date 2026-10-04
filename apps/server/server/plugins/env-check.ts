import { assertSessionPasswordSafe } from '../utils/env-check'

export default defineNitroPlugin(() => {
  assertSessionPasswordSafe()
})
