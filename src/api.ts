import {
  API_URL,
  isLegacyApiConfigured,
  LEGACY_API_URL,
} from './config'
import type { AppState, Match, Member } from './types'

export interface SharedStateResponse {
  key: string
  version: number
  state: AppState
  updatedAt: string
}

interface ApiSuccess extends SharedStateResponse {
  ok: true
}

interface ApiFailure {
  ok: false
  code: string
  message: string
}

type ApiResponse = ApiSuccess | ApiFailure

export class SharedApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SharedApiError'
    this.code = code
  }
}

const parseResponse = async (response: Response) => {
  let result: ApiResponse

  try {
    result = (await response.json()) as ApiResponse
  } catch {
    throw new SharedApiError(
      'INVALID_RESPONSE',
      '共有サーバーから正しい応答を受け取れませんでした。',
    )
  }

  if (!result.ok) {
    throw new SharedApiError(result.code, result.message)
  }

  if (!response.ok) {
    throw new SharedApiError(
      'HTTP_ERROR',
      '共有サーバーとの通信に失敗しました。',
    )
  }

  return result
}

const get = async (apiUrl: string, key: string) => {
  const url = new URL(apiUrl)
  url.searchParams.set('action', 'get')
  url.searchParams.set('key', key)
  url.searchParams.set('_', Date.now().toString())

  return parseResponse(
    await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    }),
  )
}

const post = async (payload: Record<string, unknown>) =>
  parseResponse(
    await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }),
  )

export const fetchSharedState = async (key: string) => {
  try {
    return await get(API_URL, key)
  } catch (error) {
    const shouldMigrate =
      error instanceof SharedApiError &&
      error.code === 'NOT_FOUND' &&
      isLegacyApiConfigured

    if (!shouldMigrate) throw error

    const legacyResponse = await get(LEGACY_API_URL, key)
    return post({
      action: 'importSpace',
      key,
      state: legacyResponse.state,
    })
  }
}

export const createSharedSpace = (state: AppState) =>
  post({ action: 'createSpace', state })

export const addSharedMember = (
  key: string,
  groupId: string,
  member: Member,
) => post({ action: 'addMember', key, groupId, member })

export const deleteSharedGroup = (key: string, groupId: string) =>
  post({ action: 'deleteGroup', key, groupId })

export const createSharedMatch = (key: string, match: Match) =>
  post({ action: 'createMatch', key, match })

export const deleteSharedMatch = (key: string, matchId: string) =>
  post({ action: 'deleteMatch', key, matchId })
