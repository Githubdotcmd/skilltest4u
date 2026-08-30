import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ArrowLeft, ArrowRight, Award, BarChart3, Bell, BookOpen, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, Copy, Download, Eye, FileArchive,
  FileSpreadsheet, GraduationCap, Image, LayoutDashboard, Link2, LockKeyhole,
  LogOut, Menu, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2, Upload,
  UserPlus, Users, X,
} from 'lucide-react'

export const Route = createFileRoute('/')({ component: App })

type Mentor = {
  id: string
  name: string
  username: string
  designation: string
  whatsapp: string
  universityName: string
  universityLogo: string
  brandingLocked: boolean
}
type Test = {
  id: string
  mentorId: string
  title: string
  course: string
  subject: string
  semester: string
  section: string
  durationMinutes: number
  instructions: string
  signatureUrl: string
  accessToken?: string
  linkExpiresAt: string
  createdAt?: string
}
type Attempt = {
  id: string
  testId: string
  studentName: string
  studentEmail: string
  whatsapp: string
  score: number
  total: number
  timeSeconds: number
  submittedAt?: string
}
type Announcement = { id: string; title: string; body: string; attachmentUrl: string; createdAt: string }
type Question = { prompt: string; options: string[]; correctIndex: number }
type Toast = { tone: 'success' | 'error'; message: string } | null
type AdminState = { mentors: Mentor[]; tests: Test[]; attempts: Attempt[]; announcements: Announcement[] }

const emptyQuestion = (): Question => ({ prompt: '', options: ['', '', '', ''], correctIndex: 0 })
const api = async (body?: Record<string, unknown>, method = 'POST', token = '') => {
  const response = await fetch('/api/app', {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Something went wrong.')
  return data
}
const fileData = (file?: File) => new Promise<string>((resolve) => {
  if (!file) return resolve('')
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.readAsDataURL(file)
})
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const testUrl = (token: string) => `${window.location.origin}/?test=${token}`
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

function App() {
  const [testToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('test') || sessionStorage.getItem('eit-active-test') || ''
  })
  const [session, setSession] = useState('')
  const [mentorData, setMentorData] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [adminOpen, setAdminOpen] = useState(false)
  const adminClicks = useRef(0)
  const [toast, setToast] = useState<Toast>(null)

  useEffect(() => {
    if (testToken) {
      sessionStorage.setItem('eit-active-test', testToken)
      window.history.replaceState({}, '', window.location.pathname)
    }
    const saved = localStorage.getItem('eit-session') || ''
    setSession(saved)
    fetch('/api/app', { headers: saved ? { authorization: `Bearer ${saved}` } : {} })
      .then((response) => response.json())
      .then((data) => {
        setAnnouncements(data.announcements || [])
        if (data.mentor) setMentorData(data)
      })
      .catch(() => {})
  }, [testToken])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const refreshMentor = async (activeSession = session) => {
    const response = await fetch('/api/app', { headers: { authorization: `Bearer ${activeSession}` } })
    const data = await response.json()
    if (!response.ok || !data.mentor) throw new Error('Session expired.')
    setMentorData(data)
    setAnnouncements(data.announcements || [])
  }
  const notify = (message: string, tone: 'success' | 'error' = 'success') => setToast({ message, tone })

  if (testToken) return <><StudentExperience token={testToken} notify={notify} />{toast && <ToastView toast={toast} />}</>
  if (adminOpen) return <><AdminPanel onExit={() => { setAdminOpen(false); adminClicks.current = 0 }} notify={notify} />{toast && <ToastView toast={toast} />}</>
  if (mentorData?.mentor) {
    return <>
      <MentorPanel
        data={mentorData}
        session={session}
        refresh={refreshMentor}
        announcements={announcements}
        notify={notify}
        onLogout={() => {
          localStorage.removeItem('eit-session')
          setSession('')
          setMentorData(null)
        }}
      />
      {toast && <ToastView toast={toast} />}
    </>
  }
  return <>
    <Login
      announcements={announcements}
      onLogin={async (form) => {
        try {
          const result = await api({ action: 'login', ...form })
          localStorage.setItem('eit-session', result.token)
          setSession(result.token)
          await refreshMentor(result.token)
          notify('Welcome. Your panel is ready.')
        } catch (error) {
          notify((error as Error).message, 'error')
        }
      }}
      onAdminClick={() => {
        adminClicks.current += 1
        if (adminClicks.current >= 5) setAdminOpen(true)
      }}
    />
    {toast && <ToastView toast={toast} />}
  </>
}

function Login({ onLogin, onAdminClick, announcements }: { onLogin: (data: any) => Promise<void>; onAdminClick: () => void; announcements: Announcement[] }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  return <main className="login-shell">
    <section className="login-story">
      <Brand />
      <div className="story-copy reveal">
        <p className="eyebrow">Evidence-led learning</p>
        <h1>Think clearly.<br /><em>Answer boldly.</em></h1>
        <p>EIT turns focused assessments into useful academic insight for mentors, institutions, and students.</p>
      </div>
      <div className="story-strip">
        <div><strong>8h</strong><span>secure test window</span></div>
        <div><strong>01</strong><span>fair attempt</span></div>
        <div><strong>Live</strong><span>visual outcomes</span></div>
      </div>
    </section>
    <section className="login-panel">
      <div className="login-card reveal delay-1">
        <div className="card-cap"><span>MENTOR ACCESS</span><LiveDateTime compact /></div>
        <div className="login-icon"><LockKeyhole /></div>
        <p className="eyebrow red">Your teaching panel</p>
        <h2>Continue with your assigned account.</h2>
        <p className="muted">Only the email and password created by the administrator are matched.</p>
        <form onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          await onLogin(form)
          setBusy(false)
        }}>
          <Field label="Email ID" type="email" value={form.email} onChange={(email: string) => setForm({ ...form, email })} placeholder="mentor@university.edu" />
          <Field label="Password" type="password" value={form.password} onChange={(password: string) => setForm({ ...form, password })} placeholder="••••••••" />
          <button className="button primary wide" disabled={busy}>{busy ? 'Opening panel…' : 'Open my panel'}<ArrowRight /></button>
        </form>
      </div>
      {announcements[0] && <div className="login-notice"><Bell /><div><strong>{announcements[0].title}</strong><span>{announcements[0].body}</span></div></div>}
      <footer className="secret-footer"><button onClick={onAdminClick}>EIT the favourite mentor, I said</button></footer>
    </section>
  </main>
}

