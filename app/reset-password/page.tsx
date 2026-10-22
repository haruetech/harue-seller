'use client'
// app/reset-password/page.tsx — 메일의 링크로 들어와 새 비밀번호 설정
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase, getSupabaseEnv } from '@/lib/supabase'
import { AUTH_MESSAGES, CONFIG_MESSAGES, checkSupabaseEnv, classifyAuthError, logAuthCode } from '@/lib/auth-errors'
import AuthCard, { Banner, buttonStyle, inputStyle, labelStyle } from '@/components/AuthCard'

const MIN_LEN = 8
type Phase = 'checking' | 'ready' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('checking')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { url, key } = getSupabaseEnv()
    const env = checkSupabaseEnv(url, key)
    const sb = getSupabase()
    if (env || !sb) { setError(CONFIG_MESSAGES[env ?? 'env_missing_url']); setPhase('invalid'); return }
    // 링크가 만료·재사용된 경우 Supabase 가 주소 뒤(#error_code=...)에 이유를 붙여 보냅니다.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (hash.get('error') || hash.get('error_code')) { logAuthCode('recoveryLink', hash.get('error_code') || 'link_error'); setPhase('invalid'); return }
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setPhase('ready')
    })
    // 링크의 토큰을 세션으로 바꾸는 데 잠깐 걸립니다. 그래도 세션이 없으면 잘못된 접근입니다.
    const t = window.setTimeout(async () => {
      const { data } = await sb.auth.getSession()
      setPhase(p => (p === 'checking' ? (data.session ? 'ready' : 'invalid') : p))
    }, 2500)
    return () => { sub.subscription.unsubscribe(); window.clearTimeout(t) }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < MIN_LEN) { setError(`비밀번호는 ${MIN_LEN}자 이상으로 입력해 주세요.`); return }
    if (pw !== pw2) { setError('두 비밀번호가 서로 다릅니다.'); return }
    const sb = getSupabase()
    if (!sb) { setError(CONFIG_MESSAGES.env_missing_url); return }
    setLoading(true)
    try {
      const { error: err } = await sb.auth.updateUser({ password: pw })
      if (err) { const f = classifyAuthError(err); logAuthCode('updateUser', f.code); setError(AUTH_MESSAGES[f.kind === 'unknown' ? 'server' : f.kind]); return }
      await sb.auth.signOut() // 재설정용 임시 세션은 닫고, 새 비밀번호로 다시 로그인하게 합니다.
      router.replace('/login?reset=1')
    } catch (err) {
      const f = classifyAuthError(err as { message?: string; name?: string }); logAuthCode('updateUser', f.code); setError(AUTH_MESSAGES[f.kind === 'unknown' ? 'network' : f.kind])
    } finally { setLoading(false) }
  }

  return (
    <AuthCard title="새 비밀번호 설정" desc={phase === 'ready' ? `${MIN_LEN}자 이상으로 새 비밀번호를 입력해 주세요.` : undefined}>
      {phase === 'checking' && <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>링크를 확인하는 중입니다...</p>}
      {phase === 'invalid' && <>
        <Banner kind="error">{error || AUTH_MESSAGES.link_expired}</Banner>
        <a href="/forgot-password" style={{ display: 'block', textAlign: 'center', color: '#4F46E5', fontWeight: 800, textDecoration: 'none' }}>재설정 메일 다시 받기</a></>}
      {phase === 'ready' && <form onSubmit={submit}>
        {error && <Banner kind="error">{error}</Banner>}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="rp-pw" style={labelStyle}>새 비밀번호</label>
          <input id="rp-pw" type={show ? 'text' : 'password'} required minLength={MIN_LEN} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="rp-pw2" style={labelStyle}>새 비밀번호 확인</label>
          <input id="rp-pw2" type={show ? 'text' : 'password'} required minLength={MIN_LEN} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" style={inputStyle} />
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#4B5563', marginBottom: 20 }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />비밀번호 보기</label>
        <button type="submit" disabled={loading} style={buttonStyle(loading)}>{loading ? '저장 중...' : '비밀번호 변경'}</button>
      </form>}
    </AuthCard>
  )
}
