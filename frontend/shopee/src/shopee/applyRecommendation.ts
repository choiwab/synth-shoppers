import type { ConfigPatch, JsonPatchOp, ListingConfig, Recommendation } from '@/types/contracts'

/**
 * config_patch convention (owner H4): an RFC-6902 JSON Patch array, e.g.
 *   [{ "op": "replace", "path": "/price", "value": 29.9 },
 *    { "op": "add", "path": "/photos/-", "value": { "url": "...", "type": "lifestyle" } }]
 * A legacy dotted-path object ({ "seller.response_rate": 86 }) is also accepted.
 * Either way "Test this fix" applies it, re-renders, and the change is diffable.
 */

export interface ConfigChange {
  op: 'add' | 'replace' | 'remove'
  path: string // human-readable dotted path (e.g. "photos[]", "seller.response_rate")
  before: unknown
  after: unknown
}

/* ── JSON Pointer helpers ─────────────────────────────────────────────────── */

function unescape(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~')
}

function pointerTokens(path: string): string[] {
  if (path === '' || path === '/') return []
  return path
    .split('/')
    .slice(1)
    .map(unescape)
}

function readPointer(root: unknown, path: string): unknown {
  const tokens = pointerTokens(path)
  let cur: unknown = root
  for (const t of tokens) {
    if (t === '-') return undefined
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[t]
  }
  return cur
}

function applyJsonPatchOp(root: Record<string, unknown>, op: JsonPatchOp): void {
  const tokens = pointerTokens(op.path)
  if (tokens.length === 0) return
  let parent: unknown = root
  for (let i = 0; i < tokens.length - 1; i++) {
    if (parent == null || typeof parent !== 'object') return
    parent = (parent as Record<string, unknown>)[tokens[i]]
  }
  if (parent == null || typeof parent !== 'object') return
  const last = tokens[tokens.length - 1]

  if (Array.isArray(parent)) {
    const arr = parent as unknown[]
    const idx = last === '-' ? arr.length : Number(last)
    if (op.op === 'remove') arr.splice(last === '-' ? arr.length - 1 : idx, 1)
    else if (op.op === 'add') arr.splice(idx, 0, op.value)
    else arr[idx] = op.value // replace
  } else {
    const obj = parent as Record<string, unknown>
    if (op.op === 'remove') delete obj[last]
    else obj[last] = op.value // add | replace
  }
}

function humanPath(path: string): string {
  const tokens = pointerTokens(path)
  return tokens.map((t) => (t === '-' ? '[]' : t)).join('.')
}

/* ── apply ───────────────────────────────────────────────────────────────── */

/** Apply a config_patch (JSON Patch array or dotted-path object). */
export function applyPatch(
  config: ListingConfig,
  patch: ConfigPatch,
): { config: ListingConfig; changes: ConfigChange[] } {
  const next = structuredClone(config) as unknown as Record<string, unknown>
  const changes: ConfigChange[] = []

  if (Array.isArray(patch)) {
    for (const op of patch) {
      const before = readPointer(config, op.path)
      applyJsonPatchOp(next, op)
      changes.push({ op: op.op, path: humanPath(op.path), before, after: op.value })
    }
  } else {
    // legacy dotted-path object form
    for (const [dotted, after] of Object.entries(patch)) {
      const jsonPath = '/' + dotted.replace(/\./g, '/')
      const before = readPointer(config, jsonPath)
      applyJsonPatchOp(next, { op: 'replace', path: jsonPath, value: after })
      changes.push({ op: 'replace', path: dotted, before, after })
    }
  }

  return { config: next as unknown as ListingConfig, changes }
}

/** Apply a recommendation's config_patch to the current config. */
export function applyRecommendation(
  config: ListingConfig,
  rec: Recommendation,
): { config: ListingConfig; changes: ConfigChange[] } {
  return applyPatch(config, rec.config_patch)
}

/** Human label for a changed value (used in the before/after delta view). */
export function formatChangeValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('type' in o && 'url' in o) return `${String(o.type)} photo`
    return JSON.stringify(v)
  }
  return String(v)
}
