import { printSetupUrl } from '../utils/setup-token'

export default defineNitroPlugin(() => {
  printSetupUrl()
})
