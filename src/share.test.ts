import { describe, expect, it } from 'vitest'
import { buildShareHash, getShareKeyFromHash, getSingleGroupState } from './share'
import type { AppState } from './types'

describe('shared URL helpers', () => {
  const key = 'a'.repeat(64)

  it('reads a valid share key from the URL hash', () => {
    expect(getShareKeyFromHash(`#/group/${key}`)).toBe(key)
  })

  it('rejects malformed share hashes', () => {
    expect(getShareKeyFromHash('#/group/short')).toBeNull()
    expect(getShareKeyFromHash('#/other/' + key)).toBeNull()
  })

  it('builds the canonical group hash', () => {
    expect(buildShareHash(key)).toBe(`#/group/${key}`)
  })

  it('extracts one group and only its matches for a dedicated URL', () => {
    const state = {
      groups: [
        { id: 'a', name: 'A', emoji: '✊', description: '', members: [], createdAt: '' },
        { id: 'b', name: 'B', emoji: '🔥', description: '', members: [], createdAt: '' },
      ],
      matches: [
        {
          id: 'match-a',
          groupId: 'a',
          playedAt: '2026-07-29',
          stake: 'ランチ',
          category: 'meal',
          otokogiId: 'member-a',
          participantIds: ['member-a', 'member-b'],
          points: 3,
          paidAmount: 2000,
          memo: '',
          createdAt: '',
        },
        {
          id: 'match-b',
          groupId: 'b',
          playedAt: '2026-07-29',
          stake: 'ドリンク',
          category: 'drink',
          otokogiId: 'member-c',
          participantIds: ['member-c', 'member-d'],
          points: 2,
          paidAmount: 600,
          memo: '',
          createdAt: '',
        },
      ],
      activeGroupId: 'a',
    } satisfies AppState

    expect(getSingleGroupState(state, 'b')).toEqual({
      groups: [state.groups[1]],
      matches: [state.matches[1]],
      activeGroupId: 'b',
    })
    expect(getSingleGroupState(state, 'missing')).toBeNull()
  })
})
