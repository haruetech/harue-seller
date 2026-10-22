import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createClient } from '@supabase/supabase-js'
import { AUTH_MESSAGES, checkSupabaseEnv, classifyAuthError, classifyProfile, logAuthCode } from '../lib/auth-errors'

// 실제 supabase-js 클라이언트를 로컬 가짜 인증 서버(GoTrue 응답 형식)에 연결해, 클라이언트가 돌려주는 오류 객체가 분류되는지 확인합니다.
// 실제 Supabase 프로젝트는 사용하지 않습니다.
const user = { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'ok@x.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const session = { access_token: 'h.eyJleHAiOjQxMDI0NDQ4MDAsInN1YiI6IjEifQ.s', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }
const err = (res: http.ServerResponse, status: number, error_code: string, msg: string) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ code: status, error_code, msg })) }
let server: http.Server, url = ''
const bodies: string[] = []
test.before(async () => {
  server = http.createServer((req, res) => {
    let raw = ''; req.on('data', c => (raw += c)); req.on('end', () => {
      const b = raw ? JSON.parse(raw) : {}
      bodies.push(req.url || '')
      if (req.url?.startsWith('/auth/v1/token')) {
        const map: Record<string, [number, string, string]> = {
          'wrong@x.com': [400, 'invalid_credentials', 'Invalid login credentials'], 'unconf@x.com': [400, 'email_not_confirmed', 'Email not confirmed'],
          'banned@x.com': [400, 'user_banned', 'User is banned'], 'rate@x.com': [429, 'over_request_rate_limit', 'Request rate limit reached'], 'srv@x.com': [500, 'unexpected_failure', 'internal'],
        }
        const m = map[b.email]; if (m) return err(res, m[0], m[1], m[2])
        res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify(session))
      }
      if (req.url?.startsWith('/auth/v1/recover')) { if (b.email === 'rate@x.com') return err(res, 429, 'over_email_send_rate_limit', 'email rate limit exceeded'); res.writeHead(200, { 'content-type': 'application/json' }); return void res.end('{}') }
      if (req.url?.startsWith('/auth/v1/user') && req.method === 'PUT') {
        if (b.password === 'weak') return err(res, 422, 'weak_password', 'Password should be at least 6 characters.')
        if (b.password === 'same-as-old') return err(res, 422, 'same_password', 'New password should be different from the old password.')
        res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify(user))
      }
      res.writeHead(404); res.end('{}')
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
test.after(() => server.close())
const client = (u = url) => createClient(u, 'anon', { auth: { persistSession: false, autoRefreshToken: false } })

test('로그인 오류가 종류별로 분류된다(실제 supabase-js 오류 객체)', async () => {
  const cases: [string, string][] = [['wrong@x.com', 'invalid_credentials'], ['unconf@x.com', 'email_not_confirmed'], ['banned@x.com', 'user_banned'], ['rate@x.com', 'rate_limited'], ['srv@x.com', 'server']]
  for (const [email, kind] of cases) {
    const { data, error } = await client().auth.signInWithPassword({ email, password: 'pw-not-logged' })
    assert.equal(data.session, null, email)
    assert.equal(classifyAuthError(error).kind, kind, email)
  }
  const ok = await client().auth.signInWithPassword({ email: 'ok@x.com', password: 'pw' })
  assert.ok(ok.data.session && !ok.error)
})
test('연결할 수 없는 서버는 network 로 분류된다', async () => {
  const { error } = await client('http://127.0.0.1:9').auth.signInWithPassword({ email: 'ok@x.com', password: 'pw' })
  assert.equal(classifyAuthError(error).kind, 'network')
})
test('비밀번호 재설정 요청·변경 오류 분류', async () => {
  assert.equal((await client().auth.resetPasswordForEmail('anyone@x.com')).error, null)
  assert.equal(classifyAuthError((await client().auth.resetPasswordForEmail('rate@x.com')).error).kind, 'rate_limited')
  const c = client(); await c.auth.signInWithPassword({ email: 'ok@x.com', password: 'pw' })
  assert.equal(classifyAuthError((await c.auth.updateUser({ password: 'weak' })).error).kind, 'weak_password')
  assert.equal(classifyAuthError((await c.auth.updateUser({ password: 'same-as-old' })).error).kind, 'same_password')
  assert.equal((await c.auth.updateUser({ password: 'new-strong-pass-1' })).error, null)
})
test('코드가 없는 구버전 응답은 메시지로 보완하고, 알 수 없으면 unknown', () => {
  assert.equal(classifyAuthError({ message: 'Invalid login credentials', status: 400 }).kind, 'invalid_credentials')
  assert.equal(classifyAuthError({ message: 'TypeError: Failed to fetch' }).kind, 'network')
  assert.equal(classifyAuthError({ message: 'something odd', status: 418 }).kind, 'unknown')
  assert.equal(classifyAuthError(null).kind, 'unknown')
})
test('화면 문구에는 서버 원문이 섞이지 않는다', () => {
  for (const m of Object.values(AUTH_MESSAGES)) assert.ok(!/(supabase|jwt|token|stack)/i.test(m))
  assert.notEqual(AUTH_MESSAGES.invalid_credentials, AUTH_MESSAGES.network)
})
test('seller_users 조회 결과 분류: 권한 확인 유지', () => {
  const act = { is_active: true, seller: { status: 'active' } }
  assert.equal(classifyProfile({ data: act, error: null }).kind, 'ok')
  assert.equal(classifyProfile({ data: { is_active: true, seller: [{ status: 'active' }] }, error: null }).kind, 'ok')
  assert.equal(classifyProfile({ data: null, error: null }).kind, 'no_profile')
  assert.equal(classifyProfile({ data: { is_active: false, seller: { status: 'active' } }, error: null }).kind, 'inactive')
  assert.equal(classifyProfile({ data: { is_active: true, seller: { status: 'suspended' } }, error: null }).kind, 'seller_inactive')
  assert.equal(classifyProfile({ data: { is_active: true, seller: null }, error: null }).kind, 'seller_inactive')
  assert.equal(classifyProfile({ data: null, error: { code: '42501' } }).kind, 'permission')
  assert.equal(classifyProfile({ data: null, error: { code: '42P01' } }).kind, 'db_setup')
  assert.equal(classifyProfile({ data: null, error: { code: 'XX000' } }).kind, 'profile_error')
})
test('환경변수 점검은 값을 돌려주지 않고 종류만 알려 준다', () => {
  assert.equal(checkSupabaseEnv(undefined, 'k'), 'env_missing_url'); assert.equal(checkSupabaseEnv('https://a.supabase.co', ''), 'env_missing_key')
  assert.equal(checkSupabaseEnv('not a url', 'k'), 'env_bad_url'); assert.equal(checkSupabaseEnv('http://example.com', 'k'), 'env_bad_url')
  assert.equal(checkSupabaseEnv('https://a.supabase.co', 'k'), null); assert.equal(checkSupabaseEnv('http://127.0.0.1:54321', 'k'), null)
})
test('개발 로그에는 코드만 남는다', () => {
  const lines: string[] = []; const orig = console.warn; console.warn = (...a: unknown[]) => { lines.push(a.join(' ')) }
  try { logAuthCode('signIn', 'invalid_credentials') } finally { console.warn = orig }
  assert.deepEqual(lines, ['[seller-auth] signIn: invalid_credentials'])
})
