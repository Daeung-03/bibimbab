import { randomBytes, randomInt } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { missions } from '../src/missions.ts'
import type { Participant, Report, RoomPhase, RoomView } from '../src/types.ts'
import { ApiError, createReportGenerator } from './liner.ts'

export interface ApiOptions {
  apiKey?: string
  model: string
  allowedOrigins?: string[]
  allowStandaloneReport?: boolean
}

interface Member {
  id: string
  token: string
  name: string
  ingredient: string
  missionIndex: number | null
}
interface Room {
  id: string
  title: string
  hostId: string
  phase: RoomPhase
  expiresAt: number
  members: Member[]
  report: Report | null
  generating: boolean
}

const ROOM_LIFETIME = 24 * 60 * 60 * 1000
const makeId = () => randomBytes(16).toString('hex')
const makeMember = (name: string): Member => ({ id: makeId(), token: randomBytes(32).toString('hex'), name, ingredient: '', missionIndex: null })

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(data))
}

function text(value: unknown, max: number, label: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, `${label}을(를) 1~${max}자로 입력해주세요.`)
  return value.trim()
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'JSON 요청이 필요합니다.')
  let body = ''
  for await (const chunk of req) {
    body += chunk.toString()
    if (Buffer.byteLength(body) > 4096) throw new ApiError(413, '입력 내용이 너무 깁니다.')
  }
  try {
    const data: unknown = JSON.parse(body)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data as Record<string, unknown>
  } catch {
    throw new ApiError(400, '입력 내용을 확인해주세요.')
  }
}

function view(room: Room, me?: Member): RoomView {
  return {
    id: room.id, title: room.title, phase: room.phase, expiresAt: room.expiresAt,
    members: room.members.map((m) => ({
      id: m.id, name: m.name, isHost: m.id === room.hostId, hasIngredient: !!m.ingredient,
      ingredient: room.phase === 'completed' || m.id === me?.id ? m.ingredient || null : null,
      missionIndex: room.phase === 'completed' ? m.missionIndex : null,
    })),
    me: me ? { id: me.id, isHost: me.id === room.hostId, missionIndex: me.missionIndex } : null,
    report: room.report, generating: room.generating,
  }
}

