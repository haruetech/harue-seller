'use client'
// app/orders/page.tsx — 주문내역 + 재주문

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, SellerOrder, SellerOrderItem, orderStatusColor, fmt, fmtDateTime } from '@/lib/supabase'
import { useSellerAuth } from '@/lib/auth'

export default function OrdersPage() {
  const router = useRouter()
  const { user } = useSellerAuth()
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState('전체')
  const [reorderLoading, setReorderLoading] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const STATUS_TABS = ['전체', '주문접수', '확인중', '준비중', '출고완료', '취소']

  const loadOrders = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    let q = supabase
      .from('seller_orders')
      .select(`
        *,
        seller_order_items(
          *, catalog:seller_catalog(id,display_name,thumbnail_url,supply_price,brand)
        ),
        seller_addresses(*)
      `)
      .eq('seller_id', user.seller_id)
      .order('ordered_at', { ascending: false })

    if (statusFilter !== '전체') q = q.eq('status', statusFilter)

    const { data } = await q
    setOrders((data ?? []) as SellerOrder[])
    setLoading(false)
  }, [user, statusFilter])

  useEffect(() => { void loadOrders() }, [loadOrders])

  // 재주문: 동일 상품/옵션으로 장바구니에 담기
  async function handleReorder(order: SellerOrder) {
    if (!supabase || !user) return
    setReorderLoading(order.id)
    try {
      const insertItems = order.seller_order_items.map(item => ({
        seller_id: user.seller_id,
        catalog_id: item.catalog_id,
        option_name: item.option_name,
        option_value: item.option_value,
        sku_id: item.sku_id ?? null,
        qty: item.qty,
      }))

      // upsert로 수량 누적
      for (const cartItem of insertItems) {
        await supabase.from('seller_cart').upsert(cartItem, {
          onConflict: 'seller_id,catalog_id,option_value',
        })
      }

      setMsg(`✓ ${order.seller_order_items.length}개 상품이 장바구니에 담겼습니다`)
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setMsg('재주문 처리 중 오류가 발생했습니다')
    }
    setReorderLoading(null)
  }

  const OrderCard = ({ order }: { order: SellerOrder }) => {
    const sc = orderStatusColor(order.status)
    const isExpanded = selectedOrder?.id === order.id
    const firstItem = order.seller_order_items[0]

    return (
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E5E7EB',
        overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        marginBottom: 12, animation: 'fadeUp 0.2s ease both' }}>

        {/* 주문 헤더 */}
        <div onClick={() => setSelectedOrder(isExpanded ? null : order)}
          style={{ padding: '14px 16px', cursor: 'pointer',
            display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* 썸네일 */}
          <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden',
            background: '#F3F4F6', flexShrink: 0 }}>
            {(firstItem?.catalog as any)?.thumbnail_url ? (
              <img src={(firstItem.catalog as any).thumbnail_url} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👟</div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF',
              marginBottom: 2 }}>{order.order_no}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(firstItem?.catalog as any)?.display_name ?? '상품 정보 없음'}
              {order.seller_order_items.length > 1 &&
                ` 외 ${order.seller_order_items.length - 1}건`}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {fmtDateTime(order.ordered_at)} · {order.total_qty}개
            </div>
          </div>

          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px',
                borderRadius: 999, background: sc.bg, color: sc.text,
                border: `1px solid ${sc.border}` }}>
                {order.status}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>
              {fmt(order.total_amount)}원
            </div>
          </div>
        </div>

        {/* 확장 상세 */}
        {isExpanded && (
          <div style={{ borderTop: '1px solid #F3F4F6', animation: 'fadeUp 0.15s ease' }}>

            {/* 품목 목록 */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF',
                marginBottom: 10 }}>주문 품목</div>
              {order.seller_order_items.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden',
                    background: '#F3F4F6', flexShrink: 0 }}>
                    {(item.catalog as any)?.thumbnail_url ? (
                      <img src={(item.catalog as any).thumbnail_url} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <div style={{ width: '100%', height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center' }}>👟</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(item.catalog as any)?.display_name}
                    </div>
                    {item.option_value && (
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.option_value}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{item.qty}개</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                      {fmt(item.subtotal)}원
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 배송지 */}
            {order.seller_addresses && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 6 }}>
                  배송지
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  <span style={{ fontWeight: 700 }}>{order.seller_addresses.recipient}</span>
                  {' · '}{order.seller_addresses.phone}<br />
                  {order.seller_addresses.address1} {order.seller_addresses.address2}
                </div>
              </div>
            )}

            {/* 메모 */}
            {order.note && (
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>
                  주문 메모
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>{order.note}</div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
              <button type="button"
                onClick={() => handleReorder(order)}
                disabled={reorderLoading === order.id}
                style={{ flex: 1, padding: '12px', borderRadius: 12,
                  border: '2px solid #4F46E5', background: '#fff',
                  color: '#4F46E5', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                {reorderLoading === order.id ? '처리중...' : '🔄 재주문'}
              </button>
              {order.status === '주문접수' && (
                <button type="button"
                  style={{ padding: '12px 18px', borderRadius: 12,
                    border: '1px solid #FECACA', background: '#FEF2F2',
                    color: '#DC2626', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  취소 요청
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* 상태 필터 탭 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6',
        padding: '12px 16px', overflowX: 'auto', display: 'flex', gap: 8 }}>
        {STATUS_TABS.map(s => (
          <button key={s} type="button"
            onClick={() => setStatusFilter(s)}
            style={{ padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              flexShrink: 0, cursor: 'pointer',
              border: `1.5px solid ${statusFilter === s ? '#4F46E5' : '#E5E7EB'}`,
              background: statusFilter === s ? '#EEF2FF' : '#fff',
              color: statusFilter === s ? '#4F46E5' : '#6B7280' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 300 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #E0E7FF',
              borderTopColor: '#4F46E5', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>주문 내역이 없습니다</div>
            <div style={{ fontSize: 14, marginBottom: 20 }}>상품을 둘러보고 첫 주문을 해보세요</div>
            <button type="button" onClick={() => router.push('/products')}
              style={{ padding: '12px 24px', borderRadius: 12,
                background: '#4F46E5', color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              상품 보러가기
            </button>
          </div>
        ) : (
          orders.map(order => <OrderCard key={order.id} order={order} />)
        )}
      </div>

      {/* 토스트 메시지 */}
      {msg && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#064E3B', color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontSize: 14, fontWeight: 700, zIndex: 1000, whiteSpace: 'nowrap',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'slideUp 0.2s ease' }}>
          {msg}
        </div>
      )}
    </div>
  )
}