function AdminPanel({ onExit, notify }: { onExit: () => void; notify: (message: string, tone?: 'success' | 'error') => void }) {
  const [state, setState] = useState<AdminState>({ mentors: [], tests: [], attempts: [], announcements: [] })
  const [tab, setTab] = useState('overview')
  const [mentorForm, setMentorForm] = useState({ name: '', email: '', password: '', universityName: '', universityLogo: '' })
  const [announcement, setAnnouncement] = useState({ title: '', body: '', attachment: '' })
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; temporaryPassword?: string } | null>(null)
  const load = async () => setState(await api({ action: 'admin-state' }))

  useEffect(() => { load().catch((error) => notify(error.message, 'error')) }, [])
  const average = state.attempts.length ? Math.round(state.attempts.reduce((sum, item) => sum + item.score / item.total * 100, 0) / state.attempts.length) : 0

  return <DashboardShell
    role="Administrator"
    name="EIT Control Room"
    onLogout={onExit}
    nav={[["overview", "Overview", LayoutDashboard], ["mentors", "Mentors", Users], ["announcements", "Bulletin", Bell], ["results", "Results", BarChart3]]}
    active={tab}
    setActive={setTab}
  >
    {tab === 'overview' && <>
      <Header eyebrow="Administrator command" title="The whole assessment picture." subtitle="Accounts, live tests, institution identity, and academic outcomes in one visual workspace." />
      <Stats items={[["Mentor accounts", state.mentors.length, Users], ["Assessments", state.tests.length, BookOpen], ["Student results", state.attempts.length, FileSpreadsheet], ["Average result", `${average}%`, Award]]} />
      <div className="dashboard-grid">
        <Panel kicker="Latest activity" title="Assessment pulse"><Activity tests={state.tests.slice(0, 6)} attempts={state.attempts} mentorName={(id: string) => state.mentors.find((item) => item.id === id)?.name || 'Deleted mentor'} /></Panel>
        <Panel kicker="Institution network" title="Mentor coverage"><div className="network-list">{state.mentors.slice(0, 6).map((mentor) => <button key={mentor.id} onClick={() => { setSelectedMentor(mentor); setCredentials({ email: mentor.username }) }}><Avatar name={mentor.name} /><span><strong>{mentor.name}</strong><small>{mentor.universityName || 'Identity not set'}</small></span><ChevronRight /></button>)}</div></Panel>
      </div>
    </>}

    {tab === 'mentors' && <>
      <Header eyebrow="Account administration" title="Create trusted teaching access." subtitle="Each account signs in with the exact email and password set here. Institution identity stays optional." />
      <div className="admin-columns">
        <Panel kicker="New account" title="Add a mentor or instructor">
          <form className="stack-form" onSubmit={async (event) => {
            event.preventDefault()
            try {
              await api({ action: 'mentor-create', ...mentorForm })
              setMentorForm({ name: '', email: '', password: '', universityName: '', universityLogo: '' })
              await load()
              notify('Mentor account created.')
            } catch (error) { notify((error as Error).message, 'error') }
          }}>
            <Field label="Full name" value={mentorForm.name} onChange={(name: string) => setMentorForm({ ...mentorForm, name })} placeholder="Dr. Ananya Sen" />
            <Field label="Email ID" type="email" value={mentorForm.email} onChange={(email: string) => setMentorForm({ ...mentorForm, email })} placeholder="ananya@university.edu" />
            <Field label="Password" type="password" value={mentorForm.password} onChange={(password: string) => setMentorForm({ ...mentorForm, password })} placeholder="Assign a secure password" />
            <Field label="University / college name (optional)" required={false} value={mentorForm.universityName} onChange={(universityName: string) => setMentorForm({ ...mentorForm, universityName })} placeholder="Institution name" />
            <UploadField label="University logo (optional)" accept="image/*" value={mentorForm.universityLogo} onFile={async (file: File) => setMentorForm({ ...mentorForm, universityLogo: await fileData(file) })} />
            <button className="button primary wide"><UserPlus />Create account</button>
          </form>
        </Panel>
        <Panel kicker={`${state.mentors.length} accounts`} title="Mentor directory">
          <div className="mentor-directory">{state.mentors.map((mentor) => <article key={mentor.id}>
            <button className="mentor-main" onClick={() => { setSelectedMentor(mentor); setCredentials({ email: mentor.username }) }}>
              <Avatar name={mentor.name} />
              <span><strong>{mentor.name}</strong><small>{mentor.username}</small><em>{mentor.universityName || 'Mentor can add institution identity'}</em></span>
              <ChevronRight />
            </button>
            <button className="icon-button danger" title="Delete mentor" onClick={async () => {
              if (!confirm(`Delete ${mentor.name} and all associated tests?`)) return
              await api({ action: 'mentor-delete', mentorId: mentor.id })
              await load()
              notify('Mentor account deleted.')
            }}><Trash2 /></button>
          </article>)}</div>
        </Panel>
      </div>
    </>}

    {tab === 'announcements' && <>
      <Header eyebrow="EIT bulletin" title="Publish one clear message." subtitle="Announcements appear directly on the mentor access screen." />
      <div className="admin-columns">
        <Panel kicker="Compose" title="New announcement"><form className="stack-form" onSubmit={async (event) => {
          event.preventDefault()
          try {
            await api({ action: 'announcement-create', ...announcement })
            setAnnouncement({ title: '', body: '', attachment: '' })
            await load()
            notify('Announcement published.')
          } catch (error) { notify((error as Error).message, 'error') }
        }}>
          <Field label="Title" value={announcement.title} onChange={(title: string) => setAnnouncement({ ...announcement, title })} placeholder="Assessment week update" />
          <TextField label="Message" value={announcement.body} onChange={(body: string) => setAnnouncement({ ...announcement, body })} placeholder="Write the mentor-facing update…" />
          <UploadField label="Attachment (optional)" required={false} accept="image/*,.pdf" value={announcement.attachment} onFile={async (file: File) => setAnnouncement({ ...announcement, attachment: await fileData(file) })} />
          <button className="button primary wide"><Bell />Publish bulletin</button>
        </form></Panel>
        <Panel kicker="Published" title="Recent notices"><div className="bulletin-list">{state.announcements.map((item) => <article key={item.id}><span>{formatDate(item.createdAt)}</span><strong>{item.title}</strong><p>{item.body}</p>{item.attachmentUrl && <a href={item.attachmentUrl} target="_blank" rel="noreferrer">Open attachment <ArrowRight /></a>}</article>)}</div></Panel>
      </div>
    </>}

    {tab === 'results' && <ResultsStudio mentors={state.mentors} tests={state.tests} attempts={state.attempts} />}

    {selectedMentor && credentials && <Modal onClose={() => { setSelectedMentor(null); setCredentials(null) }}>
      <p className="eyebrow red">Account access</p>
      <h2>{selectedMentor.name}</h2>
      <p className="modal-copy">Passwords are never displayed after creation. Resetting creates a one-time temporary password for secure access.</p>
      <div className="credential-box"><span>Email ID</span><strong>{credentials.email}</strong><button onClick={() => navigator.clipboard.writeText(credentials.email)}><Copy />Copy</button></div>
      {credentials.temporaryPassword && <div className="credential-box accent"><span>Temporary password</span><strong>{credentials.temporaryPassword}</strong><button onClick={() => navigator.clipboard.writeText(credentials.temporaryPassword || '')}><Copy />Copy</button></div>}
      <button className="button primary wide" onClick={async () => {
        const result = await api({ action: 'mentor-credentials-reset', mentorId: selectedMentor.id })
        setCredentials(result)
        notify('Temporary password created. Share it securely.')
      }}><RefreshCw />Reset temporary password</button>
    </Modal>}
  </DashboardShell>
}

