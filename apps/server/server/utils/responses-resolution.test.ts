import { describe, expect, it } from 'vitest'
import { resolutionFromComment } from './responses'

describe('resolutionFromComment', () => {
  const at = 1_700_000_000_000

  it('marks empty comment as auto-resolved', () => {
    expect(resolutionFromComment(null, at)).toEqual({
      resolved: 1,
      autoResolved: 1,
      resolvedAt: at,
    })
    expect(resolutionFromComment('', at)).toEqual({
      resolved: 1,
      autoResolved: 1,
      resolvedAt: at,
    })
    expect(resolutionFromComment('   ', at)).toEqual({
      resolved: 1,
      autoResolved: 1,
      resolvedAt: at,
    })
  })

  it('leaves comments open', () => {
    expect(resolutionFromComment('Needs follow-up', at)).toEqual({
      resolved: 0,
      autoResolved: 0,
      resolvedAt: null,
    })
  })
})
