import type { Group, Match, Member } from './types'

export interface MemberScore {
  member: Member
  points: number
  wins: number
  paidAmount: number
}

export interface OtokogiLevel {
  order: number
  name: string
  shortName: string
  message: string
  min: number
  next: number | null
  stage: 0 | 1 | 2 | 3 | 4
}

export const OTOKOGI_LEVELS: readonly OtokogiLevel[] = [
  {
    order: 1,
    name: '男気見習い',
    shortName: '見習い',
    message: '勝負はこれから。拳に気合いを込めよう。',
    min: 0,
    next: 3,
    stage: 0,
  },
  {
    order: 2,
    name: '粋な男気ルーキー',
    shortName: 'ルーキー',
    message: 'その一歩が、伝説のはじまり。',
    min: 3,
    next: 7,
    stage: 0,
  },
  {
    order: 3,
    name: '注目の男気ホープ',
    shortName: 'ホープ',
    message: '挑戦の数だけ、男気が磨かれていく。',
    min: 7,
    next: 13,
    stage: 1,
  },
  {
    order: 4,
    name: '頼れる男気番長',
    shortName: '男気番長',
    message: '勝負どころを知る、頼れる存在。',
    min: 13,
    next: 21,
    stage: 1,
  },
  {
    order: 5,
    name: '筋金入りの男気親分',
    shortName: '男気親分',
    message: '仲間を鼓舞する、揺るぎない男気。',
    min: 21,
    next: 31,
    stage: 2,
  },
  {
    order: 6,
    name: '堂々たる男気将軍',
    shortName: '男気将軍',
    message: '迷いのない一手。もはや貫禄が違う。',
    min: 31,
    next: 44,
    stage: 2,
  },
  {
    order: 7,
    name: '威風堂々の男気大将',
    shortName: '男気大将',
    message: 'その一手が、勝負の空気を支配する。',
    min: 44,
    next: 60,
    stage: 3,
  },
  {
    order: 8,
    name: '豪胆無比の男気覇王',
    shortName: '男気覇王',
    message: '豪快な勝負ぶりに、誰もが一目置く。',
    min: 60,
    next: 79,
    stage: 3,
  },
  {
    order: 9,
    name: '語り継がれる男気伝説',
    shortName: '男気伝説',
    message: '数々の武勇伝が、仲間の記憶に刻まれる。',
    min: 79,
    next: 100,
    stage: 3,
  },
  {
    order: 10,
    name: '天下無双の男気王',
    shortName: '男気王',
    message: 'その背中に、みんなの尊敬が集まっている。',
    min: 100,
    next: null,
    stage: 4,
  },
]

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const getScores = (group: Group, matches: Match[]): MemberScore[] => {
  const relevantMatches = matches.filter((match) => match.groupId === group.id)

  return group.members
    .map((member) => {
      const wins = relevantMatches.filter(
        (match) => match.otokogiId === member.id,
      )
      return {
        member,
        points: wins.reduce((sum, match) => sum + match.points, 0),
        wins: wins.length,
        paidAmount: wins.reduce(
          (sum, match) => sum + (match.paidAmount ?? 0),
          0,
        ),
      }
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        a.member.createdAt.localeCompare(b.member.createdAt),
    )
}

export const getOtokogiLevel = (points: number): OtokogiLevel => {
  for (let index = OTOKOGI_LEVELS.length - 1; index >= 0; index -= 1) {
    const level = OTOKOGI_LEVELS[index]
    if (points >= level.min) return level
  }

  return OTOKOGI_LEVELS[0]
}

export const getLevelProgress = (points: number, level: OtokogiLevel) => {
  if (level.next === null) return 100
  const span = level.next - level.min
  return Math.max(0, Math.min(100, ((points - level.min) / span) * 100))
}

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))

export const formatYen = (amount: number) =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount)
