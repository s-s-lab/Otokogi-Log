import { sampleState } from './data'
import type { AppState } from './types'

export const STORAGE_KEY = 'otokogi-log-state-v1'
export const RECENT_GROUPS_STORAGE_KEY = 'otokogi-recent-groups-v1'
export const SHARE_KEY_PATTERN = /^[a-f0-9]{64}$/

export interface RecentGroupLink {
  key: string
  groupId: string
  name: string
  emoji: string
  lastOpenedAt: string
}

export const emptyState = (): AppState => ({
  groups: [],
  matches: [],
  activeGroupId: null,
})

export const getShareKeyFromHash = (hash: string) => {
  const match = hash.match(/^#\/group\/([a-f0-9]{64})$/i)
  return match ? match[1].toLowerCase() : null
}

export const buildShareHash = (key: string) => `#/group/${key}`

export const getSingleGroupState = (
  state: AppState,
  groupId: string,
): AppState | null => {
  const group = state.groups.find((item) => item.id === groupId)
  if (!group) return null

  return {
    groups: [group],
    matches: state.matches.filter((match) => match.groupId === groupId),
    activeGroupId: groupId,
  }
}

export const getRecentGroups = (): RecentGroupLink[] => {
  try {
    const saved = localStorage.getItem(RECENT_GROUPS_STORAGE_KEY)
    if (!saved) return []

    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (item): item is RecentGroupLink =>
          Boolean(
            item &&
              typeof item === 'object' &&
              SHARE_KEY_PATTERN.test(String(item.key)) &&
              typeof item.groupId === 'string' &&
              typeof item.name === 'string' &&
              typeof item.emoji === 'string' &&
              typeof item.lastOpenedAt === 'string',
          ),
      )
      .slice(0, 50)
  } catch {
    return []
  }
}

export const rememberRecentGroup = (
  group: Omit<RecentGroupLink, 'lastOpenedAt'>,
) => {
  const next = [
    { ...group, lastOpenedAt: new Date().toISOString() },
    ...getRecentGroups().filter(
      (item) => item.key !== group.key && item.groupId !== group.groupId,
    ),
  ].slice(0, 50)

  try {
    localStorage.setItem(RECENT_GROUPS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The shared URL still works when browser storage is unavailable.
  }

  return next
}

export const forgetRecentGroup = (key: string) => {
  const next = getRecentGroups().filter((item) => item.key !== key)

  try {
    localStorage.setItem(RECENT_GROUPS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures; removing the browser shortcut is optional.
  }

  return next
}

export const getLegacyState = (): AppState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null

    const parsed = JSON.parse(saved) as AppState
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.matches)) {
      return null
    }

    const isUntouchedSample =
      parsed.groups.length === sampleState.groups.length &&
      parsed.matches.length === sampleState.matches.length &&
      parsed.groups[0]?.id === sampleState.groups[0]?.id &&
      parsed.matches.every((match, index) => match.id === sampleState.matches[index]?.id)

    return isUntouchedSample ? null : parsed
  } catch {
    return null
  }
}
