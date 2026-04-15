'use client'
// app/page.tsx — 셀러 대시보드

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, CatalogItem, SellerOrder, SellerNotice,
         stockColor, stockLabel, orderStatusColor, fmt, fmtDate } from '@/lib/supabase'
import { useSellerAuth } from '@/lib/auth'

type DashData = {
  pendingOrders: number
  newProducts: CatalogItem[]
  restockProducts: CatalogItem[]
  recentOrders: SellerOrder[]
  notices: SellerNotice[]
  favoriteCount: number
  frequentProducts: CatalogItem[]
}

function ProductMiniCard({ item, onOrder }: {
  item: CatalogItem
  onOrder: (item: CatalogItem) => void
}) {
  const sc = stockColor(item.stock_status)
  return (
    <div style={{ flexShrink: 0, width: 150, background: '#fff', borderRadius: 16,
      border: '1px solid #E5E7EB', overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ aspectRatio: '1/1', background: '#F3F4F6', position: 'relative', overflow: 'hidden' }}>
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.display_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👟</div>
        )}
        {item.is_new && (
          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 800,
            padding: '2px 6px', borderRadius: 999, background: '#4F46E5', color: '#fff' }}>
            NEW
          </div>
        )}
        {item.is_best && (
          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 800,
            padding: '2px 6px', borderRadius: 999, background: '#EF4444', color: '#fff' }}>
            BEST
          </div>
        )}
      </div>
      <div style={{ padding: '10px 10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 2 }}>
          {item.brand}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as any }}>
          {item.display_name}
        </div>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#4F46E5', marginTop: 5 }}>
          {fmt(item.supply_price)}원
        </div>
        <div style={{ marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999,
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
            {stockLabel(item.stock_status)}
          </span>
        </div>
        <button type="button" onClick={() => onOrder(item)}
          disabled={item.stock_status === 'out_of_stock'}
          style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 10,
            border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: item.stock_status === 'out_of_stock' ? '#F3F4F6' : '#4F46E5',
            color: item.stock_status === 'out_of_stock' ? '#9CA3AF' : '#fff' }}>
          {item.stock_status === 'out_of_stock' ? '품절' : '주문하기'}
        </button>
      </div>
    </div>
  )
}

