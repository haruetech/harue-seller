'use client'
// app/forgot-password/page.tsx — 비밀번호 재설정 메일 요청
import { useState } from 'react'
import { getSupabase, getSupabaseEnv } from '@/lib/supabase'
import { AUTH_MESSAGES, CONFIG_MESSAGES, checkSupabaseEnv, classifyAuthError, logAuthCode } from '@/lib/auth-errors'
import AuthCard, { Banner, buttonStyle, inputStyle, labelStyle } from '@/components/AuthCard'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { url, key } = getSupabaseEnv()
    const env = checkSupabaseEnv(url, key)
    const sb = getSupabase()
    if (env || !sb) { setError(CONFIG_MESSAGES[env ?? 'env_missing_url']); return }
    setLoading(true)
    try {
      // 메일이 도착하면 /reset-password 로 돌아옵니다. 이 주소는 Supabase Authentication > URL Configuration 의 Redirect URLs 에 등록되어 있어야 합니다.
      const { error: err } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
      if (err) {
        const f = classifyAuthError(err)
        logAuthCode('recover', f.code)
        // 계정 존재 여부를 알려 주지 않기 위해, 발송 한도·연결 문제 외에는 같은 안내를 보여 줍니다.
        if (f.kind === 'rate_limited' || f.kind === 'network' || f.kind === 'server') { setError(AUTH_MESSAGES[f.kind]); return }
      }
      setSent(true)
    } catch (err) {
      const f = classifyAuthError(err as { message?: string; name?: string })
      logAuthCode('recover', f.code)
      setError(AUTH_MESSAGES[f.kind === 'unknown' ? 'network' : f.kind])
    } finally { setLoading(false) }
  }

  return (
    <AuthCard title="비밀번호 재설정" desc="가입한 이메일을 입력하면 재설정 링크를 보내 드립니다.">
      {sent ? <Banner kind="ok">입력하신 이메일로 등록된 계정이 있으면 재설정 메일을 보냈습니다. 메일이 오지 않으면 스팸함을 확인하거나 몇 분 뒤 다시 요청해 주세요.</Banner> : <>
        {error && <Banner kind="error">{error}</Banner>}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="fp-email" style={labelStyle}>이메일</label>
            <input id="fp-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="등록된 이메일 주소" autoComplete="email" autoCapitalize="none" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading} style={buttonStyle(loading)}>{loading ? '보내는 중...' : '재설정 메일 보내기'}</button>
        </form></>}
    </AuthCard>
  )
}
