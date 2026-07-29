import type { MatchCategory } from './types'

export const MEMBER_COLORS = [
  '#D1493F',
  '#1E6A78',
  '#D28C2F',
  '#57508B',
  '#3E7A52',
  '#B8577E',
  '#426B9A',
]

export const CATEGORY_META: Record<
  MatchCategory,
  { label: string; emoji: string; points: number; description: string }
> = {
  snack: {
    label: 'おやつ',
    emoji: '🍦',
    points: 1,
    description: 'アイス・お菓子など',
  },
  drink: {
    label: 'ドリンク',
    emoji: '🥤',
    points: 2,
    description: 'ジュース・コーヒーなど',
  },
  meal: {
    label: 'ごはん',
    emoji: '🍜',
    points: 3,
    description: 'ランチ・夕食など',
  },
  special: {
    label: '大勝負',
    emoji: '🔥',
    points: 5,
    description: '旅行・記念品など',
  },
}
