'use client'
// app/products/[id]/page.tsx — 상품 상세 + 주문하기

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, CatalogItem, CatalogOption, CatalogOptionValue,
         stockColor, stockLabel, fmt } from '@/lib/supabase'
import { useSellerAuth } from '@/lib/auth'

type SelectedOptions = Record<string, string> // optionName → optionValue

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useSellerAuth()
  const catalogId = params.id as string

  const [item, setItem] = useState<CatalogItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFav, setIsFav] = useState(false)
  const [selected, setSelected] = useState<SelectedOptions>({})
  const [qty, setQty] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [cartLoading, setCartLoading] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showImageModal, setShowImageModal] = useState(false)

  const loadItem = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [{ data: catalog }, { data: fav }] = await Promise.all([
      supabase.from('seller_catalog').select('*').eq('id', catalogId).single(),
      supabase.from('seller_favorites')
        .select('id').eq('seller_id', user.seller_id).eq('catalog_id', catalogId).maybeSingle(),
    ])
    if (catalog) {
      setItem(catalog as CatalogItem)
      // 최근 본 상품 기록
      await supabase.from('seller_viewed')
        .upsert({ seller_id: user.seller_id, catalog_id: catalogId, viewed_at: new Date().toISOString() },
          { onConflict: 'seller_id,catalog_id' })
    }
    setIsFav(!!fav)
    setLoading(false)
  }, [catalogId, user])

  useEffect(() => { void loadItem() }, [loadItem])

  async function toggleFav() {
    if (!supabase || !user || !item) return
    if (isFav) {
      await supabase.from('seller_favorites').delete()
        .eq('seller_id', user.seller_id).eq('catalog_id', catalogId)
    } else {
      await supabase.from('seller_favorites')
        .insert({ seller_id: user.seller_id, catalog_id: catalogId })
    }
    setIsFav(!isFav)
  }

  async function addToCart() {
    if (!supabase || !user || !item) return
    if (!validateOptions()) return

    setCartLoading(true)
    const firstOption = item.options[0]
    const selectedVal = firstOption ? selected[firstOption.name] : null

    const { error } = await supabase.from('seller_cart')
      .upsert({
        seller_id: user.seller_id,
        catalog_id: catalogId,
        option_name: firstOption?.name ?? null,
        option_value: selectedVal ?? null,
        qty,
      }, { onConflict: 'seller_id,catalog_id,option_value' })

    if (error) {
      setMsg('장바구니 추가 실패: ' + error.message)
    } else {
      setMsg(`✓ 장바구니에 ${qty}개 추가되었습니다`)
      setTimeout(() => setMsg(''), 3000)
    }
    setCartLoading(false)
  }

  async function buyNow() {
    if (!supabase || !user || !item) return
    if (!validateOptions()) return

    setOrderLoading(true)
    try {
      // 장바구니에 추가 후 주문 페이지로
      await addToCart()
      router.push('/cart')
    } catch (e) {
      setMsg('오류가 발생했습니다.')
    }
    setOrderLoading(false)
  }

  function validateOptions(): boolean {
    if (!item) return false
    for (const opt of item.options) {
      if (!selected[opt.name]) {
        setMsg(`${opt.name}을(를) 선택해주세요`)
        return false
      }
    }
    return true
  }

  const getOptionStock = (optName: string, optVal: string): CatalogOptionValue | undefined => {
    return item?.options.find(o => o.name === optName)?.values.find(v => v.value === optVal)
  }

  const totalPrice = item
    ? item.supply_price * qty + Object.entries(selected).reduce((s, [name, val]) => {
        const ov = getOptionStock(name, val)
        return s + (ov?.price_diff ?? 0)
      }, 0)
    : 0

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ width: 28, height: 28, border: '3px solid #E0E7FF',
          borderTopColor: '#4F46E5', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!item) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>상품을 찾을 수 없습니다</div>
      </div>
    )
  }

  const images = item.images.length > 0 ? item.images :
    (item.thumbnail_url ? [{ url: item.thumbnail_url, order: 0, type: 'main' }] : [])
  const sc = stockColor(item.stock_status)
  const canOrder = item.stock_status !== 'out_of_stock' && item.stock_status !== 'discontinued'

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ paddingBottom: 100 }}>

        {/* 이미지 슬라이더 */}
        <div style={{ position: 'relative', aspectRatio: '1/1',
          background: '#F3F4F6', overflow: 'hidden' }}>
          {images.length > 0 ? (
            <img src={images[activeImage]?.url} alt={item.display_name}
              onClick={() => setShowImageModal(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>👟</div>
          )}

          {/* 찜 버튼 */}
          <button type="button" onClick={toggleFav}
            style={{ position: 'absolute', top: 12, right: 12, width: 44, height: 44,
              borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
              border: 'none', cursor: 'pointer', fontSize: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
            {isFav ? '❤️' : '🤍'}
          </button>

          {/* 배지 */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {item.is_new && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                background: '#4F46E5', color: '#fff' }}>NEW</span>
            )}
            {item.is_best && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                background: '#EF4444', color: '#fff' }}>BEST</span>
            )}
          </div>

          {/* 이미지 인디케이터 */}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 5 }}>
              {images.map((_, i) => (
                <div key={i} onClick={() => setActiveImage(i)}
                  style={{ width: i === activeImage ? 16 : 6, height: 6,
                    borderRadius: 999, background: i === activeImage ? '#fff' : 'rgba(255,255,255,0.5)',
                    cursor: 'pointer', transition: 'all 0.2s' }} />
              ))}
            </div>
          )}
        </div>

        {/* 썸네일 */}
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px',
            overflowX: 'auto', background: '#fff', borderBottom: '1px solid #F3F4F6' }}>
            {images.map((img, i) => (
              <div key={i} onClick={() => setActiveImage(i)}
                style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden',
                  border: `2px solid ${i === activeImage ? '#4F46E5' : '#E5E7EB'}`,
                  flexShrink: 0, cursor: 'pointer' }}>
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* 상품 정보 */}
        <div style={{ padding: '20px 16px', background: '#fff',
          borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>
            {item.brand}
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 900, color: '#111827',
            lineHeight: 1.4, letterSpacing: '-0.3px' }}>
            {item.display_name}
          </h1>

          {/* 재고상태 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px',
              borderRadius: 999, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
              {stockLabel(item.stock_status)}
            </span>
            {item.fast_delivery && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px',
                borderRadius: 999, background: '#ECFDF5', color: '#059669',
                border: '1px solid #A7F3D0' }}>⚡ 빠른출고</span>
            )}
            {item.has_detail_page && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px',
                borderRadius: 999, background: '#EEF2FF', color: '#4F46E5',
                border: '1px solid #C7D2FE' }}>📄 상세페이지</span>
            )}
          </div>

          {/* 가격 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#4F46E5', letterSpacing: '-0.5px' }}>
              {fmt(item.supply_price)}원
            </div>
            {item.recommended_price > 0 && (
              <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 2 }}>
                권장 {fmt(item.recommended_price)}원
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700,
                  color: '#059669' }}>
                  마진 {Math.round((1 - item.supply_price / item.recommended_price) * 100)}%
                </span>
              </div>
            )}
          </div>
          {item.min_order_qty > 1 && (
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
              최소 주문수량 {item.min_order_qty}개 이상
            </div>
          )}

          {/* 태그 */}
          {(item.target_age_tags.length > 0 || item.style_tags.length > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {[...item.target_age_tags, ...item.style_tags].map(t => (
                <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999,
                  background: '#F3F4F6', color: '#6B7280', fontWeight: 500 }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 옵션 선택 */}
        {canOrder && item.options.length > 0 && (
          <div style={{ padding: '20px 16px', background: '#fff',
            borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
              옵션 선택
            </div>
            {item.options.map((opt: CatalogOption) => (
              <div key={opt.name} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  {opt.name}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {opt.values.map((val: CatalogOptionValue) => {
                    const isActive = selected[opt.name] === val.value
                    const isOos = val.stock_status === 'out_of_stock'
                    return (
                      <button key={val.value} type="button"
                        disabled={isOos}
                        onClick={() => setSelected(prev => ({ ...prev, [opt.name]: val.value }))}
                        style={{ padding: '10px 16px', borderRadius: 10, fontSize: 14,
                          fontWeight: isActive ? 800 : 600, cursor: isOos ? 'default' : 'pointer',
                          border: `2px solid ${isActive ? '#4F46E5' : isOos ? '#E5E7EB' : '#E5E7EB'}`,
                          background: isActive ? '#EEF2FF' : isOos ? '#F9FAFB' : '#fff',
                          color: isActive ? '#4F46E5' : isOos ? '#CBD5E1' : '#374151',
                          position: 'relative', opacity: isOos ? 0.5 : 1,
                          boxShadow: isActive ? '0 0 0 1px #4F46E5' : 'none' }}>
                        {val.value}
                        {val.price_diff !== 0 && (
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {' '}({val.price_diff > 0 ? '+' : ''}{fmt(val.price_diff)})
                          </span>
                        )}
                        {isOos && (
                          <div style={{ position: 'absolute', top: '50%', left: 8, right: 8,
                            height: 1, background: '#CBD5E1', transform: 'translateY(-50%)' }} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 수량 선택 */}
        {canOrder && (
          <div style={{ padding: '16px', background: '#fff', borderBottom: '1px solid #F3F4F6',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>수량</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0,
              border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <button type="button" onClick={() => setQty(q => Math.max(item.min_order_qty ?? 1, q - 1))}
                style={{ width: 46, height: 46, border: 'none', background: '#F9FAFB',
                  fontSize: 20, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
                −
              </button>
              <div style={{ width: 56, textAlign: 'center', fontSize: 16,
                fontWeight: 800, color: '#111827', borderLeft: '1px solid #E5E7EB',
                borderRight: '1px solid #E5E7EB', height: 46, lineHeight: '46px' }}>
                {qty}
              </div>
              <button type="button" onClick={() => setQty(q => q + 1)}
                style={{ width: 46, height: 46, border: 'none', background: '#F9FAFB',
                  fontSize: 20, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
                +
              </button>
            </div>
          </div>
        )}

        {/* 상품 설명 */}
        {item.description && (
          <div style={{ padding: '20px 16px', background: '#fff', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginBottom: 10 }}>
              상품 설명
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
              {item.description}
            </p>
          </div>
        )}

        {/* 메시지 */}
        {msg && (
          <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            background: msg.startsWith('✓') ? '#064E3B' : '#7F1D1D',
            color: '#fff', padding: '12px 20px', borderRadius: 12,
            fontSize: 14, fontWeight: 700, zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
            animation: 'slideUp 0.2s ease' }}>
            {msg}
          </div>
        )}
      </div>

      {/* 하단 고정 주문 버튼 */}
      <div style={{ position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 768, background: '#fff',
        borderTop: '1px solid #F3F4F6', padding: '12px 16px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)', zIndex: 90 }}>

        {canOrder ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>
                총 {qty}개
              </span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#4F46E5' }}>
                {fmt(totalPrice)}원
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={addToCart} disabled={cartLoading}
                style={{ flex: 1, padding: '14px', borderRadius: 14,
                  border: '2px solid #4F46E5', background: '#fff',
                  color: '#4F46E5', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                {cartLoading ? '...' : '장바구니'}
              </button>
              <button type="button" onClick={buyNow} disabled={orderLoading}
                style={{ flex: 2, padding: '14px', borderRadius: 14,
                  border: 'none', background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                  color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(79,70,229,0.4)' }}>
                {orderLoading ? '처리중...' : '바로 주문'}
              </button>
            </div>
          </>
        ) : (
          <button type="button" disabled
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: '#F3F4F6', color: '#9CA3AF', fontSize: 15, fontWeight: 800 }}>
            {stockLabel(item.stock_status)}
          </button>
        )}
      </div>
    </>
  )
}
