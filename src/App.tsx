import {
  Archive,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  CloudOff,
  Copy,
  Crown,
  Flame,
  Home,
  LoaderCircle,
  Medal,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  addSharedMember,
  createSharedMatch,
  createSharedSpace,
  deleteSharedGroup,
  deleteSharedMatch,
  fetchSharedState,
  type SharedStateResponse,
} from './api'
import { isApiConfigured } from './config'
import { CATEGORY_META, MEMBER_COLORS } from './constants'
import {
  formatDate,
  formatYen,
  getLevelProgress,
  getOtokogiLevel,
  getScores,
  OTOKOGI_LEVELS,
  uid,
} from './lib'
import type {
  AppState,
  Group,
  Match,
  MatchCategory,
  ViewName,
} from './types'
import { OtokogiIllustration } from './components/OtokogiIllustration'
import {
  buildShareHash,
  emptyState,
  forgetRecentGroup,
  getLegacyState,
  getRecentGroups,
  getSingleGroupState,
  getShareKeyFromHash,
  rememberRecentGroup,
  type RecentGroupLink,
} from './share'

type SyncStatus =
  | 'unconfigured'
  | 'idle'
  | 'loading'
  | 'saving'
  | 'synced'
  | 'error'

function App() {
  const [state, setState] = useState<AppState>(emptyState)
  const [shareKey, setShareKey] = useState(() =>
    getShareKeyFromHash(window.location.hash),
  )
  const [legacyState, setLegacyState] = useState<AppState | null>(getLegacyState)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isApiConfigured ? 'idle' : 'unconfigured',
  )
  const [syncError, setSyncError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [view, setView] = useState<ViewName>('home')
  const [recordOpen, setRecordOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [recentGroups, setRecentGroups] =
    useState<RecentGroupLink[]>(getRecentGroups)
  const migrationInFlight = useRef(false)

  const adoptResponse = useCallback(
    (response: SharedStateResponse, preferredGroupId?: string | null) => {
      const nextState = response.state
      setState((current) => {
        const preferredId =
          preferredGroupId === undefined
            ? current.activeGroupId
            : preferredGroupId
        const activeGroupId =
          preferredId &&
          nextState.groups.some((group) => group.id === preferredId)
            ? preferredId
            : nextState.activeGroupId

        return { ...nextState, activeGroupId }
      })
      setLastSyncedAt(response.updatedAt)
      setSyncStatus('synced')
      setSyncError('')

      const group =
        nextState.groups.find((item) => item.id === nextState.activeGroupId) ??
        nextState.groups[0]
      if (group) {
        setRecentGroups(
          rememberRecentGroup({
            key: response.key,
            groupId: group.id,
            name: group.name,
            emoji: group.emoji,
          }),
        )
      }
    },
    [],
  )

  const splitLegacySharedSpace = useCallback(
    async (response: SharedStateResponse) => {
      if (!shareKey || response.state.groups.length < 2) {
        adoptResponse(response)
        return
      }

      const activeGroup =
        response.state.groups.find(
          (group) => group.id === response.state.activeGroupId,
        ) ?? response.state.groups[0]
      const otherGroups = response.state.groups.filter(
        (group) => group.id !== activeGroup.id,
      )

      setSyncStatus('saving')

      for (const group of otherGroups) {
        const existingLink = getRecentGroups().find(
          (item) => item.groupId === group.id && item.key !== shareKey,
        )
        if (existingLink) continue

        const singleGroupState = getSingleGroupState(response.state, group.id)
        if (!singleGroupState) continue

        const created = await createSharedSpace(singleGroupState)
        setRecentGroups(
          rememberRecentGroup({
            key: created.key,
            groupId: group.id,
            name: group.name,
            emoji: group.emoji,
          }),
        )
      }

      let compactedResponse = response
      for (const group of otherGroups) {
        compactedResponse = await deleteSharedGroup(shareKey, group.id)
      }

      adoptResponse(compactedResponse, activeGroup.id)
      setNotice(
        '共有リンクをグループごとに分離しました。参加中グループから個別に開けます。',
      )
    },
    [adoptResponse, shareKey],
  )

  const loadRemoteState = useCallback(
    async (silent = false) => {
      if (!shareKey || !isApiConfigured) return
      if (migrationInFlight.current) return
      if (!silent) setSyncStatus('loading')

      try {
        const response = await fetchSharedState(shareKey)
        if (response.state.groups.length > 1) {
          migrationInFlight.current = true
          await splitLegacySharedSpace(response)
        } else {
          adoptResponse(response)
        }
      } catch (error) {
        setSyncStatus('error')
        setSyncError(
          error instanceof Error
            ? error.message
            : '共有データを読み込めませんでした。',
        )
      } finally {
        migrationInFlight.current = false
      }
    },
    [adoptResponse, shareKey, splitLegacySharedSpace],
  )

  useEffect(() => {
    const onHashChange = () => {
      const nextKey = getShareKeyFromHash(window.location.hash)
      setShareKey(nextKey)
      setState(emptyState())
      setView('home')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!shareKey || !isApiConfigured) return
    void loadRemoteState()

    const refreshOnFocus = () => void loadRemoteState(true)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRemoteState(true)
    }, 30000)
    window.addEventListener('focus', refreshOnFocus)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [loadRemoteState, shareKey])

  useEffect(() => {
    if (!notice) return
    const timeoutId = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [notice])

  const activeGroup =
    state.groups.find((group) => group.id === state.activeGroupId) ??
    state.groups[0] ??
    null

  const changeView = (nextView: ViewName) => {
    setView(nextView)
    setMobileMenuOpen(false)
  }

  const selectGroup = (groupId: string) => {
    setState((current) => ({ ...current, activeGroupId: groupId }))
  }

  const navigateToShareKey = (key: string) => {
    const nextHash = buildShareHash(key)
    if (window.location.hash === nextHash) {
      setShareKey(key)
      return
    }
    window.location.hash = nextHash
  }

  const openRecentGroup = (key: string) => {
    navigateToShareKey(key)
    setView('home')
  }

  const removeRecentGroup = (key: string) => {
    setRecentGroups(forgetRecentGroup(key))
  }

  const handleMutationError = (error: unknown) => {
    setSyncStatus('error')
    setSyncError(
      error instanceof Error
        ? error.message
        : '更新を保存できませんでした。もう一度お試しください。',
    )
  }

  const createGroup = async (input: {
    name: string
    description: string
    emoji: string
    memberNames: string[]
  }) => {
    const createdAt = new Date().toISOString()
    const group: Group = {
      id: uid('group'),
      name: input.name,
      description: input.description,
      emoji: input.emoji,
      createdAt,
      members: input.memberNames.map((name, index) => ({
        id: uid('member'),
        name,
        color: MEMBER_COLORS[index % MEMBER_COLORS.length],
        createdAt,
      })),
    }

    if (!isApiConfigured) {
      setSyncError('共有バックエンドの公開設定がまだ完了していません。')
      return
    }

    setSyncStatus('saving')
    try {
      const response = await createSharedSpace({
        groups: [group],
        matches: [],
        activeGroupId: group.id,
      })
      adoptResponse(response, group.id)
      navigateToShareKey(response.key)
      setGroupOpen(false)
      setView('home')
      setNotice(
        'グループ専用URLを発行しました。このURLではこのグループだけを共有します。',
      )
    } catch (error) {
      handleMutationError(error)
    }
  }

  const addMember = async (groupId: string, name: string) => {
    const cleanedName = name.trim()
    const group = state.groups.find((item) => item.id === groupId)
    if (!cleanedName || !group || !shareKey) return

    setSyncStatus('saving')
    try {
      const response = await addSharedMember(shareKey, groupId, {
        id: uid('member'),
        name: cleanedName,
        color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
        createdAt: new Date().toISOString(),
      })
      adoptResponse(response, groupId)
    } catch (error) {
      handleMutationError(error)
    }
  }

  const deleteGroup = async (groupId: string) => {
    const group = state.groups.find((item) => item.id === groupId)
    if (
      !group ||
      !shareKey ||
      !window.confirm(
        `「${group.name}」と、このグループの勝負記録を削除しますか？`,
      )
    ) {
      return
    }

    setSyncStatus('saving')
    try {
      const response = await deleteSharedGroup(shareKey, groupId)
      adoptResponse(response)
      setRecentGroups(forgetRecentGroup(shareKey))
      window.location.hash = ''
      setShareKey(null)
      setState(emptyState())
      setView('home')
      setNotice('グループを削除しました。')
    } catch (error) {
      handleMutationError(error)
    }
  }

  const createMatch = async (match: Omit<Match, 'id' | 'createdAt'>) => {
    if (!shareKey) return
    setSyncStatus('saving')

    try {
      const response = await createSharedMatch(shareKey, {
        ...match,
        id: uid('match'),
        createdAt: new Date().toISOString(),
      })
      adoptResponse(response, match.groupId)
      setRecordOpen(false)
      setView('home')
    } catch (error) {
      handleMutationError(error)
    }
  }

  const deleteMatch = async (matchId: string) => {
    if (!shareKey || !window.confirm('この勝負記録を削除しますか？')) return
    setSyncStatus('saving')

    try {
      const response = await deleteSharedMatch(shareKey, matchId)
      adoptResponse(response, activeGroup?.id)
    } catch (error) {
      handleMutationError(error)
    }
  }

  const importLegacyData = async () => {
    if (!legacyState || !isApiConfigured) return
    if (
      !window.confirm(
        'この端末に保存されているグループと勝負記録を、共有データとして登録しますか？',
      )
    ) {
      return
    }

    setSyncStatus('saving')
    try {
      const preferredGroup =
        legacyState.groups.find(
          (group) => group.id === legacyState.activeGroupId,
        ) ?? legacyState.groups[0]
      let preferredResponse: SharedStateResponse | null = null

      for (const group of legacyState.groups) {
        const singleGroupState = getSingleGroupState(legacyState, group.id)
        if (!singleGroupState) continue

        const response = await createSharedSpace(singleGroupState)
        setRecentGroups(
          rememberRecentGroup({
            key: response.key,
            groupId: group.id,
            name: group.name,
            emoji: group.emoji,
          }),
        )
        if (group.id === preferredGroup?.id) preferredResponse = response
      }

      if (!preferredResponse) {
        throw new Error('移行できるグループが見つかりませんでした。')
      }

      adoptResponse(preferredResponse, preferredGroup?.id)
      navigateToShareKey(preferredResponse.key)
      setLegacyState(null)
      setNotice(
        '端末の記録をグループ別の共有URLへ移行しました。参加中グループから切り替えられます。',
      )
    } catch (error) {
      handleMutationError(error)
    }
  }

  const shareCurrentUrl = async () => {
    const url = window.location.href
    const groupName = activeGroup?.name ?? '男気録'

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${groupName} | 男気録`,
          text: '男気じゃんけんの記録を一緒に更新しよう。',
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        setNotice('共有URLをコピーしました。')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setNotice('共有URLをコピーしました。')
      } catch {
        setSyncError('共有URLをコピーできませんでした。')
      }
    }
  }

  return (
    <div className="app-shell">
      <Header
        groups={state.groups}
        activeGroup={activeGroup}
        view={view}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMenu={() => setMobileMenuOpen((open) => !open)}
        onNavigate={changeView}
        onSelectGroup={selectGroup}
        onCreateGroup={() => setGroupOpen(true)}
        onCreateMatch={() => setRecordOpen(true)}
        hasShareKey={Boolean(shareKey)}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        onRefresh={() => void loadRemoteState()}
        onShare={() => void shareCurrentUrl()}
      />

      <main className="main-content">
        {syncError && (
          <div className="sync-alert" role="alert">
            <CloudOff size={19} />
            <span>{syncError}</span>
            {shareKey && isApiConfigured && (
              <button type="button" onClick={() => void loadRemoteState()}>
                再読み込み
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="sync-notice" role="status">
            <Check size={18} />
            {notice}
          </div>
        )}
        {view === 'home' && (
          <>
            {syncStatus === 'loading' && shareKey && !activeGroup ? (
              <EmptyState
                icon={<LoaderCircle className="spin" size={42} />}
                eyebrow="SYNCING"
                title="共有データを読み込んでいます"
                description="グループの最新状態を取得しています。"
              />
            ) : (
              <Dashboard
                group={activeGroup}
                matches={state.matches}
                onCreateGroup={() => setGroupOpen(true)}
                onCreateMatch={() => setRecordOpen(true)}
                onShowHistory={() => setView('history')}
                apiConfigured={isApiConfigured}
                hasLegacyState={Boolean(legacyState)}
                onImportLegacy={() => void importLegacyData()}
              />
            )}
          </>
        )}
        {view === 'groups' && (
          <GroupsView
            groups={state.groups}
            matches={state.matches}
            activeGroupId={activeGroup?.id ?? null}
            currentShareKey={shareKey}
            recentGroups={recentGroups}
            onCreateGroup={() => setGroupOpen(true)}
            onSelectGroup={(groupId) => {
              selectGroup(groupId)
              setView('home')
            }}
            onOpenRecentGroup={openRecentGroup}
            onForgetRecentGroup={removeRecentGroup}
            onAddMember={addMember}
            onDeleteGroup={deleteGroup}
          />
        )}
        {view === 'history' && (
          <HistoryView
            groups={state.groups}
            activeGroup={activeGroup}
            matches={state.matches}
            onSelectGroup={selectGroup}
            onCreateMatch={() => setRecordOpen(true)}
            onDeleteMatch={deleteMatch}
          />
        )}
        {view === 'ranks' && (
          <RankGuideView
            group={activeGroup}
            matches={state.matches}
            onCreateMatch={() =>
              activeGroup ? setRecordOpen(true) : setGroupOpen(true)
            }
          />
        )}
      </main>

      <MobileNav
        view={view}
        onNavigate={changeView}
        onCreateMatch={() =>
          activeGroup ? setRecordOpen(true) : setGroupOpen(true)
        }
      />

      {recordOpen && (
        <RecordModal
          groups={state.groups}
          activeGroupId={activeGroup?.id ?? null}
          onClose={() => setRecordOpen(false)}
          onSubmit={createMatch}
        />
      )}
      {groupOpen && (
        <GroupModal
          onClose={() => setGroupOpen(false)}
          onSubmit={createGroup}
        />
      )}
    </div>
  )
}

interface HeaderProps {
  groups: Group[]
  activeGroup: Group | null
  view: ViewName
  mobileMenuOpen: boolean
  onToggleMenu: () => void
  onNavigate: (view: ViewName) => void
  onSelectGroup: (groupId: string) => void
  onCreateGroup: () => void
  onCreateMatch: () => void
  hasShareKey: boolean
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  onRefresh: () => void
  onShare: () => void
}

function Header({
  groups,
  activeGroup,
  view,
  mobileMenuOpen,
  onToggleMenu,
  onNavigate,
  onSelectGroup,
  onCreateGroup,
  onCreateMatch,
  hasShareKey,
  syncStatus,
  lastSyncedAt,
  onRefresh,
  onShare,
}: HeaderProps) {
  const syncLabel =
    syncStatus === 'saving'
      ? '保存中'
      : syncStatus === 'loading'
        ? '同期中'
        : syncStatus === 'error'
          ? '同期エラー'
          : syncStatus === 'unconfigured'
            ? '準備中'
            : '同期済み'

  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="男気録トップへ"
        >
          <span className="brand-mark">男</span>
          <span>
            <strong>男気録</strong>
            <small>OTOKOGI LOG</small>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="メインナビゲーション">
          <NavButton
            active={view === 'home'}
            icon={<Home size={18} />}
            label="ホーム"
            onClick={() => onNavigate('home')}
          />
          <NavButton
            active={view === 'groups'}
            icon={<Users size={18} />}
            label="グループ"
            onClick={() => onNavigate('groups')}
          />
          <NavButton
            active={view === 'history'}
            icon={<Archive size={18} />}
            label="勝負の記録"
            onClick={() => onNavigate('history')}
          />
          <NavButton
            active={view === 'ranks'}
            icon={<Medal size={18} />}
            label="ランク制度"
            onClick={() => onNavigate('ranks')}
          />
        </nav>

        <div className="header-actions">
          {hasShareKey && (
            <div
              className={`sync-pill ${syncStatus}`}
              title={
                lastSyncedAt
                  ? `最終同期: ${new Date(lastSyncedAt).toLocaleString('ja-JP')}`
                  : syncLabel
              }
            >
              {syncStatus === 'saving' || syncStatus === 'loading' ? (
                <LoaderCircle className="spin" size={15} />
              ) : syncStatus === 'error' ? (
                <CloudOff size={15} />
              ) : (
                <Cloud size={15} />
              )}
              <span>{syncLabel}</span>
            </div>
          )}
          {groups.length > 1 && (
            <label className="group-switcher">
              <span className="sr-only">表示するグループ</span>
              <select
                value={activeGroup?.id ?? ''}
                onChange={(event) => onSelectGroup(event.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.emoji} {group.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
          )}
          {hasShareKey && (
            <>
              <button
                type="button"
                className="icon-button desktop-sync-action"
                onClick={onRefresh}
                aria-label="最新の状態に更新"
                title="最新の状態に更新"
              >
                <RefreshCw size={17} />
              </button>
              <button
                type="button"
                className="button secondary compact desktop-share"
                onClick={onShare}
              >
                <Share2 size={17} />
                URLを共有
              </button>
            </>
          )}
          <button
            className="button primary compact desktop-record"
            type="button"
            onClick={groups.length ? onCreateMatch : onCreateGroup}
          >
            <Plus size={18} />
            {groups.length ? '勝負を記録' : 'グループ作成'}
          </button>
          <button
            type="button"
            className="icon-button menu-button"
            onClick={onToggleMenu}
            aria-label="メニューを開く"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <NavButton
            active={view === 'home'}
            icon={<Home size={18} />}
            label="ホーム"
            onClick={() => onNavigate('home')}
          />
          <NavButton
            active={view === 'groups'}
            icon={<Users size={18} />}
            label="グループ"
            onClick={() => onNavigate('groups')}
          />
          <NavButton
            active={view === 'history'}
            icon={<Archive size={18} />}
            label="勝負の記録"
            onClick={() => onNavigate('history')}
          />
          <NavButton
            active={view === 'ranks'}
            icon={<Medal size={18} />}
            label="ランク制度"
            onClick={() => onNavigate('ranks')}
          />
          {hasShareKey && (
            <>
              <button
                className="nav-button"
                type="button"
                onClick={onRefresh}
              >
                <RefreshCw size={18} />
                <span>最新に更新</span>
              </button>
              <button className="nav-button" type="button" onClick={onShare}>
                <Copy size={18} />
                <span>共有URLをコピー</span>
              </button>
            </>
          )}
        </div>
      )}
    </header>
  )
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`nav-button ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

interface DashboardProps {
  group: Group | null
  matches: Match[]
  onCreateGroup: () => void
  onCreateMatch: () => void
  onShowHistory: () => void
  apiConfigured: boolean
  hasLegacyState: boolean
  onImportLegacy: () => void
}

function Dashboard({
  group,
  matches,
  onCreateGroup,
  onCreateMatch,
  onShowHistory,
  apiConfigured,
  hasLegacyState,
  onImportLegacy,
}: DashboardProps) {
  if (!group) {
    if (!apiConfigured) {
      return (
        <EmptyState
          icon={<Cloud size={42} />}
          eyebrow="BACKEND SETUP"
          title="共有機能の公開準備中です"
          description="画面の実装は完了しています。Google Apps Scriptの公開URLを設定すると、共有グループを作成できます。"
        />
      )
    }

    return (
      <EmptyState
        icon={<Users size={42} />}
        eyebrow="WELCOME"
        title="最初のグループを作ろう"
        description="作成後に専用URLが発行されます。仲間へ送ると、全員で同じ記録を見たり更新したりできます。"
        actionLabel="グループを作成"
        onAction={onCreateGroup}
        secondaryActionLabel={
          hasLegacyState ? 'この端末の記録を共有化' : undefined
        }
        onSecondaryAction={hasLegacyState ? onImportLegacy : undefined}
      />
    )
  }

  const groupMatches = matches
    .filter((match) => match.groupId === group.id)
    .sort(
      (a, b) =>
        b.playedAt.localeCompare(a.playedAt) ||
        b.createdAt.localeCompare(a.createdAt),
    )
  const scores = getScores(group, matches)
  const leader = scores[0] ?? null
  const level = getOtokogiLevel(leader?.points ?? 0)
  const progress = getLevelProgress(leader?.points ?? 0, level)
  const totalPoints = groupMatches.reduce((sum, match) => sum + match.points, 0)
  const totalPaidAmount = groupMatches.reduce(
    (sum, match) => sum + (match.paidAmount ?? 0),
    0,
  )

  return (
    <div className="page-stack">
      <section className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow-line">
            <span>THIS GROUP&apos;S OTOKOGI</span>
            <i />
          </div>
          <p className="group-kicker">
            {group.emoji} {group.name}
          </p>
          <h1>
            今週も、<br />
            <em>気持ちよく勝とう。</em>
          </h1>
          <p className="hero-description">
            勝った者が払う。それが男気じゃんけん。
            <br />
            仲間との粋な勝負を、ここに刻もう。
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="button primary"
              onClick={onCreateMatch}
              disabled={group.members.length < 2}
            >
              <Swords size={20} />
              新しい勝負を記録
            </button>
            <button
              type="button"
              className="button text-button"
              onClick={onShowHistory}
            >
              記録を見る
              <ArrowRight size={18} />
            </button>
          </div>
          {group.members.length < 2 && (
            <p className="helper warning">
              勝負を記録するには、グループに2人以上必要です。
            </p>
          )}
        </div>

        <div className="hero-card">
          <div className="hero-badge">
            <Crown size={16} />
            現在のトップ
          </div>
          <div className="illustration-wrap">
            <OtokogiIllustration
              stage={level.stage}
              name={leader?.member.name ?? '挑戦者'}
              level={level.order}
            />
            <div className="brush-label">
              <span>{level.shortName}</span>
            </div>
          </div>
          <div className="hero-card-copy">
            <p>暫定・男気ランキング 1位</p>
            <h2>{leader?.member.name ?? 'まだ記録なし'}</h2>
            <div className="point-display">
              <strong>{leader?.points ?? 0}</strong>
              <span>OTOKOGI PT</span>
            </div>
            <p className="level-message">{level.message}</p>
            <div className="level-progress">
              <div className="level-progress-label">
                <span>{level.name}</span>
                <span>
                  {level.next === null
                    ? '最高位'
                    : `次まで ${level.next - (leader?.points ?? 0)} PT`}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-strip" aria-label="グループの集計">
        <Stat icon={<Swords />} value={groupMatches.length} label="これまでの勝負" />
        <Stat icon={<Users />} value={group.members.length} label="参加メンバー" />
        <Stat icon={<Flame />} value={totalPoints} label="累計男気ポイント" />
        <Stat
          icon={<CircleDollarSign />}
          value={formatYen(totalPaidAmount)}
          label="累計おごり金額"
        />
      </section>

      <section className="content-grid">
        <div className="panel ranking-panel">
          <SectionHeading
            icon={<Trophy />}
            eyebrow="RANKING"
            title="男気ランキング"
            aside={`${groupMatches.length}戦の記録`}
          />
          {scores.length ? (
            <div className="ranking-list">
              {scores.map((score, index) => {
                const memberLevel = getOtokogiLevel(score.points)
                return (
                  <div
                    className={`ranking-row ${index === 0 ? 'leader' : ''}`}
                    key={score.member.id}
                  >
                    <div className={`rank rank-${index + 1}`}>
                      {index === 0 ? <Crown size={20} /> : index + 1}
                    </div>
                    <Avatar
                      name={score.member.name}
                      color={score.member.color}
                      size="medium"
                    />
                    <div className="ranking-person">
                      <strong>{score.member.name}</strong>
                      <span>
                        {memberLevel.shortName} · {score.wins}勝 ·{' '}
                        {formatYen(score.paidAmount)}
                      </span>
                    </div>
                    <div className="ranking-points">
                      <strong>{score.points}</strong>
                      <span>PT</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <InlineEmpty message="メンバーを追加するとランキングが始まります。" />
          )}
        </div>

        <div className="panel recent-panel">
          <SectionHeading
            icon={<Sparkles />}
            eyebrow="RECENT BATTLES"
            title="最近の勝負"
            action={
              groupMatches.length > 0 ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={onShowHistory}
                >
                  すべて見る <ArrowRight size={16} />
                </button>
              ) : null
            }
          />
          {groupMatches.length ? (
            <div className="match-list compact-list">
              {groupMatches.slice(0, 4).map((match) => (
                <MatchCard key={match.id} match={match} group={group} compact />
              ))}
            </div>
          ) : (
            <InlineEmpty
              message="最初の男気じゃんけんを記録しましょう。"
              actionLabel="勝負を記録"
              onAction={onCreateMatch}
            />
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className="stat-item">
      <div className="stat-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  aside,
  action,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  aside?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <span className="section-icon">{icon}</span>
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
        </div>
      </div>
      {aside && <span className="section-aside">{aside}</span>}
      {action}
    </div>
  )
}

function RankGuideView({
  group,
  matches,
  onCreateMatch,
}: {
  group: Group | null
  matches: Match[]
  onCreateMatch: () => void
}) {
  const scores = group ? getScores(group, matches) : []
  const highestPoints = scores[0]?.points ?? 0
  const highestLevel = getOtokogiLevel(highestPoints)

  return (
    <div className="page-stack narrow-page rank-guide-page">
      <PageTitle
        eyebrow="OTOKOGI RANK"
        title="男気ランクへの道"
        description="勝負を重ねてポイントを獲得し、100PTの「天下無双の男気王」を目指そう。"
        action={
          <button type="button" className="button primary" onClick={onCreateMatch}>
            <Swords size={18} />
            {group ? '勝負を記録' : 'グループを作成'}
          </button>
        }
      />

      <section className="rank-goal-card">
        <div className="rank-goal-icon">
          <Crown size={35} />
        </div>
        <div className="rank-goal-copy">
          <span>THE FINAL RANK</span>
          <h2>100PTで、天下無双の男気王へ。</h2>
          <p>
            序盤はテンポよく、上位になるほど昇格の壁が高くなる全10段階。
            日々の小さな勝負も、大勝負も、すべてが男気の証になる。
          </p>
        </div>
        <div className="rank-goal-stats">
          <div>
            <strong>10</strong>
            <span>全ランク</span>
          </div>
          <div>
            <strong>100</strong>
            <span>最終到達PT</span>
          </div>
        </div>
      </section>

      {group && scores.length > 0 && (
        <section className="panel member-rank-panel">
          <SectionHeading
            icon={<Target />}
            eyebrow="NEXT TARGET"
            title={`${group.emoji} ${group.name} の挑戦状況`}
            aside="次のランクまでの残りポイント"
          />
          <div className="member-rank-grid">
            {scores.map((score) => {
              const level = getOtokogiLevel(score.points)
              const progress = getLevelProgress(score.points, level)
              const remaining =
                level.next === null ? null : level.next - score.points

              return (
                <article className="member-rank-card" key={score.member.id}>
                  <div className="member-rank-person">
                    <Avatar
                      name={score.member.name}
                      color={score.member.color}
                      size="medium"
                    />
                    <div>
                      <strong>{score.member.name}</strong>
                      <span>LEVEL {String(level.order).padStart(2, '0')}</span>
                    </div>
                    <b>{score.points} PT</b>
                  </div>
                  <h3>{level.name}</h3>
                  <div className="member-rank-target">
                    <span>
                      {remaining === null
                        ? '最終ランク到達'
                        : `次のランクまで あと ${remaining} PT`}
                    </span>
                    <strong>{Math.round(progress)}%</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="panel rank-ladder-panel">
        <SectionHeading
          icon={<Medal />}
          eyebrow="RANK LADDER"
          title="全10段階のランク表"
          aside="上位ほど必要ポイント幅が広がります"
        />
        <div className="rank-ladder">
          {OTOKOGI_LEVELS.map((level) => {
            const isCurrent = Boolean(group) && level.order === highestLevel.order
            const isReached = Boolean(group) && highestPoints >= level.min
            const range =
              level.next === null
                ? `${level.min} PT以上`
                : `${level.min}〜${level.next - 1} PT`

            return (
              <article
                className={`rank-level-card ${
                  isCurrent ? 'current' : isReached ? 'reached' : ''
                }`}
                key={level.order}
              >
                <div className="rank-level-number">
                  <span>LEVEL</span>
                  <strong>{String(level.order).padStart(2, '0')}</strong>
                </div>
                <div className="rank-level-illustration">
                  <OtokogiIllustration
                    stage={level.stage}
                    level={level.order}
                    name={level.name}
                    compact
                  />
                </div>
                <div className="rank-level-main">
                  <div className="rank-level-heading">
                    <div>
                      <span>{range}</span>
                      <h3>{level.name}</h3>
                    </div>
                    {isCurrent ? (
                      <b>グループ最高</b>
                    ) : isReached ? (
                      <b>到達済み</b>
                    ) : null}
                  </div>
                  <p>{level.message}</p>
                  <div className="rank-level-width">
                    {level.next === null ? (
                      <>
                        <Crown size={15} />
                        FINAL
                      </>
                    ) : (
                      <>
                        昇格幅
                        <strong>{level.next - level.min} PT</strong>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel point-rule-panel">
        <SectionHeading
          icon={<Flame />}
          eyebrow="HOW TO EARN"
          title="男気ポイントの獲得目安"
          aside="勝負の登録時にポイントは変更できます"
        />
        <div className="point-rule-grid">
          {Object.values(CATEGORY_META).map((meta) => (
            <div className="point-rule-card" key={meta.label}>
              <span>{meta.emoji}</span>
              <div>
                <strong>{meta.label}</strong>
                <small>{meta.description}</small>
              </div>
              <b>+{meta.points} PT</b>
            </div>
          ))}
        </div>
        <p className="rank-note">
          ランクは各メンバーの累計ポイントから自動判定されます。過去の記録も新しい基準で再計算され、データを入力し直す必要はありません。
        </p>
      </section>
    </div>
  )
}

interface GroupsViewProps {
  groups: Group[]
  matches: Match[]
  activeGroupId: string | null
  currentShareKey: string | null
  recentGroups: RecentGroupLink[]
  onCreateGroup: () => void
  onSelectGroup: (groupId: string) => void
  onOpenRecentGroup: (key: string) => void
  onForgetRecentGroup: (key: string) => void
  onAddMember: (groupId: string, name: string) => void
  onDeleteGroup: (groupId: string) => void
}

function GroupsView({
  groups,
  matches,
  activeGroupId,
  currentShareKey,
  recentGroups,
  onCreateGroup,
  onSelectGroup,
  onOpenRecentGroup,
  onForgetRecentGroup,
  onAddMember,
  onDeleteGroup,
}: GroupsViewProps) {
  return (
    <div className="page-stack narrow-page">
      <PageTitle
        eyebrow="YOUR CREWS"
        title="グループ"
        description="1つの共有URLにつき1グループ。家族、友人、同僚の記録を別々に管理できます。"
        action={
          <button
            className="button primary"
            type="button"
            onClick={onCreateGroup}
          >
            <Plus size={18} />
            グループを作成
          </button>
        }
      />

      {groups.length ? (
        <div className="group-grid">
          {groups.map((group) => {
            const groupMatches = matches.filter(
              (match) => match.groupId === group.id,
            )
            const scores = getScores(group, matches)
            return (
              <article
                key={group.id}
                className={`group-card ${
                  group.id === activeGroupId ? 'active' : ''
                }`}
              >
                <div className="group-card-top">
                  <div className="group-emoji">{group.emoji}</div>
                  <div className="group-card-title">
                    <span>
                      {group.id === activeGroupId && (
                        <>
                          <Check size={14} /> 表示中
                        </>
                      )}
                    </span>
                    <h2>{group.name}</h2>
                    <p>{group.description || '男気あふれる仲間たち'}</p>
                  </div>
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => onDeleteGroup(group.id)}
                    aria-label={`${group.name}を削除`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="group-meta">
                  <span>
                    <Users size={16} /> {group.members.length}人
                  </span>
                  <span>
                    <Swords size={16} /> {groupMatches.length}戦
                  </span>
                  <span>
                    <Flame size={16} />
                    {groupMatches.reduce(
                      (sum, match) => sum + match.points,
                      0,
                    )}
                    PT
                  </span>
                </div>

                <div className="member-cloud">
                  {scores.map((score) => (
                    <div className="member-chip" key={score.member.id}>
                      <Avatar
                        name={score.member.name}
                        color={score.member.color}
                        size="small"
                      />
                      <span>{score.member.name}</span>
                      <strong>{score.points}PT</strong>
                    </div>
                  ))}
                </div>

                <NewMemberForm
                  onSubmit={(name) => onAddMember(group.id, name)}
                />

                <button
                  className={`button full-width ${
                    group.id === activeGroupId ? 'secondary' : 'outline'
                  }`}
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                >
                  {group.id === activeGroupId
                    ? 'このグループのホームへ'
                    : 'このグループを表示'}
                  <ArrowRight size={17} />
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users size={42} />}
          eyebrow="NO GROUPS YET"
          title="勝負する仲間を集めよう"
          description="グループを作成し、最初のメンバーを登録してください。"
          actionLabel="グループを作成"
          onAction={onCreateGroup}
        />
      )}

      {recentGroups.length > 0 && (
        <section className="recent-groups-panel">
          <div className="recent-groups-heading">
            <div>
              <span>JOINED GROUPS</span>
              <h2>参加中グループ</h2>
              <p>
                このブラウザで開いたグループです。各グループは別々の共有URLで管理されています。
              </p>
            </div>
            <strong>{recentGroups.length}グループ</strong>
          </div>
          <div className="recent-group-list">
            {recentGroups.map((group) => {
              const isCurrent = group.key === currentShareKey
              return (
                <article
                  className={`recent-group-row ${isCurrent ? 'current' : ''}`}
                  key={group.key}
                >
                  <span className="recent-group-emoji">{group.emoji}</span>
                  <div className="recent-group-copy">
                    <span>
                      {isCurrent ? '表示中' : '専用URL'}
                      {isCurrent && <Check size={13} />}
                    </span>
                    <strong>{group.name}</strong>
                    <small>
                      最終アクセス：
                      {new Date(group.lastOpenedAt).toLocaleDateString('ja-JP')}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={`button compact ${
                      isCurrent ? 'secondary' : 'outline'
                    }`}
                    onClick={() =>
                      isCurrent
                        ? onSelectGroup(group.groupId)
                        : onOpenRecentGroup(group.key)
                    }
                  >
                    {isCurrent ? 'ホームへ' : '開く'}
                    <ArrowRight size={16} />
                  </button>
                  {!isCurrent && (
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => onForgetRecentGroup(group.key)}
                      aria-label={`${group.name}を参加中グループ一覧から外す`}
                      title="一覧から外す（共有データは削除されません）"
                    >
                      <X size={16} />
                    </button>
                  )}
                </article>
              )
            })}
          </div>
          <p className="recent-groups-note">
            この一覧は現在のブラウザだけに保存されます。別の端末では、各グループの共有URLを一度開くと一覧へ追加されます。
          </p>
        </section>
      )}
    </div>
  )
}

function NewMemberForm({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit(name)
    setName('')
  }

  return (
    <form className="new-member-form" onSubmit={submit}>
      <label>
        <span className="sr-only">追加するメンバー名</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="メンバー名を追加"
          maxLength={20}
        />
      </label>
      <button type="submit" className="icon-button add" aria-label="追加">
        <Plus size={19} />
      </button>
    </form>
  )
}

interface HistoryViewProps {
  groups: Group[]
  activeGroup: Group | null
  matches: Match[]
  onSelectGroup: (groupId: string) => void
  onCreateMatch: () => void
  onDeleteMatch: (matchId: string) => void
}

function HistoryView({
  groups,
  activeGroup,
  matches,
  onSelectGroup,
  onCreateMatch,
  onDeleteMatch,
}: HistoryViewProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | MatchCategory>('all')

  const filteredMatches = useMemo(() => {
    if (!activeGroup) return []
    return matches
      .filter((match) => match.groupId === activeGroup.id)
      .filter((match) => category === 'all' || match.category === category)
      .filter((match) => {
        const member = activeGroup.members.find(
          (item) => item.id === match.otokogiId,
        )
        const text = `${match.stake} ${match.memo} ${member?.name ?? ''}`
        return text.toLowerCase().includes(search.toLowerCase())
      })
      .sort(
        (a, b) =>
          b.playedAt.localeCompare(a.playedAt) ||
          b.createdAt.localeCompare(a.createdAt),
      )
  }, [activeGroup, category, matches, search])

  return (
    <div className="page-stack narrow-page">
      <PageTitle
        eyebrow="BATTLE ARCHIVE"
        title="勝負の記録"
        description="あの日、誰が何に男気を見せたのか。すべての勝負を振り返れます。"
        action={
          <button
            className="button primary"
            type="button"
            onClick={onCreateMatch}
            disabled={!activeGroup || activeGroup.members.length < 2}
          >
            <Plus size={18} />
            勝負を記録
          </button>
        }
      />

      {activeGroup ? (
        <>
          <div className="filter-bar">
            <label className="search-box">
              <Search size={18} />
              <span className="sr-only">記録を検索</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="内容・メンバー名で検索"
              />
            </label>
            {groups.length > 1 && (
              <label className="filter-select">
                <span className="sr-only">グループ</span>
                <select
                  value={activeGroup.id}
                  onChange={(event) => onSelectGroup(event.target.value)}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.emoji} {group.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </label>
            )}
            <label className="filter-select">
              <span className="sr-only">カテゴリ</span>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as 'all' | MatchCategory)
                }
              >
                <option value="all">すべての勝負</option>
                {Object.entries(CATEGORY_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.emoji} {meta.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          {filteredMatches.length ? (
            <div className="history-list">
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  group={activeGroup}
                  onDelete={() => onDeleteMatch(match.id)}
                />
              ))}
            </div>
          ) : (
            <InlineEmpty
              message={
                search || category !== 'all'
                  ? '条件に一致する勝負はありません。'
                  : 'まだ勝負の記録がありません。'
              }
              actionLabel={!search && category === 'all' ? '勝負を記録' : undefined}
              onAction={!search && category === 'all' ? onCreateMatch : undefined}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<Archive size={42} />}
          eyebrow="NO GROUP"
          title="先にグループを作成してください"
          description="勝負の記録はグループごとに保存されます。"
          actionLabel=""
          onAction={() => undefined}
        />
      )}
    </div>
  )
}

function MatchCard({
  match,
  group,
  compact = false,
  onDelete,
}: {
  match: Match
  group: Group
  compact?: boolean
  onDelete?: () => void
}) {
  const winner = group.members.find((member) => member.id === match.otokogiId)
  const meta = CATEGORY_META[match.category]

  return (
    <article className={`match-card ${compact ? 'compact' : ''}`}>
      <div className="match-category" title={meta.label}>
        {meta.emoji}
      </div>
      <div className="match-main">
        <div className="match-date">
          <CalendarDays size={14} />
          {formatDate(match.playedAt)}
          <span>·</span>
          {match.participantIds.length}人で勝負
        </div>
        <h3>{match.stake}</h3>
        {!compact && match.memo && <p>{match.memo}</p>}
      </div>
      <div className="match-winner">
        {winner && (
          <Avatar name={winner.name} color={winner.color} size="small" />
        )}
        <div>
          <span>男気を見せた人</span>
          <strong>{winner?.name ?? '退会メンバー'}</strong>
        </div>
      </div>
      <div className="match-points">
        <strong>+{match.points}</strong>
        <span>PT</span>
        {match.paidAmount > 0 && (
          <small>{formatYen(match.paidAmount)}</small>
        )}
      </div>
      {onDelete && (
        <button
          className="icon-button danger match-delete"
          type="button"
          onClick={onDelete}
          aria-label={`${match.stake}の記録を削除`}
        >
          <Trash2 size={17} />
        </button>
      )}
    </article>
  )
}

function Avatar({
  name,
  color,
  size,
}: {
  name: string
  color: string
  size: 'small' | 'medium'
}) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  )
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function EmptyState({
  icon,
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}) {
  return (
    <section className="empty-state">
      <div className="empty-icon">{icon}</div>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="empty-actions">
          {actionLabel && onAction && (
            <button type="button" className="button primary" onClick={onAction}>
              <Plus size={18} />
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              className="button outline"
              onClick={onSecondaryAction}
            >
              <Cloud size={18} />
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function InlineEmpty({
  message,
  actionLabel,
  onAction,
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="inline-empty">
      <span className="empty-fist">✊</span>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="link-button" onClick={onAction}>
          {actionLabel} <ArrowRight size={16} />
        </button>
      )}
    </div>
  )
}

interface RecordModalProps {
  groups: Group[]
  activeGroupId: string | null
  onClose: () => void
  onSubmit: (match: Omit<Match, 'id' | 'createdAt'>) => void
}

function RecordModal({
  groups,
  activeGroupId,
  onClose,
  onSubmit,
}: RecordModalProps) {
  const initialGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0]
  const [groupId, setGroupId] = useState(initialGroup?.id ?? '')
  const [playedAt, setPlayedAt] = useState(
    new Date().toLocaleDateString('en-CA'),
  )
  const [stake, setStake] = useState('')
  const [category, setCategory] = useState<MatchCategory>('snack')
  const [points, setPoints] = useState(CATEGORY_META.snack.points)
  const [paidAmount, setPaidAmount] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialGroup?.members.map((member) => member.id) ?? [],
  )
  const [otokogiId, setOtokogiId] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')

  const group = groups.find((item) => item.id === groupId)

  const chooseGroup = (nextGroupId: string) => {
    const nextGroup = groups.find((item) => item.id === nextGroupId)
    setGroupId(nextGroupId)
    setParticipantIds(nextGroup?.members.map((member) => member.id) ?? [])
    setOtokogiId('')
  }

  const chooseCategory = (nextCategory: MatchCategory) => {
    setCategory(nextCategory)
    setPoints(CATEGORY_META[nextCategory].points)
  }

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((current) => {
      if (current.includes(memberId)) {
        if (otokogiId === memberId) setOtokogiId('')
        return current.filter((id) => id !== memberId)
      }
      return [...current, memberId]
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!groupId || !stake.trim() || !playedAt) {
      setError('グループ、日付、かけたものを入力してください。')
      return
    }
    if (participantIds.length < 2) {
      setError('参加者を2人以上選んでください。')
      return
    }
    if (!otokogiId) {
      setError('男気を見せた人を選んでください。')
      return
    }
    const normalizedPaidAmount =
      paidAmount.trim() === '' ? 0 : Number(paidAmount)
    if (
      !Number.isSafeInteger(normalizedPaidAmount) ||
      normalizedPaidAmount < 0 ||
      normalizedPaidAmount > 99_999_999
    ) {
      setError('おごった金額は0円以上99,999,999円以下で入力してください。')
      return
    }
    onSubmit({
      groupId,
      playedAt,
      stake: stake.trim(),
      category,
      otokogiId,
      participantIds,
      points: Math.max(1, Math.min(99, points)),
      paidAmount: normalizedPaidAmount,
      memo: memo.trim(),
    })
  }

  return (
    <Modal title="新しい勝負を記録" icon={<Swords />} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-row two-columns">
          <FormField label="グループ" required>
            <div className="select-wrap">
              <select
                value={groupId}
                onChange={(event) => chooseGroup(event.target.value)}
              >
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.emoji} {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </FormField>
          <FormField label="勝負した日" required>
            <input
              type="date"
              value={playedAt}
              onChange={(event) => setPlayedAt(event.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label="何をかけた？"
          hint="例：コンビニのアイス、ランチ、旅行のお土産"
          required
        >
          <input
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            placeholder="勝負の内容を入力"
            maxLength={60}
            autoFocus
          />
        </FormField>

        <FormField label="勝負のカテゴリ" required>
          <div className="category-grid">
            {(
              Object.entries(CATEGORY_META) as [
                MatchCategory,
                (typeof CATEGORY_META)[MatchCategory],
              ][]
            ).map(([value, meta]) => (
              <button
                type="button"
                key={value}
                className={`category-option ${
                  category === value ? 'selected' : ''
                }`}
                onClick={() => chooseCategory(value)}
              >
                <span>{meta.emoji}</span>
                <strong>{meta.label}</strong>
                <small>{meta.points} PT</small>
              </button>
            ))}
          </div>
        </FormField>

        <FormField
          label="参加したメンバー"
          hint={`${participantIds.length}人を選択中`}
          required
        >
          <div className="member-select-grid">
            {group?.members.map((member) => {
              const selected = participantIds.includes(member.id)
              return (
                <button
                  type="button"
                  className={`member-select ${selected ? 'selected' : ''}`}
                  key={member.id}
                  onClick={() => toggleParticipant(member.id)}
                >
                  <Avatar
                    name={member.name}
                    color={member.color}
                    size="small"
                  />
                  <span>{member.name}</span>
                  <i>{selected && <Check size={14} />}</i>
                </button>
              )
            })}
          </div>
        </FormField>

        <FormField
          label="男気を見せたのは？"
          hint="じゃんけんに勝ち、支払いを引き受けた人"
          required
        >
          <div className="winner-grid">
            {group?.members
              .filter((member) => participantIds.includes(member.id))
              .map((member) => (
                <button
                  type="button"
                  key={member.id}
                  className={`winner-option ${
                    otokogiId === member.id ? 'selected' : ''
                  }`}
                  onClick={() => setOtokogiId(member.id)}
                >
                  {otokogiId === member.id && <Crown size={17} />}
                  <Avatar
                    name={member.name}
                    color={member.color}
                    size="medium"
                  />
                  <strong>{member.name}</strong>
                </button>
              ))}
          </div>
        </FormField>

        <div className="form-row point-memo-row">
          <FormField
            label="おごった金額"
            hint="実際に支払った合計額"
            optional
          >
            <div className="money-input">
              <span>¥</span>
              <input
                type="number"
                min={0}
                max={99999999}
                step={1}
                inputMode="numeric"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
                placeholder="例：4800"
              />
              <b>円</b>
            </div>
          </FormField>
          <FormField
            label="獲得ポイント"
            hint="内容に応じて調整できます"
          >
            <div className="point-input">
              <input
                type="number"
                min={1}
                max={99}
                value={points}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
              <span>PT</span>
            </div>
          </FormField>
        </div>

        <FormField label="ひとことメモ" optional>
          <input
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="その場の出来事など"
            maxLength={120}
          />
        </FormField>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="button outline" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="button primary">
            <Flame size={19} />
            この勝負を刻む
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface GroupModalProps {
  onClose: () => void
  onSubmit: (input: {
    name: string
    description: string
    emoji: string
    memberNames: string[]
  }) => void
}

function GroupModal({ onClose, onSubmit }: GroupModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('✊')
  const [members, setMembers] = useState('')
  const [error, setError] = useState('')
  const emojis = ['✊', '🔥', '🍻', '🏕️', '⚽', '🎓', '💪', '🎲']

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const memberNames = members
      .split(/[\n,、]/)
      .map((member) => member.trim())
      .filter(Boolean)
    if (!name.trim()) {
      setError('グループ名を入力してください。')
      return
    }
    if (memberNames.length < 2) {
      setError('最初のメンバーを2人以上入力してください。')
      return
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      emoji,
      memberNames,
    })
  }

  return (
    <Modal title="グループを作成" icon={<Users />} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <FormField label="グループのアイコン">
          <div className="emoji-grid">
            {emojis.map((item) => (
              <button
                type="button"
                key={item}
                className={emoji === item ? 'selected' : ''}
                onClick={() => setEmoji(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="グループ名" required>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例：週末メンバー"
            maxLength={30}
            autoFocus
          />
        </FormField>
        <FormField label="グループの説明" optional>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="例：毎週集まるいつもの4人"
            maxLength={80}
          />
        </FormField>
        <FormField
          label="最初のメンバー"
          hint="改行または読点で区切ってください"
          required
        >
          <textarea
            value={members}
            onChange={(event) => setMembers(event.target.value)}
            placeholder={'シゲル\nケンタ\nユウタ'}
            rows={4}
          />
        </FormField>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button outline" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="button primary">
            <Users size={19} />
            グループを作成
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string
  icon: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="modal-icon">{icon}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

function FormField({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  optional?: boolean
  children: ReactNode
}) {
  return (
    <label className="form-field">
      <span className="field-label">
        <strong>{label}</strong>
        {required && <i>必須</i>}
        {optional && <em>任意</em>}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  )
}

function MobileNav({
  view,
  onNavigate,
  onCreateMatch,
}: {
  view: ViewName
  onNavigate: (view: ViewName) => void
  onCreateMatch: () => void
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="モバイルナビゲーション">
      <NavButton
        active={view === 'home'}
        icon={<Home size={20} />}
        label="ホーム"
        onClick={() => onNavigate('home')}
      />
      <NavButton
        active={view === 'history'}
        icon={<Archive size={20} />}
        label="記録"
        onClick={() => onNavigate('history')}
      />
      <button
        type="button"
        className="mobile-add"
        onClick={onCreateMatch}
        aria-label="勝負を記録"
      >
        <Plus size={25} />
      </button>
      <NavButton
        active={view === 'ranks'}
        icon={<Medal size={20} />}
        label="ランク"
        onClick={() => onNavigate('ranks')}
      />
      <NavButton
        active={view === 'groups'}
        icon={<Settings2 size={20} />}
        label="グループ"
        onClick={() => onNavigate('groups')}
      />
    </nav>
  )
}

export default App
