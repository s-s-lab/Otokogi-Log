import { describe, expect, it } from 'vitest'
import {
  ApiError,
  applyMutation,
  type AppState,
  validateShareKey,
  validateState,
} from './domain'

const state = (): AppState => ({
  groups: [
    {
      id: 'group-1',
      name: 'テスト組',
      emoji: '✊',
      description: '',
      createdAt: '2026-07-29T00:00:00.000Z',
      members: [
        {
          id: 'member-1',
          name: '一郎',
          color: '#D1493F',
          createdAt: '2026-07-29T00:00:00.000Z',
        },
        {
          id: 'member-2',
          name: '二郎',
          color: '#1E6A78',
          createdAt: '2026-07-29T00:00:00.000Z',
        },
      ],
    },
  ],
  matches: [],
  activeGroupId: 'group-1',
})

describe('Supabase共有APIのドメイン処理', () => {
  it('64文字の共有キーだけを受け付ける', () => {
    expect(validateShareKey('A'.repeat(64))).toBe('a'.repeat(64))
    expect(() => validateShareKey('short')).toThrow(ApiError)
  })

  it('通常の新規共有は1グループだけに制限する', () => {
    expect(validateState(state(), { allowMultipleGroups: false }).groups).toHaveLength(1)
    expect(() =>
      validateState(
        { ...state(), groups: [state().groups[0], { ...state().groups[0], id: 'group-2' }] },
        { allowMultipleGroups: false },
      ),
    ).toThrow('共有URLには1つのグループだけ登録できます。')
  })

  it('カテゴリ標準値をサーバー側で確定して勝負を追加する', () => {
    const next = applyMutation(state(), 'createMatch', {
      match: {
        id: 'match-1',
        groupId: 'group-1',
        playedAt: '2026-07-29',
        stake: 'ランチ',
        category: 'meal',
        otokogiId: 'member-1',
        participantIds: ['member-1', 'member-2'],
        points: 999,
        paidAmount: 3200,
        memo: '',
        createdAt: '2026-07-29T01:00:00.000Z',
      },
    })

    expect(next.matches[0].points).toBe(3)
    expect(next.matches[0].paidAmount).toBe(3200)
  })

  it('旧記録は0円として互換化し、不正な金額は拒否する', () => {
    const legacy = applyMutation(state(), 'createMatch', {
      match: {
        id: 'match-legacy',
        groupId: 'group-1',
        playedAt: '2026-07-29',
        stake: 'アイス',
        category: 'snack',
        otokogiId: 'member-1',
        participantIds: ['member-1', 'member-2'],
        points: 1,
        memo: '',
        createdAt: '2026-07-29T01:00:00.000Z',
      },
    })
    expect(legacy.matches[0].paidAmount).toBe(0)

    expect(() =>
      applyMutation(state(), 'createMatch', {
        match: {
          id: 'match-invalid-amount',
          groupId: 'group-1',
          playedAt: '2026-07-29',
          stake: 'ランチ',
          category: 'meal',
          otokogiId: 'member-1',
          participantIds: ['member-1', 'member-2'],
          points: 3,
          paidAmount: -1,
          memo: '',
          createdAt: '2026-07-29T01:00:00.000Z',
        },
      }),
    ).toThrow('おごった金額は0円以上99,999,999円以下の整数で入力してください。')
  })

  it('グループ外の参加者を拒否する', () => {
    expect(() =>
      applyMutation(state(), 'createMatch', {
        match: {
          id: 'match-1',
          groupId: 'group-1',
          playedAt: '2026-07-29',
          stake: 'ランチ',
          category: 'meal',
          otokogiId: 'member-1',
          participantIds: ['member-1', 'outsider'],
          points: 3,
          paidAmount: 1500,
          memo: '',
          createdAt: '2026-07-29T01:00:00.000Z',
        },
      }),
    ).toThrow('グループ外の参加者が含まれています。')
  })
})
