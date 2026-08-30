import { createFileRoute } from '@tanstack/react-router'
import { getStore } from '@netlify/blobs'
import { and, asc, desc, eq, gt, or } from 'drizzle-orm'
import JSZip from 'jszip'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '../../../db/index.js'
import { announcements, attempts, mentors, questions, sessions, tests } from '../../../db/schema.js'

type Payload = Record<string, any>

const json = (data: unknown, status = 200) => Response.json(data, { status })
const fail = (message: string, status = 400) => json({ error: message }, status)
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase()
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':')
  if (!salt || !key) return false
  const candidate = scryptSync(password, salt, 64)
  const actual = Buffer.from(key, 'hex')
  return actual.length === candidate.length && timingSafeEqual(actual, candidate)
}

function safeMentor(mentor: typeof mentors.$inferSelect) {
  const { passwordHash: _, ...safe } = mentor
  return safe
}

function safeTest(test: typeof tests.$inferSelect) {
  const { accessToken: _, ...safe } = test
  return safe
}

async function currentMentor(token?: string) {
  if (!token) return null
  const rows = await db.select({ mentor: mentors }).from(sessions)
    .innerJoin(mentors, eq(sessions.mentorId, mentors.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return rows[0]?.mentor ?? null
}

async function uploadDataUrl(dataUrl: string, folder: string) {
  if (!dataUrl) return ''
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return dataUrl
  const extension = match[1].split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
  const key = `${folder}/${randomUUID()}.${extension}`
  const bytes = Buffer.from(match[2], 'base64')
  const content = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  await getStore('assessment-uploads').set(key, content)
  return `/api/app?action=asset&key=${encodeURIComponent(key)}`
}

async function mentorDashboard(mentorId: string) {
  const mentorTests = await db.select().from(tests).where(eq(tests.mentorId, mentorId)).orderBy(desc(tests.createdAt))
  const testIds = mentorTests.map((test) => test.id)
  const allAttempts = testIds.length
    ? (await Promise.all(testIds.map((id) => db.select().from(attempts).where(eq(attempts.testId, id))))).flat()
    : []
  return { tests: mentorTests, attempts: allAttempts }
}

async function publicTest(token: string) {
  const found = await db.select({ test: tests, mentor: mentors }).from(tests)
    .innerJoin(mentors, eq(tests.mentorId, mentors.id))
    .where(eq(tests.accessToken, token))
    .limit(1)
  return found[0]
}

async function duplicateReport(token: string, email: string, deviceId: string) {
  const found = await publicTest(token)
  if (!found) return null
  const duplicate = await db.select().from(attempts).where(and(
    eq(attempts.testId, found.test.id),
    or(eq(attempts.studentEmail, normalizeEmail(email)), eq(attempts.deviceId, deviceId)),
  )).limit(1)
  if (!duplicate[0]) return null
  return { attempt: duplicate[0], test: safeTest(found.test), mentor: safeMentor(found.mentor) }
}

async function buildTestArchive(test: typeof tests.$inferSelect, owner: typeof mentors.$inferSelect) {
  const [items, results] = await Promise.all([
    db.select().from(questions).where(eq(questions.testId, test.id)).orderBy(asc(questions.position)),
    db.select().from(attempts).where(eq(attempts.testId, test.id)).orderBy(desc(attempts.score), asc(attempts.timeSeconds)),
  ])
  const zip = new JSZip()
  zip.file('assessment.json', JSON.stringify({
    title: test.title,
    course: test.course,
    subject: test.subject,
    semester: test.semester,
    section: test.section,
    durationMinutes: test.durationMinutes,
    instructions: test.instructions,
    mentor: { name: owner.name, email: owner.username, designation: owner.designation },
    createdAt: test.createdAt,
    questions: items.map((item) => ({
      number: item.position,
      prompt: item.prompt,
      options: item.options,
      correctOption: item.correctIndex + 1,
    })),
  }, null, 2))
  zip.file('results.csv', [
    ['Rank', 'Student', 'Email', 'WhatsApp', 'Score', 'Total', 'Time seconds', 'Submitted at'].map(csvCell).join(','),
    ...results.map((attempt, index) => [index + 1, attempt.studentName, attempt.studentEmail, attempt.whatsapp, attempt.score, attempt.total, attempt.timeSeconds, attempt.submittedAt.toISOString()].map(csvCell).join(',')),
  ].join('\n'))
  zip.file('README.txt', `EIT assessment archive\n\n${test.title}\n${test.course} · ${test.subject}\n${test.semester} · Section ${test.section}\n\nThis archive was generated automatically before the assessment was permanently deleted.`)
  const store = getStore('assessment-uploads')
  for (const [filename, assetUrl] of [['teacher-signature', test.signatureUrl], ['institution-logo', owner.universityLogo]] as const) {
    const key = assetUrl.match(/[?&]key=([^&]+)/)?.[1]
    if (!key) continue
    const decodedKey = decodeURIComponent(key)
    const asset = await store.get(decodedKey, { type: 'arrayBuffer' })
    if (asset) zip.file(`${filename}.${decodedKey.split('.').pop() || 'bin'}`, asset as ArrayBuffer)
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

export const Route = createFileRoute('/api/app')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const action = url.searchParams.get('action')
        if (action === 'asset') {
          const key = url.searchParams.get('key') || ''
          if (!key || key.includes('..')) return new Response('Not found', { status: 404 })
          const file = await getStore('assessment-uploads').get(key, { type: 'arrayBuffer' })
          if (!file) return new Response('Not found', { status: 404 })
          const extension = key.split('.').pop()?.toLowerCase()
          const contentType = extension === 'png' ? 'image/png'
            : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
              : extension === 'svg' ? 'image/svg+xml'
                : extension === 'pdf' ? 'application/pdf'
                  : 'application/octet-stream'
          return new Response(file as ArrayBuffer, { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' } })
        }
        if (action === 'test') {
          const found = await publicTest(url.searchParams.get('token') || '')
          if (!found) return fail('This test link is invalid.', 404)
          if (found.test.linkExpiresAt < new Date()) return fail('This test link expired. Ask your mentor for a new link.', 410)
          const items = await db.select({ id: questions.id, prompt: questions.prompt, options: questions.options, position: questions.position })
            .from(questions)
            .where(eq(questions.testId, found.test.id))
            .orderBy(asc(questions.position))
          return json({ test: safeTest(found.test), mentor: safeMentor(found.mentor), questions: items })
        }
        const news = await db.select().from(announcements).orderBy(desc(announcements.createdAt))
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const mentor = await currentMentor(token)
        if (!mentor) return json({ announcements: news })
        return json({ announcements: news, mentor: safeMentor(mentor), ...(await mentorDashboard(mentor.id)) })
      },

      POST: async ({ request }) => {
        const body = await request.json() as Payload
        const action = body.action
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const mentor = await currentMentor(token)

        if (action === 'login') {
          const email = normalizeEmail(body.email || body.username)
          const found = await db.select().from(mentors).where(eq(mentors.username, email)).limit(1)
          if (!found[0] || !verifyPassword(String(body.password || ''), found[0].passwordHash)) return fail('Email or password is incorrect.', 401)
          const sessionId = randomBytes(32).toString('hex')
          await db.insert(sessions).values({ id: sessionId, mentorId: found[0].id, expiresAt: new Date(Date.now() + 7 * 86400000) })
          return json({ token: sessionId })
        }
        if (action === 'attempt-check') {
          const report = await duplicateReport(String(body.token || ''), String(body.email || ''), String(body.deviceId || ''))
          return json({ duplicate: Boolean(report), report })
        }
        if (action === 'admin-state') {
          const [people, allTests, allAttempts, news] = await Promise.all([
            db.select().from(mentors).orderBy(asc(mentors.createdAt)),
            db.select().from(tests).orderBy(desc(tests.createdAt)),
            db.select().from(attempts).orderBy(desc(attempts.submittedAt)),
            db.select().from(announcements).orderBy(desc(announcements.createdAt)),
          ])
          return json({ mentors: people.map(safeMentor), tests: allTests, attempts: allAttempts, announcements: news })
        }
        if (action === 'mentor-create') {
          const email = normalizeEmail(body.email || body.username)
          if (!body.name?.trim() || !email || !body.password) return fail('Name, email, and password are required.')
          const universityName = String(body.universityName || '').trim()
          const universityLogo = await uploadDataUrl(body.universityLogo, 'logos')
          await db.insert(mentors).values({
            id: randomUUID(),
            name: body.name.trim(),
            username: email,
            passwordHash: hashPassword(body.password),
            designation: 'Mentor',
            whatsapp: '',
            universityName,
            universityLogo,
            brandingLocked: Boolean(universityName || universityLogo),
          })
          return json({ ok: true }, 201)
        }
        if (action === 'mentor-credentials-reset') {
          const person = await db.select().from(mentors).where(eq(mentors.id, body.mentorId)).limit(1)
          if (!person[0]) return fail('Mentor account not found.', 404)
          const temporaryPassword = `EIT-${randomBytes(4).toString('hex')}`
          await db.update(mentors).set({ passwordHash: hashPassword(temporaryPassword) }).where(eq(mentors.id, person[0].id))
          return json({ email: person[0].username, temporaryPassword })
        }
        if (action === 'mentor-delete') {
          await db.delete(mentors).where(eq(mentors.id, body.mentorId))
          return json({ ok: true })
        }
        if (action === 'announcement-create') {
          if (!body.title?.trim() || !body.body?.trim()) return fail('Announcement title and message are required.')
          await db.insert(announcements).values({
            id: randomUUID(),
            title: body.title.trim(),
            body: body.body.trim(),
            attachmentUrl: await uploadDataUrl(body.attachment, 'announcements'),
          })
          return json({ ok: true }, 201)
        }
        if (action === 'branding-assign') {
          const people = await db.select().from(mentors).orderBy(asc(mentors.createdAt))
          const count = body.scope === 'all' ? people.length : Math.max(0, Number(body.count) || 0)
          const logo = await uploadDataUrl(body.logo, 'logos')
          for (const person of people.slice(0, count)) {
            await db.update(mentors).set({
              universityName: body.name?.trim() || person.universityName,
              universityLogo: logo || person.universityLogo,
              brandingLocked: true,
            }).where(eq(mentors.id, person.id))
          }
          return json({ ok: true, assigned: Math.min(count, people.length) })
        }
        if (!mentor) return fail('Please sign in again.', 401)
        if (action === 'mentor-branding') {
          if (mentor.brandingLocked) return fail('Institution identity was set by the administrator and is locked.', 403)
          await db.update(mentors).set({
            universityName: body.name.trim(),
            universityLogo: await uploadDataUrl(body.logo, 'logos') || mentor.universityLogo,
          }).where(eq(mentors.id, mentor.id))
          return json({ ok: true })
        }
        if (action === 'test-create') {
          if (!Array.isArray(body.questions) || !body.questions.length) return fail('Add at least one question.')
          if (!body.signature) return fail('Upload the teacher signature before creating the test.')
          const testId = randomUUID()
          const accessToken = randomBytes(18).toString('hex')
          await db.insert(tests).values({
            id: testId,
            mentorId: mentor.id,
            title: body.title.trim(),
            course: body.course.trim(),
            subject: body.subject.trim(),
            semester: body.semester.trim(),
            section: body.section.trim(),
            durationMinutes: Number(body.durationMinutes),
            instructions: body.instructions?.trim() || '',
            signatureUrl: await uploadDataUrl(body.signature, 'signatures'),
            accessToken,
            linkExpiresAt: new Date(Date.now() + 8 * 3600000),
          })
          await db.insert(questions).values(body.questions.map((item: Payload, index: number) => ({
            id: randomUUID(),
            testId,
            prompt: item.prompt.trim(),
            options: item.options.map((option: string) => option.trim()),
            correctIndex: Number(item.correctIndex),
            position: index + 1,
          })))
          return json({ ok: true, accessToken }, 201)
        }
        if (action === 'test-regenerate') {
          const accessToken = randomBytes(18).toString('hex')
          await db.update(tests).set({ accessToken, linkExpiresAt: new Date(Date.now() + 8 * 3600000) })
            .where(and(eq(tests.id, body.testId), eq(tests.mentorId, mentor.id)))
          return json({ accessToken })
        }
        return fail('Unknown action.', 404)
      },

      PUT: async ({ request }) => {
        const body = await request.json() as Payload
        if (body.action !== 'attempt-submit') return fail('Unknown action.', 404)
        const found = await publicTest(String(body.token || ''))
        if (!found || found.test.linkExpiresAt < new Date()) return fail('This test link is unavailable.', 410)
        const existing = await duplicateReport(body.token, body.email, body.deviceId)
        if (existing) return json({ duplicate: true, ...existing })
        if (!body.name?.trim() || !normalizeEmail(body.email) || !body.whatsapp?.trim()) return fail('Name, email, and WhatsApp number are required.')
        const items = await db.select().from(questions).where(eq(questions.testId, found.test.id)).orderBy(asc(questions.position))
        const score = items.reduce((total, item, index) => total + (Number(body.answers?.[index]) === item.correctIndex ? 1 : 0), 0)
        const attempt = {
          id: randomUUID(),
          testId: found.test.id,
          studentName: body.name.trim(),
          studentEmail: normalizeEmail(body.email),
          whatsapp: body.whatsapp.trim(),
          deviceId: body.deviceId,
          score,
          total: items.length,
          timeSeconds: Math.min(Number(body.timeSeconds) || 0, found.test.durationMinutes * 60),
        }
        await db.insert(attempts).values(attempt)
        return json({ attempt, test: safeTest(found.test), mentor: safeMentor(found.mentor) }, 201)
      },

      DELETE: async ({ request }) => {
        const body = await request.json() as Payload
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const mentor = await currentMentor(token)
        if (!mentor) return fail('Please sign in again.', 401)
        if (body.action !== 'test-delete') return fail('Unknown action.', 404)
        const owned = await db.select().from(tests).where(and(eq(tests.id, body.testId), eq(tests.mentorId, mentor.id))).limit(1)
        if (!owned[0]) return fail('Test not found.', 404)
        const archive = await buildTestArchive(owned[0], mentor)
        await db.delete(tests).where(eq(tests.id, owned[0].id))
        const signatureKey = owned[0].signatureUrl.match(/[?&]key=([^&]+)/)?.[1]
        if (signatureKey) await getStore('assessment-uploads').delete(decodeURIComponent(signatureKey))
        const filename = owned[0].title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'assessment'
        return new Response(archive as BodyInit, {
          headers: {
            'content-type': 'application/zip',
            'content-disposition': `attachment; filename="${filename}-archive.zip"`,
          },
        })
      },
    },
  },
})
