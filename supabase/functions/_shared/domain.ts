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

type JsonRecord = Record<string, unknown>

const CATEGORY_POINTS: Readonly<Record<MatchCategory, number>> = {
  snack: 1,
  drink: 2,
  meal: 3,
  special: 5,
}

const SHARE_KEY_PATTERN = /^[a-f0-9]{64}$/
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const MAX_GROUPS = 20
const MAX_MEMBERS = 100
const MAX_MATCHES = 2000
const MAX_STATE_BYTES = 512 * 1024
const MAX_PAID_AMOUNT = 99_999_999

export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const requireRecord = (
  value: unknown,
  code: string,
  message: string,
): JsonRecord => {
  if (!isRecord(value)) throw new ApiError(code, message)
  return value
}

const requireText = (value: unknown, field: string, maxLength: number) => {
  const text = String(value ?? '').trim()
  if (!text || text.length > maxLength) {
    throw new ApiError('INVALID_FIELD', `${field}の値が正しくありません。`)
  }
  return text
}

const optionalText = (value: unknown, maxLength: number) => {
  const text = String(value ?? '').trim()
  if (text.length > maxLength) {
    throw new ApiError('INVALID_FIELD', '入力文字数が上限を超えています。')
  }
  return text
}

const requireIsoDate = (value: unknown, field: string) => {
  const text = requireText(value, field, 40)
  if (Number.isNaN(Date.parse(text))) {
    throw new ApiError('INVALID_FIELD', `${field}の日時が正しくありません。`)
  }
  return text
}

const optionalPaidAmount = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0

  const amount = Number(value)
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > MAX_PAID_AMOUNT
  ) {
    throw new ApiError(
      'INVALID_MATCH',
      'おごった金額は0円以上99,999,999円以下の整数で入力してください。',
    )
  }
  return amount
}

const requireGroup = (state: AppState, groupId: unknown) => {
  const id = requireText(groupId, 'groupId', 120)
  const group = state.groups.find((item) => item.id === id)
  if (!group) throw new ApiError('NOT_FOUND', 'グループが見つかりません。')
  return group
}

const validateMember = (value: unknown): Member => {
  const member = requireRecord(
    value,
    'INVALID_MEMBER',
    'メンバー情報が正しくありません。',
  )
  const color = String(member.color ?? '')

  return {
    id: requireText(member.id, 'member.id', 120),
    name: requireText(member.name, 'member.name', 20),
    color: COLOR_PATTERN.test(color) ? color : '#57508B',
    createdAt: requireIsoDate(member.createdAt, 'member.createdAt'),
  }
}

const validateGroup = (value: unknown): Group => {
  const group = requireRecord(
    value,
    'INVALID_GROUP',
    'グループ情報が正しくありません。',
  )
  const rawMembers = Array.isArray(group.members) ? group.members : []
  if (rawMembers.length > MAX_MEMBERS) {
    throw new ApiError(
      'LIMIT_EXCEEDED',
      '1グループのメンバー上限は100人です。',
    )
  }

  const members = rawMembers.map(validateMember)
  if (new Set(members.map((member) => member.id)).size !== members.length) {
    throw new ApiError('DUPLICATE_ID', 'メンバーIDが重複しています。')
  }

  return {
    id: requireText(group.id, 'group.id', 120),
    name: requireText(group.name, 'group.name', 30),
    emoji: optionalText(group.emoji, 8) || '✊',
    description: optionalText(group.description, 80),
    members,
    createdAt: requireIsoDate(group.createdAt, 'group.createdAt'),
  }
}

const isMatchCategory = (value: string): value is MatchCategory =>
  Object.prototype.hasOwnProperty.call(CATEGORY_POINTS, value)

const validateMatch = (value: unknown, state: AppState): Match => {
  const match = requireRecord(
    value,
    'INVALID_MATCH',
    '勝負記録が正しくありません。',
  )
  const groupId = requireText(match.groupId, 'match.groupId', 120)
  const group = requireGroup(state, groupId)
  const rawParticipantIds = Array.isArray(match.participantIds)
    ? match.participantIds
    : []
  const participantIds = [
    ...new Set(
      rawParticipantIds.map((id) =>
        requireText(id, 'participantId', 120),
      ),
    ),
  ]
  const memberIds = new Set(group.members.map((member) => member.id))

  if (participantIds.length < 2) {
    throw new ApiError('INVALID_MATCH', '参加者は2人以上必要です。')
  }
  if (participantIds.some((id) => !memberIds.has(id))) {
    throw new ApiError(
      'INVALID_MATCH',
      'グループ外の参加者が含まれています。',
    )
  }

  const otokogiId = requireText(match.otokogiId, 'match.otokogiId', 120)
  if (!memberIds.has(otokogiId) || !participantIds.includes(otokogiId)) {
    throw new ApiError(
      'INVALID_MATCH',
      '男気を見せた人の指定が正しくありません。',
    )
  }

  const category = String(match.category ?? '')
  if (!isMatchCategory(category)) {
    throw new ApiError('INVALID_MATCH', '勝負カテゴリが正しくありません。')
  }

  const playedAt = requireText(match.playedAt, 'match.playedAt', 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) {
    throw new ApiError('INVALID_MATCH', '勝負日の形式が正しくありません。')
  }

  return {
    id: requireText(match.id, 'match.id', 120),
    groupId,
    playedAt,
    stake: requireText(match.stake, 'match.stake', 80),
    category,
    otokogiId,
    participantIds,
    points: CATEGORY_POINTS[category],
    paidAmount: optionalPaidAmount(match.paidAmount),
    memo: optionalText(match.memo, 200),
    createdAt: requireIsoDate(match.createdAt, 'match.createdAt'),
  }
}

