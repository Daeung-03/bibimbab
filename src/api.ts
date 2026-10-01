const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export class RequestError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: { method?: string; token?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(75000)
    const response = await fetch(`${apiBase}${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new RequestError('API 서버에 연결할 수 없어요. 배포 시 VITE_API_BASE_URL 설정을 확인해주세요.', response.status)
    const data = await response.json()
    if (!response.ok) throw new RequestError(data.error || '요청을 처리하지 못했어요.', response.status)
    return data as T
  } catch (error) {
    if (error instanceof RequestError) throw error
    if (options.signal?.aborted) throw error
    throw new RequestError('서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요. 처음 접속은 조금 오래 걸릴 수 있어요.')
  }
}

export function sessionKey(roomId: string) {
  return `bibim-room:${apiBase || 'local'}:${roomId}`
}
