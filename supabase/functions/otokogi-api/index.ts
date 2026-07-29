import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.111.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.111.0/cors'
import {
  ApiError,
  applyMutation,
  type AppState,
  validateShareKey,
  validateState,
} from '../_shared/domain.ts'

interface GroupRow {
  id: number
  share_key_hash: string
  version: number
  state: AppState
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type JsonRecord = Record<string, unknown>

const responseHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  })

const errorStatus = (code: string) => {
  if (code === 'NOT_FOUND') return 404
  if (code === 'BUSY' || code === 'CONFLICT') return 409
  if (
    code.startsWith('INVALID_') ||
    code === 'DUPLICATE_ID' ||
    code === 'LIMIT_EXCEEDED' ||
    code === 'STATE_TOO_LARGE' ||
    code === 'UNKNOWN_ACTION'
  ) {
    return 400
  }
  return 500
}

const errorResponse = (error: unknown) => {
  if (error instanceof ApiError) {
    return jsonResponse(
      { ok: false, code: error.code, message: error.message },
      errorStatus(error.code),
    )
  }

  console.error('Unexpected Otokogi API error', error)
  return jsonResponse(
    {
      ok: false,
      code: 'SERVER_ERROR',
      message:
        'サーバーでエラーが発生しました。時間を置いて再度お試しください。',
    },
    500,
  )
}

const getSecretKey = () => {
  const modernKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (modernKeys) {
    try {
      const parsed = JSON.parse(modernKeys) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      throw new Error('SUPABASE_SECRET_KEYS is not valid JSON.')
    }
  }

  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) return legacyKey
  throw new Error('Supabase secret key is unavailable.')
}

const getClient = (): SupabaseClient => {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('SUPABASE_URL is unavailable.')

  return createClient(url, getSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'otokogi-api/1.0',
      },
    },
  })
}

const hashShareKey = async (key: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(key),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

const generateShareKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

const fetchGroup = async (
  client: SupabaseClient,
  shareKeyHash: string,
): Promise<GroupRow> => {
  const { data, error } = await client
    .from('shared_groups')
    .select(
      'id, share_key_hash, version, state, created_at, updated_at, deleted_at',
    )
    .eq('share_key_hash', shareKeyHash)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new ApiError('NOT_FOUND', '共有グループが見つかりません。')
  }
  return data as GroupRow
}

const successPayload = (key: string, row: GroupRow) => ({
  ok: true,
  key,
  version: row.version,
  state: row.state,
  updatedAt: row.updated_at,
})

const appendAudit = async (
  client: SupabaseClient,
  row: GroupRow,
  action: string,
) => {
  const { error } = await client.from('group_audit_log').insert({
    shared_group_id: row.id,
    version: row.version,
    action,
    snapshot: row.state,
    recorded_at: row.updated_at,
  })

  if (error) {
    console.error('Audit insert failed', {
      code: error.code,
      groupId: row.id,
      version: row.version,
    })
  }
}

const createSpace = async (
  client: SupabaseClient,
  rawState: unknown,
  requestedKey?: unknown,
) => {
  const isLegacyImport = requestedKey !== undefined
  const state = validateState(rawState, {
    allowMultipleGroups: isLegacyImport,
  })
  const key = isLegacyImport
    ? validateShareKey(requestedKey)
    : generateShareKey()
  const shareKeyHash = await hashShareKey(key)

  const { data, error } = await client
    .from('shared_groups')
    .insert({
      share_key_hash: shareKeyHash,
      version: 1,
      state,
    })
    .select(
      'id, share_key_hash, version, state, created_at, updated_at, deleted_at',
    )
    .single()

  if (error?.code === '23505' && isLegacyImport) {
    return successPayload(key, await fetchGroup(client, shareKeyHash))
  }
  if (error) throw error

  const row = data as GroupRow
  await appendAudit(client, row, isLegacyImport ? 'importSpace' : 'createSpace')
  return successPayload(key, row)
}

const mutateSpace = async (
  client: SupabaseClient,
  key: string,
  action: string,
  payload: JsonRecord,
) => {
  const shareKeyHash = await hashShareKey(key)

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await fetchGroup(client, shareKeyHash)
    const state = applyMutation(current.state, action, payload)
    const updatedAt = new Date().toISOString()
    const nextVersion = current.version + 1
    const deletedAt =
      action === 'deleteGroup' && state.groups.length === 0
        ? updatedAt
        : null

    const { data, error } = await client
      .from('shared_groups')
      .update({
        state,
        version: nextVersion,
        updated_at: updatedAt,
        deleted_at: deletedAt,
      })
      .eq('id', current.id)
      .eq('version', current.version)
      .is('deleted_at', null)
      .select(
        'id, share_key_hash, version, state, created_at, updated_at, deleted_at',
      )
      .maybeSingle()

    if (error) throw error
    if (!data) continue

    const row = data as GroupRow
    await appendAudit(client, row, action)
    return successPayload(key, row)
  }

  throw new ApiError(
    'BUSY',
    'ほかの更新を処理中です。少し待ってからもう一度お試しください。',
  )
}

const parseBody = async (request: Request): Promise<JsonRecord> => {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 600_000) {
    throw new ApiError('STATE_TOO_LARGE', '送信データが大きすぎます。')
  }

  try {
    const payload = (await request.json()) as unknown
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('not an object')
    }
    return payload as JsonRecord
  } catch {
    throw new ApiError('INVALID_JSON', '送信データを読み取れませんでした。')
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: responseHeaders })
  }

  try {
    const url = new URL(request.url)
    const client = getClient()

    if (request.method === 'GET') {
      const action = url.searchParams.get('action') ?? 'health'
      if (action === 'health') {
        return jsonResponse({
          ok: true,
          service: 'otokogi-supabase-api',
          schemaVersion: 2,
        })
      }
      if (action !== 'get') {
        throw new ApiError('UNKNOWN_ACTION', '未対応の操作です。')
      }

      const key = validateShareKey(url.searchParams.get('key'))
      const row = await fetchGroup(client, await hashShareKey(key))
      return jsonResponse(successPayload(key, row))
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { ok: false, code: 'METHOD_NOT_ALLOWED', message: '未対応の通信方法です。' },
        405,
      )
    }

    const payload = await parseBody(request)
    const action = String(payload.action ?? '')

    if (action === 'createSpace') {
      return jsonResponse(await createSpace(client, payload.state))
    }
    if (action === 'importSpace') {
      return jsonResponse(
        await createSpace(client, payload.state, payload.key),
      )
    }

    const key = validateShareKey(payload.key)
    return jsonResponse(await mutateSpace(client, key, action, payload))
  } catch (error) {
    return errorResponse(error)
  }
})