function MentorPanel({ data, session, refresh, announcements, notify, onLogout }: any) {
  const { mentor, tests, attempts } = data as { mentor: Mentor; tests: Test[]; attempts: Attempt[] }
  const [tab, setTab] = useState('overview')
  return <DashboardShell
    role={mentor.designation}
    name={mentor.name}
    logo={mentor.universityLogo}
    onLogout={onLogout}
    nav={[["overview", "Overview", LayoutDashboard], ["create", "Create test", Plus], ["tests", "Test library", BookOpen], ["results", "Results", BarChart3], ["identity", "Institution", GraduationCap]]}
    active={tab}
    setActive={setTab}
  >
    {tab === 'overview' && <>
      <header className="mentor-welcome"><p>Welcome to your Panel</p><span>{mentor.designation}</span><h1>{mentor.name}</h1><LiveDateTime /></header>
      <Stats items={[["Assessments", tests.length, BookOpen], ["Student results", attempts.length, Users], ["Average score", attempts.length ? `${Math.round(attempts.reduce((sum, item) => sum + item.score / item.total * 100, 0) / attempts.length)}%` : '—', Award], ["Live links", tests.filter((item) => new Date(item.linkExpiresAt) > new Date()).length, Link2]]} />
      <div className="dashboard-grid"><Panel kicker="Institution" title="Academic identity"><BrandPreview mentor={mentor} large /><p className="panel-note">{mentor.brandingLocked ? 'Managed and locked by the administrator.' : 'You can complete this identity from the Institution section.'}</p></Panel><Panel kicker="Latest tests" title="Recent assessment activity"><Activity tests={tests.slice(0, 5)} attempts={attempts} mentorName={() => mentor.name} /></Panel></div>
      {announcements[0] && <div className="announcement-banner"><Bell /><div><span>EIT bulletin</span><strong>{announcements[0].title}</strong><p>{announcements[0].body}</p></div></div>}
    </>}
    {tab === 'create' && <TestBuilder session={session} refresh={refresh} notify={notify} onCreated={() => setTab('tests')} />}
    {tab === 'tests' && <TestLibrary tests={tests} session={session} refresh={refresh} notify={notify} />}
    {tab === 'results' && <ResultsStudio mentors={[mentor]} tests={tests} attempts={attempts} />}
    {tab === 'identity' && <>
      <Header eyebrow="Institution identity" title="Set the academic signature." subtitle="College name and logo appear across test access, visual dashboards, and scorecards." />
      <Panel kicker={mentor.brandingLocked ? 'Administrator managed' : 'Editable'} title="College identity"><BrandingForm mentor={mentor} session={session} refresh={refresh} notify={notify} /></Panel>
    </>}
  </DashboardShell>
}

function BrandingForm({ mentor, session, refresh, notify }: any) {
  const [name, setName] = useState(mentor.universityName || '')
  const [logo, setLogo] = useState('')
  return <form className="identity-form" onSubmit={async (event) => {
    event.preventDefault()
    try {
      await api({ action: 'mentor-branding', name, logo }, 'POST', session)
      await refresh()
      notify('Institution identity saved.')
    } catch (error) { notify((error as Error).message, 'error') }
  }}>
    <BrandPreview mentor={{ ...mentor, universityName: name, universityLogo: logo || mentor.universityLogo }} large />
    <div className="stack-form">
      <Field label="University / college name" disabled={mentor.brandingLocked} value={name} onChange={setName} placeholder="Your institution" />
      <UploadField label="University logo" disabled={mentor.brandingLocked} accept="image/*" value={logo || mentor.universityLogo} onFile={async (file: File) => setLogo(await fileData(file))} />
      {mentor.brandingLocked ? <div className="locked-note"><LockKeyhole />This identity was set by the administrator and cannot be changed here.</div> : <button className="button primary"><Image />Save institution identity</button>}
    </div>
  </form>
}

