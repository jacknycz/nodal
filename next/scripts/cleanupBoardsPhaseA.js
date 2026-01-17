/* eslint-disable no-console */
/**
 * Phase A maintenance: shrink boards.data by removing:
 * - meta.chat
 * - nodes[*].data.extractedText / extracted_text
 * - overly-large nodes[*].data.content (cap)
 *
 * Usage:
 *   node scripts/cleanupBoardsPhaseA.js --dry-run
 *   node scripts/cleanupBoardsPhaseA.js --limit 200
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
const { createClient } = require('@supabase/supabase-js')

function parseArgs(argv) {
  const args = new Set(argv.slice(2))
  const getVal = (name, def) => {
    const idx = argv.indexOf(name)
    if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1]
    return def
  }
  return {
    dryRun: args.has('--dry-run'),
    limit: Number(getVal('--limit', '0') || 0) || 0,
    pageSize: Math.min(200, Math.max(20, Number(getVal('--page-size', '100') || 100) || 100)),
  }
}

function stripBoardData(data) {
  const boardData = data && typeof data === 'object' ? { ...data } : {}
  let changed = false

  // meta.chat
  if (boardData.meta && typeof boardData.meta === 'object' && boardData.meta.chat) {
    boardData.meta = { ...boardData.meta }
    delete boardData.meta.chat
    changed = true
  }

  const nodes = Array.isArray(boardData.nodes) ? boardData.nodes : []
  if (nodes.length) {
    const MAX_CONTENT = 12000
    const nextNodes = nodes.map((n) => {
      if (!n || typeof n !== 'object') return n
      const next = { ...n }
      const d = next.data && typeof next.data === 'object' ? { ...next.data } : next.data
      if (d && typeof d === 'object') {
        if (Object.prototype.hasOwnProperty.call(d, 'extractedText')) {
          delete d.extractedText
          changed = true
        }
        if (Object.prototype.hasOwnProperty.call(d, 'extracted_text')) {
          delete d.extracted_text
          changed = true
        }
        if (typeof d.content === 'string' && d.content.length > MAX_CONTENT) {
          d.content = d.content.slice(0, MAX_CONTENT)
          changed = true
        }
        next.data = d
      }
      return next
    })
    boardData.nodes = nextNodes
  }

  return { boardData, changed }
}

async function main() {
  const { dryRun, limit, pageSize } = parseArgs(process.argv)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  let processed = 0
  let updated = 0
  let from = 0

  console.log('[cleanup] start', { dryRun, limit: limit || 'all', pageSize })

  while (true) {
    const to = from + pageSize - 1
    const { data: rows, error } = await supabase
      .from('boards')
      .select('id, data')
      .range(from, to)

    if (error) throw error
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      if (limit && processed >= limit) break
      processed += 1

      const before = row.data || {}
      const beforeSize = JSON.stringify(before).length
      const { boardData, changed } = stripBoardData(before)
      if (!changed) continue

      const afterSize = JSON.stringify(boardData).length
      const delta = beforeSize - afterSize
      console.log(`[cleanup] board ${row.id}: ${beforeSize} -> ${afterSize} bytes (${delta >= 0 ? '-' : '+'}${Math.abs(delta)})`)

      if (!dryRun) {
        const nodeCount = Array.isArray(boardData.nodes) ? boardData.nodes.length : null
        const edgeCount = Array.isArray(boardData.edges) ? boardData.edges.length : null
        const { error: upErr } = await supabase
          .from('boards')
          .update({
            data: boardData,
            last_modified: Date.now(),
            ...(nodeCount != null ? { node_count: nodeCount } : {}),
            ...(edgeCount != null ? { edge_count: edgeCount } : {}),
          })
          .eq('id', row.id)
        if (upErr) throw upErr
        updated += 1
      }
    }

    if (limit && processed >= limit) break
    from += pageSize
  }

  console.log('[cleanup] done', { processed, updated: dryRun ? 0 : updated, dryRun })
}

main().catch((e) => {
  console.error('[cleanup] failed', e)
  process.exit(1)
})

