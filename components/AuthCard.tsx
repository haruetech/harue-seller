'use client'
// 비밀번호 찾기·재설정 화면이 쓰는 공통 카드(로그인 화면과 같은 모양)
import type { ReactNode } from 'react'

export const inputStyle = { width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid #E5E7EB', fontSize: 16, color: '#1F2937', background: '#fff' } as const
export const labelStyle = { fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 7 } as const
export const buttonStyle = (disabled: boolean) => ({ width: '100%', padding: 15, borderRadius: 14, border: 'none', background: disabled ? '#C7D2FE' : 'linear-gradient(135deg,#4F46E5,#7C3AED)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: disabled ? 'default' : 'pointer' }) as const

export function Banner({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) {
  const c = kind === 'error' ? { bg: '#FEF2F2', bd: '#FECACA', fg: '#DC2626' } : { bg: '#ECFDF5', bd: '#A7F3D0', fg: '#047857' }
  return <div role={kind === 'error' ? 'alert' : 'status'} style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{children}</div>
}

export default function AuthCard({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
        * { box-sizing:border-box; font-family:'Pretendard Variable',Pretendard,-apple-system,sans-serif; }
        body { margin:0; background:#F8FAFC; }
        input:focus { outline:none; border-color:#4F46E5 !important; box-shadow:0 0 0 3px rgba(79,70,229,0.12); }
        a:focus-visible, button:focus-visible { outline:3px solid #4F46E5; outline-offset:2px; }
      `}</style>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#EEF2FF 0%,#F8FAFC 50%,#EDE9FE 100%)', padding: '24px 20px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>H</span></div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1E1B4B' }}>{title}</h1>
            {desc && <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{desc}</p>}
          </div>
          <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #E0E7FF', padding: '28px', boxShadow: '0 20px 60px rgba(79,70,229,0.1)' }}>{children}</div>
          <p style={{ textAlign: 'center', marginTop: 18 }}><a href="/login" style={{ color: '#4F46E5', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>로그인으로 돌아가기</a></p>
        </div>
      </div>
    </>
  )
}
