import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isReport, type Participant, type Report } from './types'
import { missions } from './missions'
import { apiRequest } from './api'
import { CreateGathering, GatheringRoom } from './Gathering'

type IconName = 'arrow' | 'shuffle' | 'spark' | 'people' | 'bag' | 'play' | 'check'

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    shuffle: <><path d="M3 6h3c5 0 7 12 12 12h3M17 14l4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3M17 2l4 4-4 4" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" /></>,
    people: <><circle cx="9" cy="7" r="3" /><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 13a5 5 0 0 1 3 4v3" /></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
    play: <path d="m9 5 10 7-10 7V5Z" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg className={`icon ${className}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const initialParticipants: Participant[] = [
  { name: '지수', ingredient: '김치' }, { name: '현우', ingredient: '참치' },
  { name: '수진', ingredient: '아보카도' }, { name: '민수', ingredient: '감자칩' },
]
const exampleReport: Report = {
  evaluation: '전통적인 비빔밥에서 꽤 멀리 왔습니다.', score: 67,
  mvp: '감자칩을 가져온 민수', riskyCombination: '아보카도 + 김치',
}

function Bowl({ small = false }: { small?: boolean }) {
  return <div className={`bowl ${small ? 'bowl-small' : ''}`} aria-hidden="true">
    <div className="bowl-inner">
      <div className="rice-grains">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${12 + ((i * 17) % 76)}%`, top: `${12 + ((i * 29) % 76)}%`, rotate: `${i * 31}deg` }} />)}</div>
      {['carrot', 'greens', 'mushroom', 'cabbage', 'sprouts'].map((veg) => <div className={`vegetable ${veg}`} key={veg}>{Array.from({ length: 7 }, (_, i) => <i key={i} />)}</div>)}
      <div className="egg"><div className="yolk" /></div>
      <div className="sesame">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ left: `${20 + ((i * 19) % 55)}%`, top: `${23 + ((i * 23) % 53)}%`, rotate: `${i * 34}deg` }} />)}</div>
    </div>
  </div>
}

function StartLink({ children = '랜덤 비빔밥 시작하기', secondary = false }: { children?: React.ReactNode; secondary?: boolean }) {
  return <a href="#/create" className={`button ${secondary ? 'button-dark' : 'button-primary'}`}>{children}<Icon name="arrow" /></a>
}