export default function SellerDashboard() {
  const router = useRouter()
  const { user } = useSellerAuth()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDash = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)

    const sellerId = user.seller_id

    const [
      { data: orders },
      { data: newProds },
      { data: restock },
      { data: notices },
      { count: favCount },
      { data: recentOrders },
    ] = await Promise.all([
      supabase.from('seller_orders')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .in('status', ['주문접수', '확인중', '준비중']),
      supabase.from('seller_catalog')
        .select('*')
        .eq('is_new', true)
        .eq('is_visible', true)
        .neq('stock_status', 'out_of_stock')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('seller_catalog')
        .select('*')
        .eq('is_restock', true)
        .eq('is_visible', true)
        .limit(6),
      supabase.from('seller_notices')
        .select('id, title, is_pinned, created_at')
        .eq('is_visible', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('seller_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId),
      supabase.from('seller_orders')
        .select('id, order_no, status, total_qty, total_amount, ordered_at, seller_order_items(id,catalog:seller_catalog(display_name,thumbnail_url))')
        .eq('seller_id', sellerId)
        .order('ordered_at', { ascending: false })
        .limit(3),
    ])

    setData({
      pendingOrders: (orders as any)?.count ?? 0,
      newProducts: (newProds ?? []) as CatalogItem[],
      restockProducts: (restock ?? []) as CatalogItem[],
      recentOrders: (recentOrders ?? []) as any[],
      notices: (notices ?? []) as SellerNotice[],
      favoriteCount: favCount ?? 0,
      frequentProducts: [],
    })
    setLoading(false)
  }, [user])

  useEffect(() => { void loadDash() }, [loadDash])

  function goOrder(item: CatalogItem) {
    router.push(`/products/${item.id}`)
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 400 }}>
        <div style={{ width: 28, height: 28, border: '3px solid #E0E7FF',
          borderTopColor: '#4F46E5', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '안녕하세요' : '안녕하세요'

  return (
    <div style={{ paddingBottom: 8 }}>

      {/* 환영 배너 */}
      <div style={{ background: 'linear-gradient(135deg,#4338CA 0%,#7C3AED 100%)',
        padding: '20px 20px 24px', color: '#fff' }}>
        <div style={{ fontSize: 13, color: '#C7D2FE', marginBottom: 4 }}>{greeting} 👋</div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>
          {user?.seller.name}
        </div>
        <div style={{ fontSize: 13, color: '#A5B4FC', marginTop: 4 }}>
          {user?.name} · {user?.seller.tier.toUpperCase()}
        </div>

        {/* 빠른 실행 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          gap: 8, marginTop: 20 }}>
          {[
            { label: '상품보기', icon: '🛍', route: '/products' },
            { label: '신상품', icon: '✨', route: '/new' },
            { label: '찜상품', icon: '❤️', route: '/favorites' },
            { label: '주문내역', icon: '📦', route: '/orders' },
          ].map(item => (
            <button key={item.label} type="button"
              onClick={() => router.push(item.route)}
              style={{ padding: '12px 6px', borderRadius: 14,
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 5, cursor: 'pointer',
                backdropFilter: 'blur(4px)' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI 바 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 1, background: '#E5E7EB', margin: 0 }}>
        {[
          { label: '처리중 주문', val: `${data.pendingOrders}건`, route: '/orders', color: '#4F46E5' },
          { label: '찜 상품', val: `${data.favoriteCount}개`, route: '/favorites', color: '#EC4899' },
          { label: '신상품', val: `${data.newProducts.length}개`, route: '/new', color: '#059669' },
        ].map(item => (
          <button key={item.label} type="button" onClick={() => router.push(item.route)}
            style={{ background: '#fff', padding: '14px 12px', border: 'none', cursor: 'pointer',
              textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{item.label}</div>
          </button>
        ))}
      </div>

      {/* 신상품 슬라이드 */}
      {data.newProducts.length > 0 && (
        <section style={{ padding: '20px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '0 16px', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>
              ✨ 신상품
            </h2>
            <a href="/new" style={{ fontSize: 13, color: '#4F46E5', fontWeight: 700 }}>
              전체보기 →
            </a>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto',
            padding: '0 16px', paddingBottom: 4 }}>
            {data.newProducts.map(item => (
              <ProductMiniCard key={item.id} item={item} onOrder={goOrder} />
            ))}
          </div>
        </section>
      )}

      {/* 최근 주문 */}
      {data.recentOrders.length > 0 && (
        <section style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>
              📦 최근 주문
            </h2>
            <a href="/orders" style={{ fontSize: 13, color: '#4F46E5', fontWeight: 700 }}>
              전체보기 →
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentOrders.map(order => {
              const sc = orderStatusColor(order.status)
              return (
                <div key={order.id}
                  onClick={() => router.push(`/orders/${order.id}`)}
                  style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
                    padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280',
                      marginBottom: 4 }}>
                      {order.order_no}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(order.seller_order_items as any[])[0]?.catalog?.display_name ?? '-'}
                      {(order.seller_order_items as any[]).length > 1 &&
                        ` 외 ${(order.seller_order_items as any[]).length - 1}건`}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
                      {fmtDate(order.ordered_at)} · {order.total_qty}개 · {fmt(order.total_amount)}원
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px',
                      borderRadius: 999, background: sc.bg, color: sc.text,
                      border: `1px solid ${sc.border}` }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 재입고 */}
      {data.restockProducts.length > 0 && (
        <section style={{ padding: '20px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', padding: '0 16px', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>
              🔄 재입고
            </h2>
            <a href="/restock" style={{ fontSize: 13, color: '#4F46E5', fontWeight: 700 }}>
              전체보기 →
            </a>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto',
            padding: '0 16px', paddingBottom: 4 }}>
            {data.restockProducts.map(item => (
              <ProductMiniCard key={item.id} item={item} onOrder={goOrder} />
            ))}
          </div>
        </section>
      )}

      {/* 공지사항 */}
      {data.notices.length > 0 && (
        <section style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>
              📢 공지사항
            </h2>
            <a href="/notices" style={{ fontSize: 13, color: '#4F46E5', fontWeight: 700 }}>
              전체보기 →
            </a>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
            overflow: 'hidden' }}>
            {data.notices.map((n, idx) => (
              <a key={n.id} href={`/notices/${n.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '13px 16px', color: '#111827',
                  borderBottom: idx < data.notices.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                {n.is_pinned && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px',
                    borderRadius: 999, background: '#FEF2F2', color: '#EF4444',
                    border: '1px solid #FECACA', flexShrink: 0 }}>공지</span>
                )}
                <span style={{ flex: 1, fontSize: 14, fontWeight: n.is_pinned ? 700 : 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title}
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>
                  {fmtDate(n.created_at)}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}
