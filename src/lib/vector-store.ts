// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: Vector Store — Component Deduplication
//
// Uses Supabase pgvector to store embeddings of every file ever written.
// Before the coding agent runs, we search for semantically similar components
// so the agent reuses existing work instead of rebuilding it.
//
// IMPORTANT: This uses the PROJECT'S Supabase instance (the generated app DB),
// NOT Prisma (which is the platform DB). Each project has its own Supabase.
//
// SETUP (one-time per Supabase project — add to PRODUCTION_CHECKLIST):
//   Run this SQL in your Supabase SQL editor:
//   CREATE EXTENSION IF NOT EXISTS vector;
//   CREATE TABLE IF NOT EXISTS luno_component_store (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     project_id text NOT NULL,
//     file_path text NOT NULL,
//     content text NOT NULL,
//     embedding vector(768),
//     created_at timestamptz DEFAULT now(),
//     updated_at timestamptz DEFAULT now(),
//     UNIQUE(project_id, file_path)
//   );
//   CREATE INDEX ON luno_component_store USING ivfflat (embedding vector_cosine_ops);
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

// Google text-embedding-004 via AI SDK — same provider already used for Gemini
async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: text.slice(0, 8000) }] },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.embedding.values as number[]
}

function getSupabaseClient(supabaseUrl: string, supabaseServiceKey: string) {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ── Upsert files into vector store after generation ──────────────────────────
export async function upsertFilesToVectorStore({
  projectId,
  files,
  supabaseUrl,
  supabaseServiceKey,
}: {
  projectId: string
  files: { [path: string]: string }
  supabaseUrl: string
  supabaseServiceKey: string
}): Promise<void> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseServiceKey)

  for (const [filePath, content] of Object.entries(files)) {
    // Skip non-code files
    if (!filePath.match(/\.(tsx?|jsx?|css|sql)$/)) continue
    if (content.length < 50) continue // skip tiny files

    try {
      const embedding = await getEmbedding(`File: ${filePath}\n\n${content}`)

      await supabase.from('luno_component_store').upsert(
        {
          project_id: projectId,
          file_path: filePath,
          content: content.slice(0, 10000),
          embedding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,file_path' }
      )
    } catch (e) {
      // Non-fatal — log and continue
      console.error(`Vector upsert failed for ${filePath}:`, e)
    }
  }
}

// ── Search for similar components before coding ───────────────────────────────
export async function searchSimilarComponents({
  projectId,
  query,
  supabaseUrl,
  supabaseServiceKey,
  limit = 5,
  threshold = 0.75,
}: {
  projectId: string
  query: string
  supabaseUrl: string
  supabaseServiceKey: string
  limit?: number
  threshold?: number
}): Promise<{ path: string; content: string; similarity: number }[]> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseServiceKey)

  try {
    const embedding = await getEmbedding(query)

    const { data, error } = await supabase.rpc('match_components', {
      query_embedding: embedding,
      match_project_id: projectId,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      console.error('Vector search error:', error)
      return []
    }

    return (data ?? []).map((row: any) => ({
      path: row.file_path,
      content: row.content,
      similarity: row.similarity,
    }))
  } catch (e) {
    console.error('Vector search failed:', e)
    return []
  }
}

// ── Format search results for agent context ───────────────────────────────────
export function formatComponentMatches(
  matches: { path: string; content: string; similarity: number }[]
): string {
  if (matches.length === 0) return ''

  const lines = matches.map(
    (m) =>
      `<existing_component path="${m.path}" similarity="${Math.round(m.similarity * 100)}%">\n${m.content.slice(0, 1500)}\n</existing_component>`
  )

  return `
═══════════════════════════════════════════════════════
EXISTING COMPONENTS — reuse these, do NOT rebuild them
═══════════════════════════════════════════════════════
${lines.join('\n\n')}
`
}