function TestBuilder({ session, refresh, notify, onCreated }: any) {
  const [form, setForm] = useState({ title: '', course: '', subject: '', semester: '', section: '', durationMinutes: '20', instructions: '', signature: '' })
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()])
  const [busy, setBusy] = useState(false)
  const updateQuestion = (index: number, patch: Partial<Question>) => setQuestions(questions.map((question, position) => position === index ? { ...question, ...patch } : question))

  const importQuestions = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      const imported = rows.slice(1).filter((row) => row.some(Boolean)).map((row) => ({
        prompt: row[0]?.trim() || '',
        options: [row[1], row[2], row[3], row[4]].map((item) => item?.trim() || ''),
        correctIndex: Math.max(0, Math.min(3, Number(row[5]) - 1)),
      }))
      if (!imported.length || imported.some((item) => !item.prompt || item.options.some((option) => !option))) throw new Error('Use the EIT sample columns and complete every question and option.')
      setQuestions(imported)
      notify(`${imported.length} questions imported.`)
    } catch (error) { notify((error as Error).message, 'error') }
  }

  return <>
    <Header eyebrow="Assessment studio" title="Build a focused test." subtitle="Create questions manually or import the sample CSV format, then issue a secure eight-hour link." />
    <form className="builder-layout" onSubmit={async (event) => {
      event.preventDefault()
      setBusy(true)
      try {
        await api({ action: 'test-create', ...form, durationMinutes: Number(form.durationMinutes), questions }, 'POST', session)
        await refresh()
        notify('Test created and secure link generated.')
        onCreated()
      } catch (error) { notify((error as Error).message, 'error') }
      setBusy(false)
    }}>
      <aside className="builder-settings">
        <div className="builder-sticky"><Panel kicker="01 · Details" title="Test information">
          <div className="stack-form">
            <Field label="Test title" value={form.title} onChange={(title: string) => setForm({ ...form, title })} placeholder="Types of Triangle" />
            <Field label="Course" value={form.course} onChange={(course: string) => setForm({ ...form, course })} placeholder="B.Sc." />
            <Field label="Subject" value={form.subject} onChange={(subject: string) => setForm({ ...form, subject })} placeholder="Mathematics" />
            <div className="field-grid"><Field label="Semester" value={form.semester} onChange={(semester: string) => setForm({ ...form, semester })} placeholder="Semester 2" /><Field label="Section" value={form.section} onChange={(section: string) => setForm({ ...form, section })} placeholder="A" /></div>
            <Field label="Duration in minutes" type="number" min="1" value={form.durationMinutes} onChange={(durationMinutes: string) => setForm({ ...form, durationMinutes })} placeholder="20" />
            <TextField label="Instructions" required={false} value={form.instructions} onChange={(instructions: string) => setForm({ ...form, instructions })} placeholder="Read every question carefully…" />
            <UploadField label="Teacher signature" accept="image/*" value={form.signature} onFile={async (file: File) => setForm({ ...form, signature: await fileData(file) })} />
          </div>
        </Panel></div>
      </aside>
      <section className="question-workspace">
        <div className="import-bar"><div><FileSpreadsheet /><span><strong>Bulk question import</strong><small>CSV columns: question, options A–D, correct option 1–4</small></span></div><div><button type="button" className="button soft" onClick={downloadQuestionSample}><Download />Sample CSV</button><label className="button ink"><Upload />Import CSV<input type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && importQuestions(event.target.files[0])} /></label></div></div>
        {questions.map((question, questionIndex) => <article className="question-editor" key={questionIndex}>
          <header><span>QUESTION {String(questionIndex + 1).padStart(2, '0')}</span>{questions.length > 1 && <button type="button" onClick={() => setQuestions(questions.filter((_, index) => index !== questionIndex))}><Trash2 />Remove</button>}</header>
          <TextField label="Question" value={question.prompt} onChange={(prompt: string) => updateQuestion(questionIndex, { prompt })} placeholder="Write the question clearly" />
          <div className="option-grid">{question.options.map((option, optionIndex) => <label className={question.correctIndex === optionIndex ? 'option-field correct' : 'option-field'} key={optionIndex}><button type="button" onClick={() => updateQuestion(questionIndex, { correctIndex: optionIndex })}>{String.fromCharCode(65 + optionIndex)}</button><input required value={option} onChange={(event) => { const options = [...question.options]; options[optionIndex] = event.target.value; updateQuestion(questionIndex, { options }) }} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} /><Check /></label>)}</div>
          <small className="answer-hint">Select the letter button to mark the correct answer.</small>
        </article>)}
        <div className="builder-actions"><button type="button" className="button soft" onClick={() => setQuestions([...questions, emptyQuestion()])}><Plus />Add question</button><button className="button primary" disabled={busy}>{busy ? 'Creating test…' : `Create ${questions.length}-question test`}<ArrowRight /></button></div>
      </section>
    </form>
  </>
}

function TestLibrary({ tests, session, refresh, notify }: { tests: Test[]; session: string; refresh: () => Promise<void>; notify: (message: string, tone?: 'success' | 'error') => void }) {
  const copy = async (token: string) => {
    await navigator.clipboard.writeText(testUrl(token))
    notify('Secure test link copied.')
  }
  return <>
    <Header eyebrow="Link control" title="Your test library." subtitle="Every test link stays valid for eight hours. Deleting a test downloads its complete archive first." />
    <div className="test-grid">{tests.map((test) => {
      const live = new Date(test.linkExpiresAt) > new Date()
      return <article className="test-card" key={test.id}>
        <div className="test-card-top"><span className={live ? 'status live' : 'status'}>{live ? 'Live' : 'Expired'}</span><small>{test.durationMinutes} min</small></div>
        <h3>{test.title}</h3><p>{test.course} · {test.subject}</p>
        <div className="test-meta"><span>{test.semester}</span><span>Section {test.section}</span></div>
        <div className="link-box"><Link2 /><span>{test.accessToken ? testUrl(test.accessToken).replace(/^https?:\/\//, '') : 'Secure link'}</span></div>
        <p className="expiry">Expires {formatDate(test.linkExpiresAt)}</p>
        <div className="button-row">
          {test.accessToken && <button className="button ink" onClick={() => copy(test.accessToken || '')}><Copy />Copy</button>}
          <button className="button soft" onClick={async () => { const result = await api({ action: 'test-regenerate', testId: test.id }, 'POST', session); await refresh(); await copy(result.accessToken) }}><RefreshCw />Renew</button>
          <button className="button danger" onClick={async () => {
            if (!confirm('Download the archive and permanently delete this test?')) return
            const response = await fetch('/api/app', { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ action: 'test-delete', testId: test.id }) })
            if (!response.ok) { const error = await response.json().catch(() => ({})); notify(error.error || 'Unable to delete test.', 'error'); return }
            const blob = await response.blob()
            downloadBlob(`${slug(test.title)}-archive.zip`, blob)
            await refresh()
            notify('Archive downloaded and test deleted.')
          }}><FileArchive />Archive & delete</button>
        </div>
      </article>
    })}{!tests.length && <Empty icon={BookOpen} title="No tests yet" text="Create your first assessment from the studio." />}</div>
  </>
}

