'use client'
// app/layout.tsx (seller portal root layout)

import { usePathname } from 'next/navigation'
import { useSellerAuth } from '@/lib/auth'

// ── 하단 탭 네비게이션 아이템 ──
const BOTTOM_TABS = [
  { key: 'home',     label: '홈',     icon: '⊞',  route: '/' },
  { key: 'products', label: '상품',   icon: '🛍',  route: '/products' },
  { key: 'favorites',label: '찜',     icon: '❤️',  route: '/favorites' },
  { key: 'cart',     label: '장바구니',icon: '🛒', route: '/cart' },
  { key: 'orders',   label: '주문',   icon: '📦',  route: '/orders' },
]

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: '#fff', borderTop: '1px solid #F1F5F9',
      display: 'flex', height: 64,
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      {BOTTOM_TABS.map(tab => {
        const active = tab.route === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.route)
        return (
          <a key={tab.key} href={tab.route}
            style={{ flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              textDecoration: 'none', color: active ? '#4F46E5' : '#9CA3AF',
              fontSize: 10, fontWeight: active ? 800 : 500,
              transition: 'color 0.15s', paddingTop: 6 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
            {active && (
              <div style={{ width: 4, height: 4, borderRadius: '50%',
                background: '#4F46E5', marginTop: 1 }} />
            )}
          </a>
        )
      })}
    </nav>
  )
}

function TopBar({ title, pathname, userName }: {
  title: string
  pathname: string
  userName?: string
}) {
  const isHome = pathname === '/'
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#fff', borderBottom: '1px solid #F1F5F9',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{ height: 54, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px', maxWidth: 768,
        margin: '0 auto', width: '100%' }}>
        {isHome ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>H</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>haruepick</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="javascript:history.back()"
              style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, textDecoration: 'none', color: '#374151' }}>
              ←
            </a>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/products?search=1"
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, textDecoration: 'none' }}>
            🔍
          </a>
          <a href="/profile"
            style={{ width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff', textDecoration: 'none' }}>
            {userName?.slice(0, 1) ?? 'S'}
          </a>
        </div>
      </div>
    </header>
  )
}

// 공개 경로 (인증 불필요)
const PUBLIC_PATHS = ['/login']

export default function SellerRootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (isPublic) {
    return (
      <html lang="ko">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <meta name="theme-color" content="#4F46E5" />
          <link rel="manifest" href="/manifest.json" />
        </head>
        <body style={{ margin: 0 }}>{children}</body>
      </html>
    )
  }

  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <style>{`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
          *, *::before, *::after {
            box-sizing:border-box;
            font-family:'Pretendard Variable',Pretendard,-apple-system,'Noto Sans KR',sans-serif;
            -webkit-tap-highlight-color: transparent;
          }
          html, body { margin:0; padding:0; background:#F8FAFC; }
          @keyframes spin { to { transform:rotate(360deg); } }
          @keyframes fadeUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
          @keyframes slideIn { from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)} }
          ::-webkit-scrollbar { display:none; }
          * { scrollbar-width:none; }
          a { text-decoration:none; color:inherit; }
        `}</style>
      </head>
      <body>
        <AuthGuard pathname={pathname}>{children}</AuthGuard>
      </body>
    </html>
  )
}

function AuthGuard({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const { user, loading } = useSellerAuth()

  const PAGE_TITLES: Record<string, string> = {
    '/products': '상품 목록',
    '/new': '신상품',
    '/best': '베스트',
    '/restock': '재입고',
    '/favorites': '찜 상품',
    '/cart': '장바구니',
    '/orders': '주문 내역',
    '/documents': '문서함',
    '/notices': '공지사항',
    '/profile': '내 정보',
    '/addresses': '배송지 관리',
    '/account': '계정 관리',
  }

  const title = PAGE_TITLES[pathname] ||
    (pathname.startsWith('/products/') ? '상품 상세' : '') ||
    (pathname.startsWith('/orders/') ? '주문 상세' : '') ||
    '하루에픽'

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
        minHeight:'100vh', background:'#F8FAFC' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:32, height:32, border:'3px solid #E0E7FF',
            borderTopColor:'#4F46E5', borderRadius:'50%',
            animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
          <div style={{ fontSize:13, color:'#6B7280' }}>로딩 중...</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 768, margin: '0 auto', minHeight: '100vh',
      paddingBottom: 80, position: 'relative' }}>
      <TopBar title={title} pathname={pathname} userName={user.name} />
      <main style={{ minHeight: 'calc(100vh - 134px)' }}>
        {children}
      </main>
      <BottomNav pathname={pathname} />
    </div>
  )
}
