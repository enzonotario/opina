import { customAlphabet } from 'nanoid'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const nano = customAlphabet(alphabet, 16)

export function createId(prefix: 'usr' | 'prj' | 'srv' | 'rsp' | 'pk' | 'v' | 'job') {
  return `${prefix}_${nano()}`
}