function ResultsStudio({ mentors, tests, attempts }: { mentors: Mentor[]; tests: Test[]; attempts: Attempt[] }) {
  const [mentorId, setMentorId] = useState(mentors[0]?.id || '')
  const mentorTests = tests.filter((test) => test.mentorId === mentorId)
  const [testId, setTestId] = useState(mentorTests[0]?.id || '')
  const selectedTest = tests.find((test) => test.id === testId && test.mentorId === mentorId) || mentorTests[0]
  const selectedMentor = mentors.find((mentor) => mentor.id === mentorId) || mentors[0]
  const ranked = useMemo(() => attempts.filter((attempt) => attempt.testId === selectedTest?.id).sort((a, b) => b.score - a.score || a.timeSeconds - b.timeSeconds), [attempts, selectedTest?.id])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const visible = selectedIds.length ? ranked.filter((attempt) => selectedIds.includes(attempt.id)) : ranked

  useEffect(() => {
    const next = tests.find((test) => test.mentorId === mentorId)
    setTestId(next?.id || '')
    setSelectedIds([])
  }, [mentorId])
  useEffect(() => setSelectedIds([]), [testId])

  const courses = unique(mentorTests.map((test) => test.course))
  const [course, setCourse] = useState('')
  const [subject, setSubject] = useState('')
  const [semester, setSemester] = useState('')
  const [section, setSection] = useState('')
  const filteredTests = mentorTests.filter((test) => (!course || test.course === course) && (!subject || test.subject === subject) && (!semester || test.semester === semester) && (!section || test.section === section))

  return <>
    <Header eyebrow="Visual results" title="See performance, not print layouts." subtitle="Choose a teacher, academic group, and students to build a branded visual leaderboard, CSV, or PDF." />
    <div className="results-filters">
      {mentors.length > 1 && <SelectField label="Teacher" value={mentorId} onChange={setMentorId} options={mentors.map((mentor) => [mentor.id, mentor.name])} />}
      <SelectField label="Course" value={course} onChange={(value: string) => { setCourse(value); setSubject(''); setSemester(''); setSection('') }} options={[["", "All courses"], ...courses.map((value) => [value, value])]} />
      <SelectField label="Subject" value={subject} onChange={setSubject} options={[["", "All subjects"], ...unique(mentorTests.filter((test) => !course || test.course === course).map((test) => test.subject)).map((value) => [value, value])]} />
      <SelectField label="Semester" value={semester} onChange={setSemester} options={[["", "All semesters"], ...unique(mentorTests.filter((test) => (!course || test.course === course) && (!subject || test.subject === subject)).map((test) => test.semester)).map((value) => [value, value])]} />
      <SelectField label="Section" value={section} onChange={setSection} options={[["", "All sections"], ...unique(mentorTests.filter((test) => (!course || test.course === course) && (!subject || test.subject === subject) && (!semester || test.semester === semester)).map((test) => test.section)).map((value) => [value, value])]} />
      <SelectField label="Assessment" value={selectedTest?.id || ''} onChange={setTestId} options={filteredTests.map((test) => [test.id, test.title])} />
    </div>
    {selectedTest && selectedMentor ? <>
      <VisualLeaderboard mentor={selectedMentor} test={selectedTest} attempts={visible} />
      <div className="result-tools">
        <span>{selectedIds.length ? `${selectedIds.length} students selected` : 'All students included'}</span>
        <button className="button soft" onClick={() => setSelectedIds(selectedIds.length ? [] : ranked.map((attempt) => attempt.id))}><Check />{selectedIds.length ? 'Clear selection' : 'Select all'}</button>
        <button className="button ink" onClick={() => exportResultsCsv(selectedMentor, selectedTest, visible)}><FileSpreadsheet />CSV</button>
        <button className="button primary" onClick={() => exportDashboardPdf(selectedMentor, selectedTest, visible)}><Download />Visual PDF</button>
      </div>
      <div className="result-table-wrap"><table><thead><tr><th>Select</th><th>Rank</th><th>Student</th><th>Contact</th><th>Score</th><th>Time</th></tr></thead><tbody>{ranked.map((attempt, index) => <tr key={attempt.id}><td><input type="checkbox" checked={selectedIds.includes(attempt.id)} onChange={() => setSelectedIds(selectedIds.includes(attempt.id) ? selectedIds.filter((id) => id !== attempt.id) : [...selectedIds, attempt.id])} /></td><td>{String(index + 1).padStart(2, '0')}</td><td><strong>{attempt.studentName}</strong><span>{attempt.studentEmail}</span></td><td>{attempt.whatsapp}</td><td><b>{attempt.score}/{attempt.total}</b></td><td>{formatTime(attempt.timeSeconds)}</td></tr>)}</tbody></table></div>
    </> : <Empty icon={BarChart3} title="No matching assessment" text="Adjust the academic filters or create a test first." />}
  </>
}

function VisualLeaderboard({ mentor, test, attempts }: { mentor: Mentor; test: Test; attempts: Attempt[] }) {
  const best = attempts[0]
  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.score / item.total * 100, 0) / attempts.length) : 0
  return <section className="visual-board">
    <header><BrandPreview mentor={mentor} /><div><span>VISUAL LEADERBOARD</span><LiveDateTime compact /></div></header>
    <div className="visual-title"><div><p>{test.course} · {test.subject}</p><h2>{test.title}</h2><span>{test.semester} · Section {test.section}</span></div><div className="visual-stat"><strong>{attempts.length}</strong><span>students</span></div><div className="visual-stat accent"><strong>{average}%</strong><span>average</span></div></div>
    <div className="podium">{attempts.slice(0, 3).map((attempt, index) => <article key={attempt.id}><span>0{index + 1}</span><Avatar name={attempt.studentName} /><strong>{attempt.studentName}</strong><small>{attempt.score}/{attempt.total} · {formatTime(attempt.timeSeconds)}</small></article>)}{!best && <Empty icon={Award} title="No submissions yet" text="Student results appear here after submission." />}</div>
    <div className="performance-bars">{attempts.slice(0, 8).map((attempt, index) => <div key={attempt.id}><span>{index + 1}</span><strong>{attempt.studentName}</strong><i><b style={{ width: `${attempt.score / attempt.total * 100}%` }} /></i><em>{Math.round(attempt.score / attempt.total * 100)}%</em></div>)}</div>
    <footer><span>Verified by</span>{test.signatureUrl && <img src={test.signatureUrl} alt="Teacher signature" />}<strong>{mentor.name}</strong><small>{mentor.designation}</small></footer>
  </section>
}