export function createApiHandler(options: ApiOptions) {
  const rooms = new Map<string, Room>()
  const generateReport = createReportGenerator(options.apiKey, options.model)
  const allowedOrigins = new Set(options.allowedOrigins ?? [])
  let lastRoomCreated = 0

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = req.url?.split('?')[0] ?? ''
    if (!path.startsWith('/api/')) return false
    res.setHeader('Vary', 'Origin')
    try {
      if (path === '/api/health' && req.method === 'GET') {
        send(res, 200, { ok: true })
        return true
      }
      const origin = req.headers.origin
      const sameOrigin = origin === `http://${req.headers.host}`
      if (origin && !sameOrigin && !allowedOrigins.has(origin)) throw new ApiError(403, '이 페이지의 API 접근이 허용되지 않았습니다. 서버의 ALLOWED_ORIGINS를 확인해주세요.')
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return true
      }
      if (req.method !== 'GET' && !origin) throw new ApiError(403, '모임 페이지에서 요청해주세요.')
      // Sweep on requests without keeping a background timer alive.
      for (const [id, room] of rooms) if (room.expiresAt <= Date.now() && !room.generating) rooms.delete(id)

      if (path === '/api/report' && req.method === 'POST') {
        if (!options.allowStandaloneReport) throw new ApiError(403, '모임을 만들고 재료를 입력한 뒤 리포트를 생성해주세요.')
        const body = await readBody(req)
        if (!Array.isArray(body.participants) || body.participants.length < 1 || body.participants.length > 8) throw new ApiError(400, '1~8명의 이름과 재료를 입력해주세요.')
        const participants: Participant[] = body.participants.map((p: unknown) => {
          if (!p || typeof p !== 'object') throw new ApiError(400, '이름과 재료를 입력해주세요.')
          const member = p as Record<string, unknown>
          return { name: text(member.name, 20, '이름'), ingredient: text(member.ingredient, 40, '재료') }
        })
        send(res, 200, { report: await generateReport(participants) })
        return true
      }

      if (path === '/api/rooms' && req.method === 'POST') {
        const body = await readBody(req)
        const title = text(body.title, 40, '모임 이름')
        const name = text(body.name, 20, '이름')
        if (rooms.size >= 100) throw new ApiError(503, '지금 모임이 가득 찼어요. 나중에 다시 만들어주세요.')
        if (Date.now() - lastRoomCreated < 1000) throw new ApiError(429, '잠시 후 다시 만들어주세요.')
        lastRoomCreated = Date.now()
        const host = makeMember(name)
        const room: Room = { id: makeId(), title, hostId: host.id, phase: 'waiting', expiresAt: Date.now() + ROOM_LIFETIME, members: [host], report: null, generating: false }
        rooms.set(room.id, room)
        send(res, 201, { room: view(room, host), token: host.token })
        return true
      }

      const route = path.match(/^\/api\/rooms\/([a-f0-9]{32})(?:\/(join|distribute|ingredient|report))?$/)
      if (!route) throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.')
      const room = rooms.get(route[1])
      if (!room || room.expiresAt <= Date.now()) throw new ApiError(404, '모임이 만료되었거나 서버가 다시 시작됐어요. 새 모임을 만들어주세요.')
      const token = req.headers.authorization?.replace(/^Bearer /, '')
      const me = token ? room.members.find((m) => m.token === token) : undefined
      if (token && !me) throw new ApiError(401, '참가 정보를 찾을 수 없습니다. 다시 참가해주세요.')
      const action = route[2]

      if (!action && req.method === 'GET') {
        send(res, 200, { room: view(room, me) })
        return true
      }
      if (action === 'join' && req.method === 'POST') {
        if (me) {
          send(res, 200, { room: view(room, me), token: me.token })
          return true
        }
        if (room.phase !== 'waiting') throw new ApiError(409, '미션 배분이 끝나 참가가 마감됐어요.')
        const body = await readBody(req)
        const name = text(body.name, 20, '이름')
        if (room.members.length >= 8) throw new ApiError(409, '최대 8명까지 참가할 수 있어요.')
        if (room.members.some((m) => m.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new ApiError(409, '같은 이름이 있어요. 구분할 수 있는 별명을 입력해주세요.')
        const member = makeMember(name)
        room.members.push(member)
        send(res, 201, { room: view(room, member), token: member.token })
        return true
      }
      if (!me) throw new ApiError(401, '먼저 이름을 입력해 참가해주세요.')

      if (action === 'distribute' && req.method === 'POST') {
        if (me.id !== room.hostId) throw new ApiError(403, '모임장만 미션을 배분할 수 있어요.')
        if (room.phase !== 'waiting') throw new ApiError(409, '이미 미션을 배분했어요.')
        if (room.members.length < 2) throw new ApiError(409, '친구 한 명 이상이 참가하면 시작할 수 있어요.')
        const order = missions.map((_, i) => i)
        for (let i = order.length - 1; i > 0; i--) {
          const j = randomInt(i + 1)
          ;[order[i], order[j]] = [order[j], order[i]]
        }
        room.members.forEach((m, i) => { m.missionIndex = order[i] })
        room.phase = 'shopping'
        send(res, 200, { room: view(room, me) })
        return true
      }
      if (action === 'ingredient' && req.method === 'PUT') {
        if (room.phase !== 'shopping' || room.generating) throw new ApiError(409, '지금은 재료를 수정할 수 없어요.')
        const body = await readBody(req)
        me.ingredient = text(body.ingredient, 40, '재료')
        send(res, 200, { room: view(room, me) })
        return true
      }
      if (action === 'report' && req.method === 'POST') {
        if (me.id !== room.hostId) throw new ApiError(403, '모임장만 리포트를 생성할 수 있어요.')
        if (room.report) {
          send(res, 200, { room: view(room, me) })
          return true
        }
        if (room.phase !== 'shopping') throw new ApiError(409, '먼저 미션을 배분해주세요.')
        if (room.generating) throw new ApiError(409, '리포트를 만드는 중이에요. 잠시만 기다려주세요.')
        if (room.members.some((m) => !m.ingredient)) throw new ApiError(409, '모두 재료를 입력하면 리포트를 만들 수 있어요.')
        room.generating = true
        try {
          room.report = await generateReport(room.members.map((m) => ({ name: m.name, ingredient: m.ingredient })))
          room.phase = 'completed'
        } finally {
          room.generating = false
        }
        send(res, 200, { room: view(room, me) })
        return true
      }
      throw new ApiError(405, '지원하지 않는 요청입니다.')
    } catch (error) {
      if (!res.headersSent) send(res, error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' })
      return true
    }
  }
}
