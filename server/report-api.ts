import type { Plugin } from 'vite'
import { createApiHandler, type ApiOptions } from './api.ts'

export function reportApi(options: ApiOptions): Plugin {
  const handler = createApiHandler({ ...options, allowStandaloneReport: true })
  return {
    name: 'bibim-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res).then((handled) => { if (!handled) next() }).catch(next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handler(req, res).then((handled) => { if (!handled) next() }).catch(next)
      })
    },
  }
}