function StudentExperience({ token, notify }: { token: string; notify: (message: string, tone?: 'success' | 'error') => void }) {
  const [payload, setPayload] = useState<any>(null)
  const [error, setError] = useState('')
  const [student, setStudent] = useState({ name: '', email: '', whatsapp: '' })
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [seconds, setSeconds] = useState(0)
  const [report, setReport] = useState<any>(null)
  const startTime = useRef(0)
  const [deviceId] = useState(() => {
    if (typeof window === 'undefined') return ''
    const saved = localStorage.getItem('eit-device-id') || crypto.randomUUID()
    localStorage.setItem('eit-device-id', saved)
    return saved
  })

  useEffect(() => {
    fetch(`/api/app?action=test&token=${encodeURIComponent(token)}`).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPayload(data)
      setSeconds(data.test.durationMinutes * 60)
    }).catch((reason) => setError(reason.message))
  }, [token])

  useEffect(() => {
    if (!started || report) return
    const interval = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(interval); return 0 }
      return value - 1
    }), 1000)
    return () => window.clearInterval(interval)
  }, [started, report])

  const submit = async () => {
    if (Object.keys(answers).length < payload.questions.length && !confirm('Some questions are unanswered. Submit anyway?')) return
    try {
      const result = await api({ action: 'attempt-submit', token, ...student, answers, deviceId, timeSeconds: Math.round((Date.now() - startTime.current) / 1000) }, 'PUT')
      setReport(result)
      sessionStorage.removeItem('eit-active-test')
      notify(result.duplicate ? 'Your existing scorecard is ready.' : 'Assessment submitted successfully.')
    } catch (reason) { notify((reason as Error).message, 'error') }
  }
  useEffect(() => { if (started && seconds === 0 && payload) submit() }, [seconds])

  if (error) return <ErrorPage message={error} />
  if (!payload) return <Loading />
  if (report) return <ReportCard report={report} />
  const { test, mentor, questions } = payload

  if (!started) return <main className="student-access">
    <section className="student-story">
      <BrandPreview mentor={mentor} large />
      <div className="student-copy"><p className="eyebrow red">Focused assessment</p><h1>Think clearly.<br /><em>Answer boldly.</em></h1><p>{test.instructions || `A fair, focused concept test prepared by ${mentor.name}. One verified attempt per student.`}</p></div>
      <div className="test-detail-shape"><span>{test.subject} · {test.course}</span><h2>{test.title}</h2><div><p><Clock3 />{test.durationMinutes} minutes</p><p><BookOpen />{questions.length} questions</p><p><ShieldCheck />One attempt</p></div></div>
      <div className="access-rules"><Rule icon={ShieldCheck} title="Fair attempt" text="Email and device are checked" /><Rule icon={Award} title="Instant scorecard" text="Duplicate attempts return to results" /></div>
    </section>
    <section className="student-form-panel"><div className="student-form-card">
      <div className="card-cap"><span>STUDENT ACCESS</span><LiveDateTime compact /></div>
      <p className="eyebrow red">Before you begin</p><h2>Tell us who is taking the test.</h2>
      <form onSubmit={async (event) => {
        event.preventDefault()
        try {
          const check = await api({ action: 'attempt-check', token, email: student.email, deviceId })
          if (check.duplicate) { setReport(check.report); sessionStorage.removeItem('eit-active-test'); notify('This test was already completed. Opening your scorecard.') }
          else { startTime.current = Date.now(); setStarted(true) }
        } catch (reason) { notify((reason as Error).message, 'error') }
      }}>
        <Field label="Full name" value={student.name} onChange={(name: string) => setStudent({ ...student, name })} placeholder="Your full name" />
        <Field label="Email ID" type="email" value={student.email} onChange={(email: string) => setStudent({ ...student, email })} placeholder="student@university.edu" />
        <Field label="WhatsApp number" type="tel" value={student.whatsapp} onChange={(whatsapp: string) => setStudent({ ...student, whatsapp })} placeholder="+91 98765 43210" />
        <button className="button primary wide">Enter the test <ArrowRight /></button>
      </form>
      <small className="accuracy-note">By continuing, you confirm these details are accurate.</small>
    </div></section>
  </main>

  const question = questions[current]
  return <main className="test-shell">
    <header className="test-header"><BrandPreview mentor={mentor} /><div className="timer"><Clock3 /><span>TIME LEFT</span><strong>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong></div><div className="candidate"><Avatar name={student.name} /><div><strong>{student.name}</strong><span>{test.course} · {test.section}</span></div></div></header>
    <div className="test-body"><aside className="question-map"><p className="eyebrow">Question map</p><strong>{Object.keys(answers).length} of {questions.length} answered</strong><div className="progress"><span style={{ width: `${Object.keys(answers).length / questions.length * 100}%` }} /></div><div className="map-grid">{questions.map((_: any, index: number) => <button className={`${index === current ? 'current ' : ''}${answers[index] !== undefined ? 'answered' : ''}`} onClick={() => setCurrent(index)} key={index}>{answers[index] !== undefined ? <Check /> : index + 1}</button>)}</div><blockquote>Clarity first. Confidence follows.</blockquote></aside>
      <section className="question-stage"><div className="question-label"><span>{test.subject}</span><strong>QUESTION {current + 1} / {questions.length}</strong></div><span className="question-number">{String(current + 1).padStart(2, '0')}</span><h1>{question.prompt}</h1><p>Select one answer</p><div className="answers">{question.options.map((option: string, index: number) => <button className={answers[current] === index ? 'selected' : ''} onClick={() => setAnswers({ ...answers, [current]: index })} key={index}><span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong><i>{answers[current] === index ? <Check /> : null}</i></button>)}</div><div className="test-actions"><button className="button soft" disabled={current === 0} onClick={() => setCurrent(current - 1)}><ArrowLeft />Previous</button>{current < questions.length - 1 ? <button className="button primary" onClick={() => setCurrent(current + 1)}>Next question<ArrowRight /></button> : <button className="button primary" onClick={submit}>Submit test<Check /></button>}</div></section>
    </div>
  </main>
}