function ReportDemo() {
  const [participants, setParticipants] = useState<Participant[]>(
    initialParticipants.map(() => ({ name: '', ingredient: '' })),
  )
  const [result, setResult] = useState<{ report: Report; participants: Participant[]; real: boolean }>({ report: exampleReport, participants: initialParticipants, real: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestPending = useRef(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  function updateParticipant(index: number, field: keyof Participant, value: string) {
    setParticipants((current) => current.map((p, i) => i === index ? { ...p, [field]: value } : p))
    setError('')
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (requestPending.current) return
    const submitted = participants.map((p) => ({ name: p.name.trim(), ingredient: p.ingredient.trim() }))
    if (submitted.some((p) => !p.name || !p.ingredient)) {
      setError('참가자 이름과 가져온 재료를 모두 입력해주세요.')
      return
    }
    requestPending.current = true
    setLoading(true)
    setError('')
    try {
      const data = await apiRequest<{ report: Report }>('/api/report', { method: 'POST', body: { participants: submitted } })
      if (!isReport(data.report)) throw new Error('리포트 응답을 확인하지 못했습니다.')
      setResult({ report: data.report, participants: submitted, real: true })
      receiptRef.current?.focus({ preventScroll: true })
      receiptRef.current?.scrollIntoView({ block: 'start' })
    } catch (err) {
      setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : '응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
      requestPending.current = false
    }
  }

  return <div className="report-demo">
    <div className="receipt" aria-busy={loading} ref={receiptRef} tabIndex={-1} aria-label="오늘의 비빔밥 리포트">
      <div className="receipt-top"><span className="receipt-logo">비빔랜덤</span><span className="mini-label">{result.real ? 'AI REPORT' : 'SAMPLE REPORT'}</span></div>
      <div className="receipt-heading"><span className="report-bowl" aria-hidden="true">🍚</span><h3>오늘의 비빔밥 리포트</h3><p>{result.participants.length}명의 취향이 한 그릇에 모인 날</p></div>
      <div className="receipt-rule" />
      <div className="receipt-line"><span>오늘의 참가자</span><strong>{result.participants.length}명</strong></div>
      <div className="ingredient-list">{result.participants.map((p, i) => <span key={i} title={`${p.name}의 재료`}>{p.ingredient}</span>)}</div>
      <div className="evaluation" aria-live="polite"><span className="mini-label"><Icon name="spark" /> AI의 한마디</span><p>“{result.report.evaluation}”</p></div>
      <div className="score-row"><span>재료 궁합 점수</span><span><strong>{result.report.score}</strong><small> / 100</small></span></div>
      <div className="score-track" role="meter" aria-label="재료 궁합 점수" aria-valuenow={result.report.score} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${result.report.score}%` }} /></div>
      <div className="report-awards"><div><span>🏆 오늘의 MVP</span><strong>{result.report.mvp}</strong></div><div><span>🚨 오늘의 가장 위험한 선택</span><strong>{result.report.riskyCombination}</strong></div></div>
      <div className="receipt-rule" />
      <p className="receipt-ending">맛은 몰라도, 추억은 100점.</p><div className="barcode" aria-hidden="true" /><span className="receipt-id">BIBIM · RANDOM · GOOD TIMES</span>
    </div>
    {import.meta.env.VITE_API_BASE_URL ? <div className="report-controls"><a className="button button-dark report-button" href="#/create">우리 모임 리포트 만들기 <Icon name="arrow" /></a><p className="api-note">모임을 만들고 친구들의 재료를 모아 실제 리포트를 받아보세요.</p></div> : <form className="report-controls" onSubmit={generate}>
      <fieldset className="report-inputs" disabled={loading}>
        <legend>우리 모임 리포트 만들기</legend>
        <p className="report-form-description">누가 어떤 재료를 가져왔나요?<br />양식을 채우면 AI가 우리만의 리포트를 만들어드려요.</p>
        <div className="participant-headings"><span>참가자 이름</span><span>가져온 재료</span></div>
        {participants.map((p, i) => <div className="participant-entry" key={i}>
          <div className="participant-row">
            <input aria-label={`${i + 1}번 참가자 이름`} placeholder={`예: ${initialParticipants[i % initialParticipants.length].name}`} autoComplete="off" value={p.name} required maxLength={20} onChange={(e) => updateParticipant(i, 'name', e.target.value)} />
            <input aria-label={`${i + 1}번 참가자 재료`} placeholder={`예: ${initialParticipants[i % initialParticipants.length].ingredient}`} autoComplete="off" value={p.ingredient} required maxLength={40} onChange={(e) => updateParticipant(i, 'ingredient', e.target.value)} />
          </div>
          <button className="remove-participant" type="button" aria-label={`${i + 1}번 참가자 삭제`} disabled={participants.length === 1} onClick={() => { setParticipants((current) => current.filter((_, j) => j !== i)); setError('') }}><span aria-hidden="true">×</span></button>
        </div>)}
        <div className="participant-actions"><button type="button" className="add-participant" disabled={participants.length >= 8} onClick={() => { setParticipants((current) => [...current, { name: '', ingredient: '' }]); setError('') }}>+ 참가자 추가</button><span>{participants.length}명 / 최대 8명</span></div>
      </fieldset>
      <button className="button button-dark report-button" type="submit" disabled={loading}><Icon name="spark" />{loading ? 'AI가 열심히 맛을 상상하는 중…' : '우리 비빔밥 리포트 만들기'}</button>
      <p className="api-note">제출할 때만 AI가 평가해요 · 같은 이름과 재료는 다시 무료로 확인</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      <span className="sr-only" role="status">{loading ? 'AI 리포트 생성 중' : result.real ? 'AI 리포트 생성 완료' : ''}</span>
    </form>}
  </div>
}

function LandingPage() {
  const [missionIndex, setMissionIndex] = useState(0)
  const [drawCount, setDrawCount] = useState(1)
  const activeMission = missions[missionIndex]
  function drawMission() {
    setMissionIndex((current) => (current + 1 + Math.floor(Math.random() * (missions.length - 1))) % missions.length)
    setDrawCount((count) => count + 1)
  }

  return <>
    <a className="skip-link" href="#main">본문으로 바로가기</a>
    <header className="site-header page-width"><a href="#" className="wordmark" aria-label="비빔랜덤 홈"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>비빔랜덤<span className="brand-dot">.</span></a><a className="header-link" href="#how-it-works">어떻게 놀아요?<span aria-hidden="true">↗</span></a></header>
    <main id="main">
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="eyebrow"><span className="status-dot" />계획 없이 맛있게, 친구들과 재밌게</div><h1 id="hero-title">오늘 비빔밥,<br />아무도 결과를<br /><span className="highlight">모릅니다<span className="title-dot">.</span></span></h1><p className="hero-description">친구들과 각자 재료 하나씩 사오기.<br />대신 평범하게 사오면 재미없으니까 랜덤 미션 하나씩.</p><StartLink /><p className="hero-note"><Icon name="check" /> 준비물은 친구, 그리고 약간의 용기</p></div>
        <div className="hero-art" role="img" aria-label="달걀과 알록달록한 재료가 담긴 비빔밥. 어떤 재료를 가져올지는 각자의 선택입니다."><div className="art-orbit" /><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span><div className="ingredient-sticker sticker-one"><span>?</span>뭘 가져올지는<br /><strong>네 마음!</strong></div><div className="chopsticks"><i /><i /></div><Bowl /><div className="ingredient-sticker sticker-two"><Icon name="shuffle" /><strong>결과는 랜덤</strong><span>재미는 확정</span></div><div className="art-caption"><span aria-hidden="true">↖</span>이 조합… 괜찮을까?</div><span className="art-tag">ONE BOWL. MANY POSSIBILITIES.</span></div>
      </section>

      <div className="ticker" aria-hidden="true"><div>{Array.from({ length: 4 }, (_, i) => <span key={i}>재료는 자유롭게 <i>✳</i> 미션은 랜덤하게 <i>✳</i> 추억은 다 함께 <i>✳</i></span>)}</div></div>

      <section className="how-section page-width section-space" id="how-it-works" aria-labelledby="how-title"><div className="section-heading"><span className="section-kicker">HOW TO BIBIM</span><h2 id="how-title">복잡한 건 빼고,<br className="mobile-break" /> 재미만 비벼요.</h2><p>딱 세 단계. 그다음은 여러분의 몫!</p></div><div className="steps-grid">{[
        { n: '01', icon: 'people' as const, title: '친구들과 참가', description: <>같이 비빌 친구들을 모아요.<br />누가 뭘 가져올지는 아직 비밀.</>, color: 'peach' },
        { n: '02', icon: 'shuffle' as const, title: '각자 랜덤 미션 받기', description: <>미션은 우리가, 재료 선택은 여러분이.<br />어떤 재료든 내 마음대로 골라요.</>, color: 'yellow' },
        { n: '03', icon: 'bag' as const, title: '재료를 가져와 비빔밥 완성', description: <>하나둘 재료를 공개하고 함께 비벼요.<br />맛있어도, 이상해도 이미 재밌잖아요.</>, color: 'green' },
      ].map((step) => <article className="step" key={step.n}><div className="step-top"><span className={`step-icon ${step.color}`}><Icon name={step.icon} /></span><span className="step-number">{step.n}</span></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div></section>

      <section className="mission-section section-space" id="missions" aria-labelledby="mission-title"><div className="page-width"><div className="mission-intro"><div><span className="section-kicker">A LITTLE TWIST</span><h2 id="mission-title">평범한 장보기에<br />뜻밖의 미션 한 스푼.</h2></div><p>재료를 정해주진 않아요.<br />대신, 고르는 과정을 더 재밌게 만들어드려요.</p></div><div className="mission-layout"><div className="mission-deck"><article className={`active-mission ${activeMission.color}`}><div className="mission-card-top"><span><span className="status-dot" /> YOUR RANDOM MISSION</span><Icon name="shuffle" /></div><div className="mission-content" key={drawCount} aria-live="polite" aria-atomic="true"><span className="mission-category">{activeMission.category}</span><h3>{activeMission.title}</h3><p>{activeMission.hint}</p></div><div className="mission-card-bottom"><span>재료 선택은 당신의 몫!</span><span>{String(missionIndex + 1).padStart(2, '0')} / 08</span></div></article><button className="button button-dark draw-button" onClick={drawMission}><Icon name="shuffle" />미션 다시 뽑기<span aria-hidden="true">↻</span></button><p className="demo-note">마음에 드는 미션이 나올 때까지, 부담 없이!</p></div><div className="mission-examples"><div className="examples-heading"><span>이런 미션이 기다리고 있어요</span><span>8가지의 작은 반전</span></div><div className="examples-grid">{missions.map((mission, i) => <article key={mission.category} className={`example-card ${i === missionIndex ? 'selected' : ''}`}><span className={`example-icon ${mission.color}`}><Icon name={mission.icon} /></span><h3>{mission.title.replace('\n', ' ')}</h3><span className="example-number">{String(i + 1).padStart(2, '0')}</span></article>)}</div></div></div></div></section>

      <section className="report-section page-width section-space" aria-labelledby="report-title"><div className="report-copy"><span className="section-kicker">THE AFTER BIBIM</span><h2 id="report-title">한 그릇 비볐을 뿐인데,<br />이야기가 이렇게 많아요.</h2><p className="section-description">누가 비빔밥을 구했을까?<br />누가 가장 대담했을까?<br />우리만의 조합을 특별한 리포트로 남겨요.</p><div className="report-feature"><span className="feature-icon peach"><Icon name="spark" /></span><div><strong>AI가 남기는 솔직한 한마디</strong><p>맛을 상상하고, 조합의 케미를 평가해요.</p></div></div><div className="report-feature"><span className="feature-icon yellow"><span aria-hidden="true">★</span></span><div><strong>오늘의 주인공을 찾아서</strong><p>예상 밖 MVP부터 가장 모험적인 선택까지.</p></div></div><div className="report-aside"><span aria-hidden="true">↗</span>맛있으면 성공,<br />안 맛있으면 더 좋은 이야기.</div></div><ReportDemo /></section>

      <section className="vlog-section page-width" aria-labelledby="vlog-title"><div className="vlog-heading"><div><span className="soon-badge"><span className="status-dot" /> COMING SOON</span><h2 id="vlog-title">비비는 순간도,<br />우리의 한 편이 되도록.</h2><p>영상 몇 개만 찍어주세요.<br />나머지는 우리가 하나의 비빔밥 브이로그로 만들어드립니다.</p></div><div className="vlog-symbol" aria-hidden="true"><div className="video-window"><span>REC <i /></span><div><Icon name="play" /></div><span>00:00:15</span></div><div className="video-label">우리의 비빔로그.mp4 <span>✦</span></div></div></div><div className="shot-list">{['미션 확인하는 장면', '재료를 고르는 장면', '각자 가져온 재료 공개', '비빔밥 만드는 장면', '첫 입 먹은 반응', '최종 평가'].map((shot, i) => <div className="shot" key={shot}><span className="shot-number">{String(i + 1).padStart(2, '0')}</span><span>{shot}</span><Icon name="play" /></div>)}</div><p className="vlog-note">계속 촬영할 필요 없이, 이 순간들만. <span>브이로그 만들기는 준비 중이에요.</span></p></section>

      <section className="final-section page-width" aria-labelledby="final-title"><span className="final-spark" aria-hidden="true">✳</span><span className="section-kicker">GOOD FRIENDS. UNEXPECTED BIBIM.</span><h2 id="final-title">이번 모임,<br />그냥 밥만 먹지 말고 <span>비벼보세요.</span></h2><p>어떤 비빔밥이 될지는, 만나서 확인해요.</p><StartLink /><div className="final-dots" aria-hidden="true"><i /><i /><i /><i /></div></section>
    </main>
    <footer className="site-footer page-width"><a className="wordmark" href="#">비빔랜덤<span className="brand-dot">.</span></a><p>잘 먹고, 잘 웃고, 잘 비비자.</p><span>© {new Date().getFullYear()} 비빔랜덤</span></footer>
  </>
}

export default function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const update = () => {
      setHash(location.hash)
      if (location.hash.startsWith('#/')) window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  if (hash === '#/create') return <CreateGathering />
  const roomRoute = hash.match(/^#\/room\/([a-f0-9]{32})$/)
  if (roomRoute) return <GatheringRoom key={roomRoute[1]} roomId={roomRoute[1]} />
  return <LandingPage />
}
