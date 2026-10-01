import { createServer } from 'node:http'
import { createApiHandler } from './api.ts'

const api = createApiHandler({
  apiKey: process.env.LINER_API_KEY,
  model: process.env.LINER_MODEL || 'liner-mark-1.1',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  allowStandaloneReport: false,
})

const port = Number(process.env.PORT || 8787)
const server = createServer((req, res) => {
  void api(req, res).then((handled) => {
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'API 주소를 확인해주세요.' }))
    }
  }).catch(() => {
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
})
server.requestTimeout = 15000
server.headersTimeout = 10000
server.listen(port, '0.0.0.0', () => console.log(`비빔랜덤 API 서버 실행: 포트 ${port}`))