function ReportCard({ report }: { report: any }) {
  const { attempt, test, mentor } = report
  const percentage = Math.round(attempt.score / attempt.total * 100)
  const openPdf = async (preview: boolean) => {
    const doc = await createReportPdf(attempt, test, mentor)
    if (preview) window.open(doc.output('bloburl').toString(), '_blank', 'noopener,noreferrer')
    else doc.save(`${slug(attempt.studentName)}-${slug(test.title)}-scorecard.pdf`)
  }
  return <main className="report-page">
    <section className="report-sheet">
      <header><BrandPreview mentor={mentor} /><span>VERIFIED SCORECARD</span></header>
      <div className="report-grid"><div className="report-copy"><p className="eyebrow red">Assessment complete</p><h1>Keep<br />building,<br /><em>{attempt.studentName}.</em></h1><p>Your selected and correct answers remain private. This one-page scorecard confirms the evaluated result.</p></div><div className="score-orbit"><strong>{attempt.score}</strong><span>/ {attempt.total}</span><small>{percentage}% score</small></div><div className="report-facts"><div><span>COURSE</span><strong>{test.course}</strong></div><div><span>SUBJECT</span><strong>{test.subject}</strong></div><div><span>TIME USED</span><strong>{formatTime(attempt.timeSeconds)}</strong></div></div></div>
      <div className="scorecard"><div><span>STUDENT</span><strong>{attempt.studentName}</strong><p>{attempt.studentEmail}<br />{attempt.whatsapp}</p></div><div><span>ACADEMIC GROUP</span><strong>{test.semester} · Section {test.section}</strong><p>{test.title}</p></div><div className="signature">{test.signatureUrl && <img src={test.signatureUrl} alt="Teacher signature" />}<span>{mentor.name}</span><small>{mentor.designation}</small></div></div>
      <footer><span>Generated live by EIT</span><LiveDateTime compact /></footer>
    </section>
    <div className="report-actions"><button className="button soft" onClick={() => openPdf(true)}><Eye />Preview PDF</button><button className="button primary" onClick={() => openPdf(false)}><Download />Download PDF</button></div>
  </main>
}

function DashboardShell({ children, role, name, logo, onLogout, nav, active, setActive }: any) {
  const [mobile, setMobile] = useState(false)
  return <div className="app-shell">
    {mobile && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobile(false)} />}
    <aside className={mobile ? 'sidebar open' : 'sidebar'}><div className="brand inverse"><div className="brand-mark">{logo ? <img src={logo} alt="Institution logo" /> : <GraduationCap />}</div><div><strong>EIT</strong><span>Evidence in teaching</span></div></div><nav>{nav.map(([id, label, Icon]: any) => <button className={active === id ? 'active' : ''} onClick={() => { setActive(id); setMobile(false) }} key={id}><Icon />{label}<ChevronRight /></button>)}</nav><div className="sidebar-foot"><span>Signed in as</span><strong>{name}</strong><small>{role}</small><button onClick={onLogout}><LogOut />Sign out</button></div></aside>
    <main className="dashboard-main"><header className="mobile-header"><button onClick={() => setMobile(!mobile)}><Menu /></button><strong>EIT</strong><span>{name}</span></header>{children}</main>
  </div>
}

