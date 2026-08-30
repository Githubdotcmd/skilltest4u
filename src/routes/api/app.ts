import { createFileRoute } from '@tanstack/react-router'
import { getStore } from '@netlify/blobs'
import { and, asc, desc, eq, gt, or } from 'drizzle-orm'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '../../../db/index.js'
import { announcements, attempts, mentors, questions, sessions, tests } from '../../../db/schema.js'

type Payload = Record<string, any>

const json = (data: unknown, status = 200) => Response.json(data, { status })
const fail = (message: string, status = 400) => json({ error: message }, status)

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

async function currentMentor(token?: string) {
  if (!token) return null
  const rows = await db.select({ mentor: mentors }).from(sessions)
    .innerJoin(mentors, eq(sessions.mentorId, mentors.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date()))).limit(1)
  return rows[0]?.mentor ?? null
}

async function uploadDataUrl(dataUrl: string, folder: string) {
  if (!dataUrl) return ''
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return dataUrl
  const extension = match[1].split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
  const key = `${folder}/${randomUUID()}.${extension}`
  await getStore('assessment-uploads').set(key, Buffer.from(match[2], 'base64'))
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
          const contentType = extension === 'png' ? 'image/png' : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'svg' ? 'image/svg+xml' : extension === 'pdf' ? 'application/pdf' : 'application/octet-stream'
          return new Response(file as ArrayBuffer, { headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' } })
        }
        if (action === 'test') {
          const token = url.searchParams.get('token') || ''
          const found = await db.select({ test: tests, mentor: mentors }).from(tests)
            .innerJoin(mentors, eq(tests.mentorId, mentors.id)).where(eq(tests.accessToken, token)).limit(1)
          if (!found[0]) return fail('This test link is invalid.', 404)
          if (found[0].test.linkExpiresAt < new Date()) return fail('This test link expired. Ask your mentor for a new link.', 410)
          const items = await db.select({ id: questions.id, prompt: questions.prompt, options: questions.options, position: questions.position })
            .from(questions).where(eq(questions.testId, found[0].test.id)).orderBy(asc(questions.position))
          const { passwordHash: _, ...safeMentor } = found[0].mentor
          return json({ test: found[0].test, mentor: safeMentor, questions: items })
        }
        const news = await db.select().from(announcements).orderBy(desc(announcements.createdAt))
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const mentor = await currentMentor(token)
        if (!mentor) return json({ announcements: news })
        const { passwordHash: _, ...safeMentor } = mentor
        return json({ announcements: news, mentor: safeMentor, ...(await mentorDashboard(mentor.id)) })
      },
      POST: async ({ request }) => {
        const body = await request.json() as Payload
        const action = body.action
        const token = request.headers.get('authorization')?.replace('Bearer ', '')
        const mentor = await currentMentor(token)

        if (action === 'login') {
          const found = await db.select().from(mentors).where(eq(mentors.username, String(body.username).trim())).limit(1)
          const person = found[0]
          if (!person || !verifyPassword(String(body.password), person.passwordHash) || person.designation.toLowerCase() !== String(body.designation).trim().toLowerCase() || person.whatsapp.replace(/\D/g, '') !== String(body.whatsapp).replace(/\D/g, '')) return fail('Credentials, designation, or WhatsApp number did not match.', 401)
          const sessionToken = randomBytes(32).toString('hex')
          await db.insert(sessions).values({ id: sessionToken, mentorId: person.id, expiresAt: new Date(Date.now() + 7 * 86400000) })
          return json({ token: sessionToken })
        }

        if (action === 'admin-state') {
          const people = await db.select({ id: mentors.id, name: mentors.name, username: mentors.username, designation: mentors.designation, whatsapp: mentors.whatsapp, universityName: mentors.universityName, universityLogo: mentors.universityLogo, brandingLocked: mentors.brandingLocked, createdAt: mentors.createdAt }).from(mentors).orderBy(asc(mentors.createdAt))
          const allTests = await db.select().from(tests).orderBy(desc(tests.createdAt))
          const allAttempts = await db.select().from(attempts).orderBy(desc(attempts.submittedAt))
          const news = await db.select().from(announcements).orderBy(desc(announcements.createdAt))
          return json({ mentors: people, tests: allTests, attempts: allAttempts, announcements: news })
        }
        if (action === 'mentor-create') {
          if (!body.name || !body.username || !body.password || !body.designation || !body.whatsapp) return fail('Complete all mentor credential fields.')
          await db.insert(mentors).values({ id: randomUUID(), name: body.name.trim(), username: body.username.trim(), passwordHash: hashPassword(body.password), designation: body.designation.trim(), whatsapp: body.whatsapp.trim(), universityName: body.universityName?.trim() || '', universityLogo: await uploadDataUrl(body.universityLogo, 'logos') })
          return json({ ok: true }, 201)
        }
        if (action === 'mentor-delete') {
          await db.delete(mentors).where(eq(mentors.id, body.mentorId))
          return json({ ok: true })
        }
        if (action === 'announcement-create') {
          await db.insert(announcements).values({ id: randomUUID(), title: body.title.trim(), body: body.body.trim(), attachmentUrl: await uploadDataUrl(body.attachment, 'announcements') })
          return json({ ok: true }, 201)
        }
        if (action === 'branding-assign') {
          const people = await db.select().from(mentors).orderBy(asc(mentors.createdAt))
          const count = body.scope === 'all' ? people.length : Math.max(0, Number(body.count) || 0)
          const logo = await uploadDataUrl(body.logo, 'logos')
          for (const person of people.slice(0, count)) await db.update(mentors).set({ universityName: body.name.trim(), universityLogo: logo || person.universityLogo, brandingLocked: true }).where(eq(mentors.id, person.id))
          return json({ ok: true, assigned: count })
        }
        if (!mentor) return fail('Please sign in again.', 401)
        if (action === 'mentor-branding') {
          if (mentor.brandingLocked) return fail('Branding is managed by the administrator.', 403)
          await db.update(mentors).set({ universityName: body.name.trim(), universityLogo: await uploadDataUrl(body.logo, 'logos') || mentor.universityLogo }).where(eq(mentors.id, mentor.id))
          return json({ ok: true })
        }
        if (action === 'test-create') {
          if (!Array.isArray(body.questions) || !body.questions.length) return fail('Add at least one question.')
          const testId = randomUUID()
          const accessToken = randomBytes(18).toString('hex')
          await db.insert(tests).values({ id: testId, mentorId: mentor.id, title: body.title.trim(), course: body.course.trim(), subject: body.subject.trim(), semester: body.semester.trim(), section: body.section.trim(), durationMinutes: Number(body.durationMinutes), instructions: body.instructions?.trim() || '', signatureUrl: await uploadDataUrl(body.signature, 'signatures'), accessToken, linkExpiresAt: new Date(Date.now() + 8 * 3600000) })
          await db.insert(questions).values(body.questions.map((item: Payload, index: number) => ({ id: randomUUID(), testId, prompt: item.prompt.trim(), options: item.options.map((option: string) => option.trim()), correctIndex: Number(item.correctIndex), position: index + 1 })))
          return json({ ok: true, accessToken }, 201)
        }
        if (action === 'test-regenerate') {
          const accessToken = randomBytes(18).toString('hex')
          await db.update(tests).set({ accessToken, linkExpiresAt: new Date(Date.now() + 8 * 3600000) }).where(and(eq(tests.id, body.testId), eq(tests.mentorId, mentor.id)))
          return json({ accessToken })
        }
        if (action === 'attempt-submit') {
          return fail('Use the public submission action.', 400)
        }
        return fail('Unknown action.', 404)
      },
      PUT: async ({ request }) => {
        const body = await request.json() as Payload
        if (body.action !== 'attempt-submit') return fail('Unknown action.', 404)
        const found = await db.select({ test: tests, mentor: mentors }).from(tests).innerJoin(mentors, eq(tests.mentorId, mentors.id)).where(eq(tests.accessToken, body.token)).limit(1)
        if (!found[0] || found[0].test.linkExpiresAt < new Date()) return fail('This test link is unavailable.', 410)
        const duplicate = await db.select().from(attempts).where(and(eq(attempts.testId, found[0].test.id), or(eq(attempts.studentEmail, String(body.email).trim().toLowerCase()), eq(attempts.deviceId, body.deviceId)))).limit(1)
        if (duplicate[0]) return fail('This email or device already submitted this test.', 409)
        const items = await db.select().from(questions).where(eq(questions.testId, found[0].test.id)).orderBy(asc(questions.position))
        const score = items.reduce((total, item, index) => total + (Number(body.answers?.[index]) === item.correctIndex ? 1 : 0), 0)
        const attempt = { id: randomUUID(), testId: found[0].test.id, studentName: body.name.trim(), studentEmail: body.email.trim().toLowerCase(), whatsapp: body.whatsapp?.trim() || '', deviceId: body.deviceId, score, total: items.length, timeSeconds: Math.min(Number(body.timeSeconds) || 0, found[0].test.durationMinutes * 60) }
        await db.insert(attempts).values(attempt)
        const { passwordHash: _, ...safeMentor } = found[0].mentor
        return json({ attempt, test: found[0].test, mentor: safeMentor }, 201)
      },
    },
  },
})
