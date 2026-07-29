export type MatchCategory = 'snack' | 'drink' | 'meal' | 'special'

export interface Member {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface Group {
  id: string
  name: string
  emoji: string
  description: string
  members: Member[]
  createdAt: string
}

export interface Match {
  id: string
  groupId: string
  playedAt: string
  stake: string
  category: MatchCategory
  otokogiId: string
  participantIds: string[]
  points: number
  paidAmount: number
  memo: string
  createdAt: string
}

export interface AppState {
  groups: Group[]
  matches: Match[]
  activeGroupId: string | null
}

export type ViewName = 'home' | 'groups' | 'history' | 'ranks'