function Brand() { return <div className="brand"><div className="brand-mark"><GraduationCap /></div><div><strong>EIT</strong><span>Evidence in teaching</span></div></div> }
function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <header className="page-header"><p className="eyebrow red">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></header> }
function Panel({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) { return <section className="panel"><div className="panel-head"><div><span>{kicker}</span><h2>{title}</h2></div><i /></div>{children}</section> }
function Stats({ items }: { items: any[] }) { return <div className="stats-grid">{items.map(([label, value, Icon]) => <article key={label}><Icon /><div><span>{label}</span><strong>{value}</strong></div></article>)}</div> }
function Field({ label, value, onChange, placeholder, type = 'text', required = true, disabled = false, ...props }: any) { return <label className="field"><span>{label}</span><input required={required} disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} {...props} /></label> }
function TextField({ label, value, onChange, placeholder, required = true }: any) { return <label className="field"><span>{label}</span><textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function SelectField({ label, value, onChange, options }: any) { return <label className="field select-field"><span>{label}</span><div><select value={value} onChange={(event) => onChange(event.target.value)}>{!options.length && <option value="">No options available</option>}{options.map(([optionValue, optionLabel]: string[]) => <option value={optionValue} key={`${optionValue}-${optionLabel}`}>{optionLabel}</option>)}</select><ChevronDown /></div></label> }
function UploadField({ label, onFile, accept, value, required = true, disabled = false }: any) { return <label className={`upload-field ${value ? 'uploaded' : ''} ${disabled ? 'disabled' : ''}`}><Upload /><span><strong>{label}</strong><small>{value ? 'File uploaded successfully' : disabled ? 'Managed by administrator' : 'Click to choose a file'}</small></span>{value && <Check />}<input disabled={disabled} required={required && !value} type="file" accept={accept} onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} /></label> }
function Empty({ icon: Icon, title, text }: any) { return <div className="empty"><Icon /><strong>{title}</strong><span>{text}</span></div> }
function Avatar({ name }: { name: string }) { return <div className="avatar">{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div> }
function BrandPreview({ mentor, large = false }: { mentor: Mentor; large?: boolean }) { return <div className={`institution-brand ${large ? 'large' : ''}`}>{mentor.universityLogo ? <img src={mentor.universityLogo} alt="Institution logo" /> : <div className="logo-placeholder"><GraduationCap /></div>}<div><strong>{mentor.universityName || 'EIT Academic Network'}</strong><span>Evidence in teaching</span></div></div> }
function Rule({ icon: Icon, title, text }: any) { return <div><Icon /><span><strong>{title}</strong><small>{text}</small></span></div> }
function ToastView({ toast }: { toast: NonNullable<Toast> }) { return <div className={`toast ${toast.tone}`}>{toast.tone === 'success' ? <Check /> : <X />}<span>{toast.message}</span></div> }
function Loading() { return <main className="loading"><div className="brand-mark"><GraduationCap /></div><span>Preparing your assessment…</span></main> }
function ErrorPage({ message }: { message: string }) { return <main className="error-page"><ShieldCheck /><p className="eyebrow red">Access unavailable</p><h1>This assessment cannot open.</h1><p>{message}</p><a className="button ink" href="/">Return to EIT</a></main> }
function Activity({ tests, attempts, mentorName }: any) { return <div className="activity">{tests.map((test: Test) => <div key={test.id}><BookOpen /><div><strong>{test.title}</strong><span>{mentorName(test.mentorId)} · {attempts.filter((attempt: Attempt) => attempt.testId === test.id).length} submissions</span></div></div>)}{!tests.length && <Empty icon={Sparkles} title="Ready for activity" text="New tests appear here." />}</div> }
function LiveDateTime({ compact = false }: { compact?: boolean }) { const [now, setNow] = useState(new Date()); useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer) }, []); return <time className={compact ? 'live-time compact' : 'live-time'}><CalendarDays /><span>{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(now)}</span><strong>{new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: compact ? undefined : '2-digit' }).format(now)}</strong></time> }
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="modal-layer"><button className="modal-scrim" aria-label="Close" onClick={onClose} /><section className="modal-card"><button className="modal-close" onClick={onClose}><X /></button>{children}</section></div> }

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1 }
    else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(field); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field); rows.push(row); row = []; field = ''
    } else field += character
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
function downloadQuestionSample() { downloadText('eit-mcq-bulk-upload-sample.csv', 'question,option_a,option_b,option_c,option_d,correct_option\n"Which angle is present in a right triangle?","30 degrees","45 degrees","90 degrees","120 degrees",3\n"A triangle has how many sides?","2","3","4","5",2', 'text/csv') }
function downloadText(name: string, content: string, type: string) { downloadBlob(name, new Blob([content], { type })) }
function downloadBlob(name: string, blob: Blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href) }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'eit' }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))] }
function exportResultsCsv(mentor: Mentor, test: Test, attempts: Attempt[]) { const rows = [['Rank', 'Student', 'Email', 'WhatsApp', 'Score', 'Total', 'Time', 'College', 'Teacher'], ...attempts.map((attempt, index) => [index + 1, attempt.studentName, attempt.studentEmail, attempt.whatsapp, attempt.score, attempt.total, formatTime(attempt.timeSeconds), mentor.universityName, mentor.name])]; downloadText(`${slug(test.title)}-leaderboard.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv') }

async function imageData(url: string) {
  if (!url) return ''
  const response = await fetch(url)
  const blob = await response.blob()
  return await fileData(new File([blob], 'image', { type: blob.type }))
}
async function createReportPdf(attempt: Attempt, test: Test, mentor: Mentor) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFillColor(247, 243, 236); doc.rect(0, 0, 297, 210, 'F')
  doc.setFillColor(35, 32, 30); doc.roundedRect(12, 13, 273, 143, 4, 4, 'F')
  doc.setFillColor(225, 49, 57); doc.rect(12, 13, 5, 143, 'F')
  doc.setTextColor(247, 243, 236); doc.setFont('times', 'bold'); doc.setFontSize(15); doc.text(mentor.universityName || 'EIT Academic Network', 27, 30)
  doc.setTextColor(225, 49, 57); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('VERIFIED ASSESSMENT SCORECARD', 27, 42)
  doc.setTextColor(247, 243, 236); doc.setFont('times', 'bold'); doc.setFontSize(31); doc.text(`Keep building, ${attempt.studentName}.`, 27, 70, { maxWidth: 128 })
  doc.setTextColor(178, 170, 163); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`${test.title}\n${test.course} · ${test.subject}\n${test.semester} · Section ${test.section}`, 27, 96, { lineHeightFactor: 1.55 })
  doc.setDrawColor(95, 88, 82); doc.circle(191, 77, 36)
  doc.setTextColor(247, 243, 236); doc.setFont('times', 'bold'); doc.setFontSize(35); doc.text(String(attempt.score), 191, 74, { align: 'center' })
  doc.setTextColor(178, 170, 163); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`/ ${attempt.total}`, 191, 85, { align: 'center' })
  doc.setTextColor(225, 49, 57); doc.setFont('helvetica', 'bold'); doc.text(`${Math.round(attempt.score / attempt.total * 100)}% SCORE`, 191, 94, { align: 'center' })
  doc.setTextColor(178, 170, 163); doc.setFontSize(8); doc.text('TIME USED', 244, 61); doc.text('EMAIL', 244, 92); doc.text('WHATSAPP', 244, 123)
  doc.setTextColor(247, 243, 236); doc.setFontSize(11); doc.text(formatTime(attempt.timeSeconds), 244, 70); doc.text(attempt.studentEmail, 244, 101, { maxWidth: 35 }); doc.text(attempt.whatsapp, 244, 132, { maxWidth: 35 })
  doc.setTextColor(62, 56, 52); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('VERIFIED BY', 20, 174)
  if (test.signatureUrl) { try { const signature = await imageData(test.signatureUrl); if (signature) doc.addImage(signature, 20, 179, 34, 12) } catch {} }
  doc.setFont('times', 'bold'); doc.setFontSize(14); doc.text(mentor.name, 61, 185); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(mentor.designation, 61, 191)
  doc.setTextColor(120, 111, 104); doc.text(`Generated by EIT · ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, 277, 190, { align: 'right' })
  return doc
}
async function exportDashboardPdf(mentor: Mentor, test: Test, attempts: Attempt[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFillColor(35, 32, 30); doc.rect(0, 0, 210, 58, 'F'); doc.setFillColor(225, 49, 57); doc.rect(0, 0, 6, 58, 'F')
  doc.setTextColor(247, 243, 236); doc.setFont('times', 'bold'); doc.setFontSize(20); doc.text(mentor.universityName || 'EIT Academic Network', 15, 18)
  doc.setTextColor(225, 49, 57); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('VISUAL LEADERBOARD', 15, 28)
  doc.setTextColor(247, 243, 236); doc.setFont('times', 'bold'); doc.setFontSize(25); doc.text(test.title, 15, 43, { maxWidth: 125 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(184, 176, 169); doc.text(`${test.course} · ${test.subject} · ${test.semester} · Section ${test.section}`, 15, 52)
  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.score / item.total * 100, 0) / attempts.length) : 0
  doc.setTextColor(247, 243, 236); doc.setFont('times', 'bold'); doc.setFontSize(24); doc.text(String(attempts.length), 163, 26, { align: 'center' }); doc.text(`${average}%`, 190, 26, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(184, 176, 169); doc.text('STUDENTS', 163, 34, { align: 'center' }); doc.text('AVERAGE', 190, 34, { align: 'center' })
  autoTable(doc, { startY: 67, head: [['Rank', 'Student', 'Email', 'WhatsApp', 'Score', 'Time']], body: attempts.map((attempt, index) => [index + 1, attempt.studentName, attempt.studentEmail, attempt.whatsapp, `${attempt.score}/${attempt.total}`, formatTime(attempt.timeSeconds)]), theme: 'grid', headStyles: { fillColor: [35, 32, 30], textColor: [247, 243, 236] }, alternateRowStyles: { fillColor: [247, 243, 236] }, styles: { fontSize: 8, cellPadding: 3 } })
  const finalY = (doc as any).lastAutoTable?.finalY || 240
  if (test.signatureUrl) { try { const signature = await imageData(test.signatureUrl); if (signature) doc.addImage(signature, 15, Math.min(finalY + 8, 275), 30, 10) } catch {} }
  doc.setTextColor(62, 56, 52); doc.setFont('times', 'bold'); doc.setFontSize(11); doc.text(mentor.name, 50, Math.min(finalY + 15, 282)); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(mentor.designation, 50, Math.min(finalY + 20, 287))
  doc.save(`${slug(test.title)}-visual-leaderboard.pdf`)
}
