export interface Env {
  DB?: D1Database
  ADMIN_EMAILS?: string
}

export interface Identity {
  email: string
  isAdmin: boolean
}

/**
 * Who is calling, according to Cloudflare Access.
 *
 * The header is set by Access after it has verified the login, and a browser
 * cannot forge it — so identity never comes from the request body.
 */
export function identify(request: Request, env: Env): Identity {
  const header =
    request.headers.get('Cf-Access-Authenticated-User-Email') ??
    request.headers.get('cf-access-authenticated-user-email')
  const url = new URL(request.url)
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  const email = (header ?? (local ? 'dev@localhost' : '')).trim().toLowerCase()

  // No admin list means nobody is an admin — never the other way round.
  const admins = (env.ADMIN_EMAILS ?? '')
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return { email, isAdmin: email !== '' && admins.includes(email) }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** 503 tells the app to stop trying: the site simply has no database bound. */
export function requireDatabase(env: Env): D1Database | Response {
  if (!env.DB) return json({ error: 'Database belum diaktifkan untuk situs ini.' }, 503)
  return env.DB
}
