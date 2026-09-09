import { identify, json, requireDatabase, type Env } from './_lib'

interface VisitPayload {
  outletCode: number
  status: string
  supply: string
  note: string
  visitedAt: string
  lat?: number
  lng?: number
}

const MAX_BATCH = 200

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const database = requireDatabase(env)
  if (database instanceof Response) return database
  const who = identify(request, env)
  if (!who.email) return json({ error: 'Belum login.' }, 401)

  const url = new URL(request.url)
  // Only an admin may look past their own records.
  const all = url.searchParams.get('scope') === 'all' && who.isAdmin
  const statement = all
    ? database.prepare('SELECT * FROM visits ORDER BY visited_at DESC LIMIT 5000')
    : database.prepare('SELECT * FROM visits WHERE by_email = ? ORDER BY visited_at DESC LIMIT 5000').bind(who.email)
  const { results } = await statement.all()
  return json({ scope: all ? 'all' : 'mine', records: results })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const database = requireDatabase(env)
  if (database instanceof Response) return database
  const who = identify(request, env)
  if (!who.email) return json({ error: 'Belum login.' }, 401)

  let payload: { records?: VisitPayload[] }
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Isi permintaan tidak valid.' }, 400)
  }
  const records = (payload.records ?? []).slice(0, MAX_BATCH)
  if (records.length === 0) return json({ saved: 0 })

  const statement = database.prepare(
    `INSERT INTO visits (outlet_code, status, supply, note, visited_at, by_email, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(outlet_code, by_email) DO UPDATE SET
       status = excluded.status,
       supply = excluded.supply,
       note = excluded.note,
       visited_at = excluded.visited_at,
       lat = excluded.lat,
       lng = excluded.lng`,
  )
  const batch = records
    .filter((record) => Number.isFinite(record.outletCode))
    .map((record) =>
      statement.bind(
        Math.trunc(record.outletCode),
        String(record.status ?? '').slice(0, 32),
        String(record.supply ?? '').slice(0, 64),
        String(record.note ?? '').slice(0, 2000),
        String(record.visitedAt ?? new Date().toISOString()).slice(0, 32),
        // Identity comes from Access, never from the body.
        who.email,
        Number.isFinite(record.lat) ? record.lat : null,
        Number.isFinite(record.lng) ? record.lng : null,
      ),
    )
  await database.batch(batch)
  return json({ saved: batch.length })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const database = requireDatabase(env)
  if (database instanceof Response) return database
  const who = identify(request, env)
  if (!who.isAdmin) return json({ error: 'Hanya admin.' }, 403)
  const code = Number(new URL(request.url).searchParams.get('outlet'))
  if (!Number.isFinite(code)) return json({ error: 'Parameter outlet wajib diisi.' }, 400)
  await database.prepare('DELETE FROM visits WHERE outlet_code = ?').bind(Math.trunc(code)).run()
  return json({ deleted: true })
}
