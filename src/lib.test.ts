import { describe, expect, it } from 'vitest'
import {
  getLevelProgress,
  getOtokogiLevel,
  getScores,
  OTOKOGI_LEVELS,
} from './lib'
import type { Group, Match } from './types'

const group: Group = {
  id: 'g1',
  name: 'テスト',
  emoji: '✊',
  description: '',
  createdAt: '2026-01-01',
  members: [
    { id: 'a', name: 'A', color: '#000', createdAt: '2026-01-01' },
    { id: 'b', name: 'B', color: '#fff', createdAt: '2026-01-02' },
  ],
}

const matches: Match[] = [
  {
    id: 'm1',
    groupId: 'g1',
    playedAt: '2026-01-01',
    stake: 'アイス',
    category: 'snack',
    otokogiId: 'b',
    participantIds: ['a', 'b'],
    points: 1,
    paidAmount: 500,
    memo: '',
    createdAt: '2026-01-01',
  },
  {
    id: 'm2',
    groupId: 'g1',
    playedAt: '2026-01-02',
    stake: 'ランチ',
    category: 'meal',
    otokogiId: 'a',
    participantIds: ['a', 'b'],
    points: 3,
    paidAmount: 2400,
    memo: '',
    createdAt: '2026-01-02',
  },
]

describe('getScores', () => {
  it('ポイント合計の高い順に並べる', () => {
    expect(getScores(group, matches).map((score) => score.member.id)).toEqual([
      'a',
      'b',
    ])
    expect(getScores(group, matches)[0]).toMatchObject({
      points: 3,
      wins: 1,
      paidAmount: 2400,
    })
  })
})

describe('getOtokogiLevel', () => {
  it('10段階のしきい値に応じたレベルを返す', () => {
    const thresholds = [0, 3, 7, 13, 21, 31, 44, 60, 79, 100]

    expect(OTOKOGI_LEVELS).toHaveLength(10)
    thresholds.forEach((points, index) => {
      expect(getOtokogiLevel(points).order).toBe(index + 1)
    })

    expect(getOtokogiLevel(99).shortName).toBe('男気伝説')
    expect(getOtokogiLevel(100).shortName).toBe('男気王')
    expect(getOtokogiLevel(999).shortName).toBe('男気王')
  })

  it('後半ほど昇格に必要なポイント幅が大きくなる', () => {
    const widths = OTOKOGI_LEVELS.slice(0, -1).map(
      (level) => (level.next ?? level.min) - level.min,
    )

    expect(widths).toEqual([3, 4, 6, 8, 10, 13, 16, 19, 21])
    widths.slice(1).forEach((width, index) => {
      expect(width).toBeGreaterThan(widths[index])
    })
  })

  it('現在のランク内で次のレベルまでの進捗を計算する', () => {
    const level = getOtokogiLevel(50)
    expect(getLevelProgress(50, level)).toBeCloseTo(37.5, 2)
    expect(getLevelProgress(120, getOtokogiLevel(120))).toBe(100)
  })
})
