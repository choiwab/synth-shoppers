const SESSION_PARAMS = ['agent_id', 'run_id', 'persona'] as const

export interface SimSession {
  agentId: string | null
  runId: string | null
  persona: string | null
}

export function readSimSession(): SimSession {
  if (typeof window === 'undefined') return { agentId: null, runId: null, persona: null }
  const params = new URLSearchParams(window.location.search)
  return {
    agentId: params.get('agent_id') || params.get('agentId'),
    runId: params.get('run_id') || params.get('runId'),
    persona: params.get('persona'),
  }
}

export function scopedStorageKey(base: string): string {
  const { agentId, runId } = readSimSession()
  if (!agentId && !runId) return base
  return `${base}:${runId ?? 'run'}:${agentId ?? 'agent'}`
}

export function withSimSession(path: string): string {
  if (typeof window === 'undefined') return path
  const current = new URLSearchParams(window.location.search)
  const [pathname, query = ''] = path.split('?')
  const next = new URLSearchParams(query)

  SESSION_PARAMS.forEach((key) => {
    const value = current.get(key)
    if (value && !next.has(key)) next.set(key, value)
  })

  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