export const validateShareKey = (value: unknown) => {
  const key = String(value ?? '').toLowerCase()
  if (!SHARE_KEY_PATTERN.test(key)) {
    throw new ApiError('INVALID_KEY', '共有URLが正しくありません。')
  }
  return key
}

export const validateState = (
  value: unknown,
  options: { allowMultipleGroups?: boolean } = {},
): AppState => {
  const rawState = requireRecord(
    value,
    'INVALID_STATE',
    'グループデータの形式が正しくありません。',
  )
  const rawGroups = Array.isArray(rawState.groups) ? rawState.groups : []
  const rawMatches = Array.isArray(rawState.matches) ? rawState.matches : []

  if (rawGroups.length > MAX_GROUPS || rawMatches.length > MAX_MATCHES) {
    throw new ApiError(
      'LIMIT_EXCEEDED',
      '登録できるデータ件数を超えています。',
    )
  }
  if (options.allowMultipleGroups === false && rawGroups.length !== 1) {
    throw new ApiError(
      'INVALID_STATE',
      '共有URLには1つのグループだけ登録できます。',
    )
  }

  const groups = rawGroups.map(validateGroup)
  if (new Set(groups.map((group) => group.id)).size !== groups.length) {
    throw new ApiError('DUPLICATE_ID', 'グループIDが重複しています。')
  }

  const state: AppState = {
    groups,
    matches: [],
    activeGroupId: null,
  }
  state.matches = rawMatches.map((match) => validateMatch(match, state))
  if (new Set(state.matches.map((match) => match.id)).size !== state.matches.length) {
    throw new ApiError('DUPLICATE_ID', '勝負記録IDが重複しています。')
  }

  const requestedActiveId =
    typeof rawState.activeGroupId === 'string'
      ? rawState.activeGroupId
      : null
  state.activeGroupId = groups.some(
    (group) => group.id === requestedActiveId,
  )
    ? requestedActiveId
    : groups[0]?.id ?? null

  if (new TextEncoder().encode(JSON.stringify(state)).byteLength > MAX_STATE_BYTES) {
    throw new ApiError(
      'STATE_TOO_LARGE',
      '記録量が上限に達しました。管理者にお問い合わせください。',
    )
  }

  return state
}

export const applyMutation = (
  currentState: unknown,
  action: string,
  rawPayload: unknown,
) => {
  const state = validateState(currentState)
  const payload = requireRecord(
    rawPayload,
    'INVALID_REQUEST',
    '送信データが正しくありません。',
  )

  if (action === 'addMember') {
    const group = requireGroup(state, payload.groupId)
    const member = validateMember(payload.member)
    if (group.members.some((item) => item.id === member.id)) {
      throw new ApiError(
        'DUPLICATE_ID',
        '同じメンバーがすでに存在します。',
      )
    }
    group.members.push(member)
    return validateState(state)
  }

  if (action === 'deleteGroup') {
    const group = requireGroup(state, payload.groupId)
    state.groups = state.groups.filter((item) => item.id !== group.id)
    state.matches = state.matches.filter((match) => match.groupId !== group.id)
    state.activeGroupId = state.groups[0]?.id ?? null
    return validateState(state)
  }

  if (action === 'createMatch') {
    const match = validateMatch(payload.match, state)
    if (state.matches.some((item) => item.id === match.id)) {
      throw new ApiError(
        'DUPLICATE_ID',
        '同じ勝負記録がすでに存在します。',
      )
    }
    state.matches.unshift(match)
    state.activeGroupId = match.groupId
    return validateState(state)
  }

  if (action === 'deleteMatch') {
    const matchId = requireText(payload.matchId, 'matchId', 120)
    if (!state.matches.some((match) => match.id === matchId)) {
      throw new ApiError(
        'NOT_FOUND',
        '削除する勝負記録が見つかりません。',
      )
    }
    state.matches = state.matches.filter((match) => match.id !== matchId)
    return validateState(state)
  }

  throw new ApiError('UNKNOWN_ACTION', '未対応の操作です。')
}
