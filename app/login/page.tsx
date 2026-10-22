'use client'
// app/login/page.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase, getSupabaseEnv } from '@/lib/supabase'
import { AUTH_MESSAGES, CONFIG_MESSAGES, PROFILE_MESSAGES, checkSupabaseEnv, classifyAuthError, classifyProfile, logAuthCode } from '@/lib/auth-errors'

export default function SellerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [notice, setNotice] = useState('')
  const envProblem = (() => { const { url, key } = getSupabaseEnv(); return checkSupabaseEnv(url, key) })()

  useEffect(() => {
    if (envProblem) logAuthCode('config', envProblem)
    if (new URLSearchParams(window.location.search).get('reset') === '1') setNotice('비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.')
  }, [envProblem])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setNotice('')
    if (envProblem) { setError(CONFIG_MESSAGES[envProblem]); return }
    const sb = getSupabase()
    if (!sb) { setError(CONFIG_MESSAGES.env_missing_url); return }

    setLoading(true)
    try {
      const { data, error: authError } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (authError || !data.session) {
        const f = classifyAuthError(authError)
        logAuthCode('signIn', f.code)
        setError(AUTH_MESSAGES[f.kind])
        return
      }

      // 로그인 성공 후에도 셀러 계정(seller_users)·셀러사(sellers) 권한을 확인합니다.
      const profile = await sb
        .from('seller_users')
        .select('id, is_active, seller:sellers(status)')
        .eq('auth_id', data.session.user.id)
        .maybeSingle()
      const p = classifyProfile(profile as Parameters<typeof classifyProfile>[0])
      if (p.kind !== 'ok') {
        logAuthCode('profile', p.code)
        await sb.auth.signOut()
        setError(PROFILE_MESSAGES[p.kind])
        return
      }
      router.replace('/')
    } catch (err) {
      const f = classifyAuthError(err as { message?: string; name?: string })
      logAuthCode('signIn', f.code)
      setError(AUTH_MESSAGES[f.kind === 'unknown' ? 'network' : f.kind])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { box-sizing:border-box; font-family:'Pretendard Variable',Pretendard,-apple-system,sans-serif; }
        body { margin:0; background:#F8FAFC; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
        input:focus { outline:none; }
        .inp { width:100%; padding:14px 16px; border-radius:14px; border:1.5px solid #E5E7EB;
          font-size:16px; color:#1F2937; background:#fff; transition:border-color 0.15s,box-shadow 0.15s; }
        .inp:focus { border-color:#4F46E5; box-shadow:0 0 0 3px rgba(79,70,229,0.12); }
      `}</style>

      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        background:'linear-gradient(160deg,#EEF2FF 0%,#F8FAFC 50%,#EDE9FE 100%)',
        padding:'24px 20px' }}>

        <div style={{ width:'100%', maxWidth:420, animation:'fadeUp 0.35s ease both' }}>

          {/* 로고 */}
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{ width:60, height:60, borderRadius:18, margin:'0 auto 16px',
              background:'linear-gradient(135deg,#4F46E5,#7C3AED)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 12px 32px rgba(79,70,229,0.35)' }}>
              <span style={{ fontSize:26, fontWeight:900, color:'#fff' }}>H</span>
            </div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:900, color:'#1E1B4B', letterSpacing:'-0.5px' }}>
              haruepick
            </h1>
            <p style={{ margin:'6px 0 0', fontSize:14, color:'#6B7280' }}>
              셀러 주문 포털
            </p>
          </div>

          {/* 카드 */}
          <div style={{ background:'#fff', borderRadius:24, border:'1px solid #E0E7FF',
            padding:'32px 28px', boxShadow:'0 20px 60px rgba(79,70,229,0.1)' }}>

            {notice && (
              <div role="status" style={{ marginBottom:20, padding:'12px 16px', borderRadius:12,
                background:'#ECFDF5', border:'1px solid #A7F3D0', color:'#047857',
                fontSize:14, fontWeight:600, lineHeight:1.5 }}>{notice}</div>
            )}
            {error && (
              <div role="alert" style={{ marginBottom:20, padding:'12px 16px', borderRadius:12,
                background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626',
                fontSize:14, fontWeight:600, lineHeight:1.5 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:13, fontWeight:700, color:'#374151',
                  display:'block', marginBottom:7 }}>이메일</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="등록된 이메일 주소" className="inp"
                  autoComplete="email" autoCapitalize="none" />
              </div>

              <div style={{ marginBottom:24 }}>
                <label style={{ fontSize:13, fontWeight:700, color:'#374151',
                  display:'block', marginBottom:7 }}>비밀번호</label>
                <div style={{ position:'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    required placeholder="비밀번호" className="inp"
                    autoComplete="current-password"
                    style={{ paddingRight:48 }} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                      border:'none', background:'none', cursor:'pointer', fontSize:18,
                      color:'#9CA3AF', padding:4 }}>
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'15px', borderRadius:14, border:'none',
                  background: loading ? '#C7D2FE' : 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                  color:'#fff', fontSize:16, fontWeight:800, cursor: loading ? 'default' : 'pointer',
                  boxShadow: loading ? 'none' : '0 8px 24px rgba(79,70,229,0.35)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'all 0.15s ease' }}>
                {loading ? (
                  <>
                    <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.4)',
                      borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                    로그인 중...
                  </>
                ) : '로그인'}
              </button>
            </form>

            <div style={{ marginTop:16, textAlign:'center' }}>
              <a href="/forgot-password" style={{ color:'#4F46E5', fontWeight:700, fontSize:14, textDecoration:'none' }}>
                비밀번호를 잊으셨나요?
              </a>
            </div>
            <div style={{ marginTop:20, textAlign:'center', fontSize:13, color:'#9CA3AF' }}>
              계정 문의<br />
              <a href="mailto:help@haruepick.com"
                style={{ color:'#4F46E5', fontWeight:700, textDecoration:'none' }}>
                help@haruepick.com
              </a>
            </div>
          </div>

          <p style={{ textAlign:'center', fontSize:12, color:'#9CA3AF', marginTop:20 }}>
            © 2026 haruepick. All rights reserved.
          </p>
        </div>
      </div>
    </>
  )
}
