import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { apiRequest, RequestError, sessionKey } from './api'
import { missions } from './missions'
import type { RoomSession, RoomView } from './types'

type RoomResponse = { room: RoomView; token?: string }

function getSession(roomId: string): RoomSession | null {
  try {
    const token = localStorage.getItem(sessionKey(roomId))
    return token ? { token } : null
  } catch { return null }
}

function saveSession(roomId: string, token: string) {
  try { localStorage.setItem(sessionKey(roomId), token) } catch { /* The current tab can still participate. */ }
}

function PageShell({ children }: { children: ReactNode }) {
  return <>
    <header className="site-header page-width"><a href="#" className="wordmark">비빔랜덤<span className="brand-dot">.</span></a><a className="header-link" href="#">랜딩페이지로 <span aria-hidden="true">↗</span></a></header>
    <main className="gathering-page">{children}</main>
    <footer className="gathering-footer">잘 먹고, 잘 웃고, 잘 비비자.</footer>
  </>
}

export function CreateGathering() {
  const [title, setTitle] = useState('우리의 랜덤 비빔밥')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function create(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    if (!name.trim() || !title.trim()) return setError('모임 이름과 내 이름을 입력해주세요.')
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest<RoomResponse>('/api/rooms', { method: 'POST', body: { title: title.trim(), name: name.trim() } })
      if (!data.token) throw new Error('참가 정보를 받지 못했어요. 다시 만들어주세요.')
      saveSession(data.room.id, data.token)
      // Pass the token in memory as well when browser storage is unavailable.
      pendingSession = { roomId: data.room.id, token: data.token }
      location.hash = `/room/${data.room.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : '모임을 만들지 못했어요.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <PageShell><div className="create-layout">
    <div className="create-copy"><span className="section-kicker">LET'S BIBIM TOGETHER</span><h1>친구만 모이면,<br /><span>준비는 끝.</span></h1><p>링크 하나 보내고, 이름 하나 적고.<br />우리만의 뜻밖의 한 그릇을 만들어봐요.</p><ol className="create-steps"><li><span>01</span>링크로 친구 초대하기</li><li><span>02</span>각자 비밀 미션 받기</li><li><span>03</span>재료를 모아 리포트 만들기</li></ol></div>
    <form className="gathering-card create-form" onSubmit={create} aria-busy={busy}><span className="form-bowl" aria-hidden="true">🍚</span><h2>새 모임 만들기</h2><p className="card-description">로그인 없이, 이름만 있으면 돼요.</p><fieldset disabled={busy}>
      <label htmlFor="gathering-title">모임 이름</label><input id="gathering-title" value={title} maxLength={40} required onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="host-name">내 이름 또는 별명</label><input id="host-name" value={name} maxLength={20} placeholder="예: 민수" autoComplete="nickname" required onChange={(e) => setName(e.target.value)} />
      <button className="button button-primary" type="submit">{busy ? '모임을 만드는 중…' : '모임 만들고 친구 초대하기'}<span aria-hidden="true">→</span></button>
    </fieldset>{error && <p className="error-message" role="alert">{error}</p>}<p className="gathering-small-note">모임은 최대 8명, 24시간 동안 이용할 수 있어요.<br />서버가 다시 시작되면 모임이 사라져요.</p></form>
  </div></PageShell>
}

let pendingSession: { roomId: string; token: string } | null = null

export function GatheringRoom({ roomId, showMissions = false }: { roomId: string; showMissions?: boolean }) {
  const [session, setSession] = useState<RoomSession | null>(() => pendingSession?.roomId === roomId ? { token: pendingSession.token } : getSession(roomId))
  const [room, setRoom] = useState<RoomView | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [name, setName] = useState('')
  const [ingredient, setIngredient] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [retry, setRetry] = useState(0)
  const actionPending = useRef(false)
  const actionVersion = useRef(0)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializedIngredient = useRef(false)
  const mounted = useRef(true)
  const reportRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current) }
  }, [])

  useEffect(() => {
    if (room?.phase === 'completed') {
      reportRef.current?.focus({ preventScroll: true })
      reportRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [room?.phase])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      const version = actionVersion.current
      try {
        const data = await apiRequest<RoomResponse>(`/api/rooms/${roomId}`, { token: session?.token, signal: controller.signal })
        if (controller.signal.aborted) return
        if (version === actionVersion.current) {
          setRoom(data.room)
          if (!initializedIngredient.current && data.room.me) {
            setIngredient(data.room.members.find((m) => m.id === data.room.me?.id)?.ingredient || '')
            initializedIngredient.current = true
          }
        }
        setConnectionError('')
        setMissing(false)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof RequestError && err.status === 401) {
          try { localStorage.removeItem(sessionKey(roomId)) } catch { /* Storage may be unavailable. */ }
          if (pendingSession?.roomId === roomId) pendingSession = null
          initializedIngredient.current = false
          setSession(null)
          return
        }
        if (err instanceof RequestError && err.status === 404) {
          setMissing(true)
          setConnectionError(err.message)
          return
        }
        setConnectionError(err instanceof Error ? err.message : '모임 정보를 불러오지 못했어요.')
      }
      if (!controller.signal.aborted) timer = setTimeout(() => { void refresh() }, 3000)
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [roomId, session?.token, retry])

  async function act(action: 'join' | 'distribute' | 'ingredient' | 'report', body: unknown = {}) {
    if (actionPending.current) return
    actionPending.current = true
    actionVersion.current += 1
    setBusy(action)
    setError('')
    try {
      const data = await apiRequest<RoomResponse>(`/api/rooms/${roomId}/${action}`, {
        method: action === 'ingredient' ? 'PUT' : 'POST', token: session?.token, body,
      })
      if (!mounted.current) return
      actionVersion.current += 1
      if (data.token) {
        saveSession(roomId, data.token)
        pendingSession = { roomId, token: data.token }
        setSession({ token: data.token })
      }
      setRoom(data.room)
      setConnectionError('')
      if (action === 'ingredient') setSaved(true)
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : '요청을 처리하지 못했어요.')
    } finally {
      actionPending.current = false
      if (mounted.current) setBusy('')
    }
  }

  const inviteUrl = `${location.origin}${location.pathname}#/room/${roomId}`
  const missionsUrl = `${inviteUrl}/missions`
  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2500)
    } catch { setError('링크를 복사하지 못했어요. 주소창에서 직접 복사해주세요.') }
  }

  if (missing) return <PageShell><div className="gathering-card empty-room"><span aria-hidden="true">🍚</span><h2>이 모임은 끝났어요.</h2><p>{connectionError}</p><a className="button button-primary" href="#/create">새 모임 만들기</a></div></PageShell>
  if (!room) return <PageShell><div className="gathering-card empty-room" aria-live="polite"><span aria-hidden="true">🍚</span><h2>{connectionError ? '잠깐, 연결을 확인할게요.' : '모임에 들어가는 중…'}</h2><p>{connectionError || '첫 접속은 조금 오래 걸릴 수 있어요.'}</p>{connectionError && <button className="button button-dark" onClick={() => setRetry((v) => v + 1)}>다시 연결하기</button>}</div></PageShell>

  if (showMissions) return <PageShell>
    <div className="mission-reveal-page">
      <a className="reveal-back" href={`#/room/${roomId}`}>← 비빔밥 리포트로 돌아가기</a>
      <div className="reveal-heading"><span className="section-kicker">MISSION REVEAL</span><h1>{room.title}<br /><span>미션 공개!</span></h1><p>{room.phase === 'completed' ? '각자의 비밀 미션과 직접 고른 재료를 함께 확인해요.' : '리포트가 완성되면 모두의 미션이 이곳에 공개돼요.'}</p></div>
      {connectionError && <p className="error-message" role="status">{connectionError}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {room.phase === 'completed' ? <>
        <div className="mission-reveal-grid">{room.members.map((member, index) => {
          const assigned = member.missionIndex === null ? null : missions[member.missionIndex]
          return <article className={`reveal-card ${assigned?.color || 'green'}`} key={member.id}>
            <div className="reveal-card-top"><span className="reveal-number">{String(index + 1).padStart(2, '0')}</span><span className="reveal-name">{member.name}{member.id === room.me?.id ? ' · 나' : ''}</span></div>
            <div className="reveal-mission"><span>{assigned?.category || '랜덤 미션'}</span><h2>{assigned?.title || '미션을 확인할 수 없어요.'}</h2><p>{assigned?.hint}</p></div>
            <div className="reveal-ingredient"><span>가져온 재료</span><strong>{member.ingredient}</strong></div>
          </article>
        })}</div>
        <div className="reveal-actions"><button className="button button-dark" type="button" onClick={() => { void copyLink(missionsUrl) }}>{copied ? '✓ 공개 링크를 복사했어요' : '미션 공개 링크 복사하기'}</button><span className="sr-only" role="status">{copied ? '미션 공개 링크 복사 완료' : ''}</span></div>
      </> : <div className="gathering-card reveal-locked"><span aria-hidden="true">🔒</span><h2>아직 공개 전이에요.</h2><p>모임장이 리포트를 만들면 모든 참가자의 미션을 볼 수 있어요.</p></div>}
      <p className="room-expiry reveal-expiry">모임 정보는 생성 후 24시간 동안 유지되며, 서버가 다시 시작되면 사라져요.</p>
    </div>
  </PageShell>

  const me = room.members.find((m) => m.id === room.me?.id)
  const mission = room.me?.missionIndex != null ? missions[room.me.missionIndex] : null
  const submittedCount = room.members.filter((m) => m.hasIngredient).length
  const generating = room.generating || busy === 'report'
  const phaseIndex = room.phase === 'waiting' ? 0 : room.phase === 'shopping' ? 1 : 2

  return <PageShell>
    <span className="sr-only" role="status">{room.phase === 'completed' ? '우리 모임 리포트가 완성되었습니다.' : generating ? 'AI 리포트를 생성하고 있습니다.' : room.phase === 'shopping' ? '미션이 배분되었습니다.' : '친구들의 참가를 기다리고 있습니다.'}</span>
    <div className="room-heading"><span className="section-kicker">OUR RANDOM BIBIM</span><h1>{room.title}</h1><p>{room.phase === 'waiting' ? '뭘 가져올지는 비밀. 일단 친구부터 모아요.' : room.phase === 'shopping' ? '미션은 랜덤, 재료 선택은 내 마음대로.' : '예상 밖의 한 그릇, 우리만의 이야기가 됐어요.'}</p></div>
    <ol className="room-progress" aria-label="모임 진행 단계">{['친구 모으기', '미션 받고 재료 고르기', '함께 리포트 보기'].map((label, i) => <li key={label} className={i <= phaseIndex ? 'current' : ''} aria-current={i === phaseIndex ? 'step' : undefined}><span>{i < phaseIndex ? '✓' : `0${i + 1}`}</span>{label}</li>)}</ol>
    {connectionError && <p className="error-message room-connection" role="status">{connectionError}</p>}
    {error && <p className="error-message room-connection" role="alert">{error}</p>}
    <div className="room-layout">
      <section className="room-main">
        {!room.me && room.phase === 'waiting' && <form className="gathering-card join-form" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return setError('이름을 입력해주세요.'); void act('join', { name: name.trim() }) }}><span className="section-kicker">YOU'RE INVITED!</span><h2>같이 비빌래요?</h2><p className="card-description">이름만 적으면 바로 참가할 수 있어요.</p><fieldset disabled={!!busy}><label htmlFor="join-name">내 이름 또는 별명</label><input id="join-name" value={name} required maxLength={20} autoComplete="nickname" placeholder="친구들이 알아볼 이름" onChange={(e) => setName(e.target.value)} /><button className="button button-primary" type="submit">{busy === 'join' ? '참가하는 중…' : '모임 참가하기'}</button></fieldset></form>}
        {!room.me && room.phase === 'shopping' && <div className="gathering-card"><h2>이미 장보기가 시작됐어요.</h2><p className="card-description">미션이 배분되어 참가가 마감됐어요.<br />같은 브라우저로 다시 열면 내 미션을 볼 수 있어요.</p></div>}
        {room.me && room.phase === 'waiting' && <div className="gathering-card waiting-card"><span className="waiting-symbol" aria-hidden="true">✳</span><h2>{me?.name}님, 잘 왔어요!</h2><p className="card-description">친구가 모두 모이면 각자 비밀 미션을 받아요.<br />무슨 재료를 가져올지는 직접 정해주세요.</p>{room.me.isHost ? <><button className="button button-primary" disabled={!!busy || room.members.length < 2} onClick={() => { void act('distribute') }}>{busy === 'distribute' ? '미션을 섞는 중…' : '모두 왔어요! 미션 배분하기'}</button><p className="gathering-small-note">배분하면 참가가 마감돼요. 친구들이 다 왔는지 확인해주세요.</p></> : <p className="waiting-message">모임장이 미션을 배분하면 여기에서 확인할 수 있어요.</p>}</div>}
        {room.me && room.phase === 'shopping' && mission && <>
          <article className={`active-mission room-mission ${mission.color}`}><div className="mission-card-top"><span><span className="status-dot" /> {me?.name}님의 비밀 미션</span><span aria-hidden="true">✳</span></div><div className="mission-content"><span className="mission-category">{mission.category}</span><h2>{mission.title}</h2><p>{mission.hint}</p></div><div className="mission-card-bottom"><span>재료는 직접 골라주세요!</span><span>친구들에겐 비밀</span></div></article>
          <form className="gathering-card ingredient-form" onSubmit={(e) => { e.preventDefault(); if (!ingredient.trim()) return setError('가져온 재료를 입력해주세요.'); void act('ingredient', { ingredient: ingredient.trim() }) }}><h2>나는 이 재료를 가져왔어요.</h2><p className="card-description">모두 모인 뒤 리포트에서 함께 공개해요.</p><fieldset disabled={!!busy || generating}><label htmlFor="my-ingredient">내가 가져온 재료</label><input id="my-ingredient" value={ingredient} maxLength={40} required placeholder="예: 감자칩" onChange={(e) => { setIngredient(e.target.value); setSaved(false) }} /><button className="button button-dark" type="submit">{busy === 'ingredient' ? '재료를 저장하는 중…' : me?.hasIngredient ? '내 재료 수정하기' : '내 재료 제출하기'}</button></fieldset>{saved && <p className="saved-message" role="status">✓ 재료를 저장했어요. 친구들의 입력을 기다려주세요.</p>}</form>
        </>}
        {room.phase === 'completed' && room.report && <><section className="receipt room-receipt" aria-labelledby="shared-report-title" ref={reportRef} tabIndex={-1}><div className="receipt-top"><span className="receipt-logo">비빔랜덤</span><span className="mini-label">OUR BIBIM REPORT</span></div><div className="receipt-heading"><span className="report-bowl" aria-hidden="true">🍚</span><h2 id="shared-report-title">오늘의 비빔밥 리포트</h2><p>{room.members.length}명의 취향이 한 그릇에 모인 날</p></div><div className="receipt-rule" /><div className="shared-ingredients">{room.members.map((m) => <div key={m.id}><span>{m.name}</span><strong>{m.ingredient}</strong></div>)}</div><div className="evaluation"><span className="mini-label">✦ AI의 한마디</span><p>“{room.report.evaluation}”</p></div><div className="score-row"><span>재료 궁합 점수</span><span><strong>{room.report.score}</strong><small> / 100</small></span></div><div className="score-track" role="meter" aria-label="재료 궁합 점수" aria-valuenow={room.report.score} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${room.report.score}%` }} /></div><div className="report-awards"><div><span>🏆 오늘의 MVP</span><strong>{room.report.mvp}</strong></div><div><span>🚨 오늘의 가장 위험한 선택</span><strong>{room.report.riskyCombination}</strong></div></div><div className="receipt-rule" /><p className="receipt-ending">맛은 몰라도, 추억은 100점.</p><div className="barcode" aria-hidden="true" /></section><a className="button button-primary reveal-entry" href={`#/room/${roomId}/missions`}>친구들의 미션 공개 보기 <span aria-hidden="true">→</span></a></>}
      </section>
      <aside className="room-sidebar">
        <section className="gathering-card invite-card"><h2>{room.phase === 'waiting' ? '친구들을 불러볼까요?' : '우리 모임 링크'}</h2><p className="card-description">{room.phase === 'waiting' ? '링크를 보내면 이름만 입력해서 참가해요.' : '같은 링크에서 모임과 리포트를 볼 수 있어요.'}</p><label className="sr-only" htmlFor="invite-link">모임 초대 링크</label><input id="invite-link" readOnly value={inviteUrl} onFocus={(e) => e.target.select()} /><button className="button invite-copy" type="button" onClick={() => { void copyLink(inviteUrl) }}>{copied ? '✓ 링크를 복사했어요' : '초대 링크 복사하기'}</button><span className="sr-only" role="status">{copied ? '초대 링크 복사 완료' : ''}</span></section>
        <section className="gathering-card members-card"><div className="members-title"><h2>함께 비빌 친구들</h2><span>{room.members.length} / 8명</span></div><ul className="room-members">{room.members.map((m, i) => <li key={m.id}><span className={`member-avatar ${['peach', 'yellow', 'green', 'blue'][i % 4]}`} aria-hidden="true">{Array.from(m.name)[0]}</span><div><strong>{m.name}{m.id === room.me?.id && <small>나</small>}{m.isHost && <small>모임장</small>}</strong><span>{room.phase === 'waiting' ? '참가 완료' : room.phase === 'completed' ? m.ingredient : m.hasIngredient ? '재료 제출 완료 ✓' : '재료 고르는 중'}</span></div></li>)}</ul></section>
        {room.phase === 'shopping' && <section className="gathering-card finish-card"><span className="section-kicker">THE FINAL MIX</span><h2>모두 가져왔나요?</h2><p className="card-description">재료 제출 <strong>{submittedCount} / {room.members.length}명</strong><br />다 모이면 비비고, 오늘의 리포트를 만들어요.</p>{room.me?.isHost ? <button className="button button-primary" disabled={!!busy || generating || submittedCount !== room.members.length} onClick={() => { void act('report') }}>{generating ? 'AI가 우리 조합을 상상하는 중…' : '함께 비비고 리포트 만들기'}</button> : <p className="waiting-message" role="status">{generating ? 'AI가 리포트를 만드는 중이에요…' : '모임장이 리포트를 만들면 함께 볼 수 있어요.'}</p>}<p className="gathering-small-note">AI 평가는 한 번만 생성하고 모두 함께 봐요.</p></section>}
        <p className="room-expiry">모임은 생성 후 24시간 동안 이용할 수 있어요.<br />새로고침해도 같은 브라우저라면 다시 참가할 수 있어요.<br />서버가 다시 시작되면 모임이 사라져요.</p>
        {room.phase === 'completed' && <a className="button button-dark new-gathering" href="#/create">다음 비빔밥 모임 만들기 <span aria-hidden="true">→</span></a>}
      </aside>
    </div>
  </PageShell>
}
