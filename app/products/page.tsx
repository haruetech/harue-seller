'use client'
// app/products/page.tsx — 상품목록 + 고급 필터

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, CatalogItem, stockColor, stockLabel, fmt } from '@/lib/supabase'
import { useSellerAuth } from '@/lib/auth'

// ── 필터 타입 ──
type Filters = {
  search: string
  category: string
  brand: string
  stockStatus: string[]
  priceMin: string
  priceMax: string
  targetAge: string[]
  styleTags: string[]
  featureTags: string[]
  isNew: boolean
  isBest: boolean
  isRestock: boolean
  sort: 'latest' | 'price_asc' | 'price_desc' | 'best'
}

const DEFAULT_FILTERS: Filters = {
  search: '', category: '', brand: '', stockStatus: [],
  priceMin: '', priceMax: '', targetAge: [], styleTags: [],
  featureTags: [], isNew: false, isBest: false, isRestock: false, sort: 'latest',
}

const AGE_TAGS = ['20대', '30대', '40대', '50대', '시니어/실버', '전연령']
const STYLE_TAGS = ['기본', '편한착화감', '안정감', '경량', '쿠션', '중장년', '트렌디', '클래식']
const FEATURE_TAGS = ['빠른출고', '상세페이지제공', '모델컷제공', '소량주문가능', '베스트']
const STOCK_OPTIONS = ['available', 'low_stock', 'out_of_stock', 'restock_soon']

function TagChip({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600,
        border: `1.5px solid ${active ? '#4F46E5' : '#E5E7EB'}`,
        background: active ? '#EEF2FF' : '#fff', color: active ? '#4F46E5' : '#6B7280',
        cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s ease',
        boxShadow: active ? '0 0 0 1px #4F46E5' : 'none' }}>
      {label}
    </button>
  )
}

function ProductCard({ item, isFav, onToggleFav, onClick }: {
  item: CatalogItem
  isFav: boolean
  onToggleFav: (id: string) => void
  onClick: (item: CatalogItem) => void
}) {
  const sc = stockColor(item.stock_status)
  return (
    <div onClick={() => onClick(item)}
      style={{ background: '#fff', borderRadius: 18, border: '1px solid #E5E7EB',
        overflow: 'hidden', cursor: 'pointer', position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s', animation: 'fadeUp 0.2s ease both' }}>
      {/* 이미지 */}
      <div style={{ aspectRatio: '3/4', background: '#F3F4F6', position: 'relative' }}>
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.display_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>👟</div>
        )}
        {/* 배지 */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {item.is_new && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
              background: '#4F46E5', color: '#fff' }}>NEW</span>
          )}
          {item.is_best && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
              background: '#EF4444', color: '#fff' }}>BEST</span>
          )}
          {item.is_restock && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
              background: '#059669', color: '#fff' }}>재입고</span>
          )}
        </div>
        {/* 찜 버튼 */}
        <button type="button"
          onClick={e => { e.stopPropagation(); onToggleFav(item.id) }}
          style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36,
            borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
            border: 'none', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          {isFav ? '❤️' : '🤍'}
        </button>
        {/* 재고상태 */}
        {item.stock_status !== 'available' && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '6px 10px', background: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {stockLabel(item.stock_status)}
            </span>
          </div>
        )}
      </div>
      {/* 정보 */}
      <div style={{ padding: '10px 12px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 2 }}>
          {item.brand}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as any, marginBottom: 6 }}>
          {item.display_name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#4F46E5' }}>
              {fmt(item.supply_price)}원
            </div>
            {item.recommended_price > 0 && (
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                권장 {fmt(item.recommended_price)}원
              </div>
            )}
          </div>
          {item.fast_delivery && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px',
              borderRadius: 999, background: '#ECFDF5', color: '#059669',
              border: '1px solid #A7F3D0' }}>
              빠른출고
            </span>
          )}
        </div>
        {/* 태그 */}
        {item.target_age_tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 7, flexWrap: 'wrap' }}>
            {item.target_age_tags.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999,
                background: '#F3F4F6', color: '#6B7280' }}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useSellerAuth()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    search: searchParams.get('q') ?? '',
  })
  const [showFilter, setShowFilter] = useState(false)
  const [brands, setBrands] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadProducts = useCallback(async (reset = false) => {
    if (!supabase) return
    setLoading(true)
    const offset = reset ? 0 : page * PAGE_SIZE

    let q = supabase
      .from('seller_catalog')
      .select('*')
      .eq('is_visible', true)

    if (filters.search) {
      q = q.or(`display_name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.brand) q = q.eq('brand', filters.brand)
    if (filters.stockStatus.length > 0) q = q.in('stock_status', filters.stockStatus)
    if (filters.priceMin) q = q.gte('supply_price', Number(filters.priceMin))
    if (filters.priceMax) q = q.lte('supply_price', Number(filters.priceMax))
    if (filters.targetAge.length > 0) q = q.overlaps('target_age_tags', filters.targetAge)
    if (filters.styleTags.length > 0) q = q.overlaps('style_tags', filters.styleTags)
    if (filters.featureTags.length > 0) q = q.overlaps('feature_tags', filters.featureTags)
    if (filters.isNew) q = q.eq('is_new', true)
    if (filters.isBest) q = q.eq('is_best', true)
    if (filters.isRestock) q = q.eq('is_restock', true)

    switch (filters.sort) {
      case 'price_asc':  q = q.order('supply_price', { ascending: true }); break
      case 'price_desc': q = q.order('supply_price', { ascending: false }); break
      case 'best':       q = q.order('is_best', { ascending: false }).order('sort_order'); break
      default:           q = q.order('created_at', { ascending: false }); break
    }

    q = q.range(offset, offset + PAGE_SIZE - 1)

    const { data, error } = await q

    if (error) { setLoading(false); return }
    const list = (data ?? []) as CatalogItem[]

    if (reset) {
      setItems(list)
      setPage(0)
    } else {
      setItems(prev => [...prev, ...list])
    }
    setHasMore(list.length === PAGE_SIZE)
    setLoading(false)
  }, [filters, page])

  const loadMeta = useCallback(async () => {
    if (!supabase) return
    const [{ data: bData }, { data: cData }] = await Promise.all([
      supabase.from('seller_catalog').select('brand').eq('is_visible', true).not('brand', 'is', null),
      supabase.from('seller_catalog').select('category').eq('is_visible', true).not('category', 'is', null),
    ])
    setBrands([...new Set((bData ?? []).map((b: any) => b.brand).filter(Boolean))])
    setCategories([...new Set((cData ?? []).map((c: any) => c.category).filter(Boolean))])
  }, [])

  const loadFavs = useCallback(async () => {
    if (!supabase || !user) return
    const { data } = await supabase.from('seller_favorites')
      .select('catalog_id').eq('seller_id', user.seller_id)
    setFavIds(new Set((data ?? []).map((f: any) => f.catalog_id)))
  }, [user])

  useEffect(() => { void loadMeta(); void loadFavs() }, [loadMeta, loadFavs])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { void loadProducts(true) }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [filters])

  function updateFilter<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
  }

  async function toggleFav(catalogId: string) {
    if (!supabase || !user) return
    const isFav = favIds.has(catalogId)
    if (isFav) {
      await supabase.from('seller_favorites').delete()
        .eq('seller_id', user.seller_id).eq('catalog_id', catalogId)
      setFavIds(prev => { const n = new Set(prev); n.delete(catalogId); return n })
    } else {
      await supabase.from('seller_favorites')
        .insert({ seller_id: user.seller_id, catalog_id: catalogId })
      setFavIds(prev => new Set([...prev, catalogId]))
    }
  }

  const activeFilterCount = [
    filters.category, filters.brand,
    ...filters.stockStatus, ...filters.targetAge,
    ...filters.styleTags, ...filters.featureTags,
    filters.priceMin, filters.priceMax,
    filters.isNew && 'new', filters.isBest && 'best', filters.isRestock && 'restock',
  ].filter(Boolean).length

  return (
    <div>
      {/* 검색바 */}
      <div style={{ padding: '12px 16px', background: '#fff',
        borderBottom: '1px solid #F3F4F6', position: 'sticky', top: 54, zIndex: 40 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
            <input value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              placeholder="상품명, 브랜드, 품번 검색"
              style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 12,
                border: '1.5px solid #E5E7EB', fontSize: 15, outline: 'none',
                background: '#F9FAFB' }}
              onFocus={e => e.target.style.borderColor = '#4F46E5'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
          </div>
          <button type="button" onClick={() => setShowFilter(!showFilter)}
            style={{ position: 'relative', width: 46, height: 46, borderRadius: 12,
              border: `1.5px solid ${showFilter ? '#4F46E5' : '#E5E7EB'}`,
              background: showFilter ? '#EEF2FF' : '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            🔧
            {activeFilterCount > 0 && (
              <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18,
                borderRadius: '50%', background: '#EF4444', color: '#fff',
                fontSize: 10, fontWeight: 800, display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                {activeFilterCount}
              </div>
            )}
          </button>
        </div>

        {/* 정렬 탭 */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }}>
          {(['latest','best','price_asc','price_desc'] as const).map(s => {
            const labels = { latest:'최신순', best:'인기순', price_asc:'저가순', price_desc:'고가순' }
            return (
              <TagChip key={s} label={labels[s]}
                active={filters.sort === s}
                onClick={() => updateFilter('sort', s)} />
            )
          })}
        </div>
      </div>

      {/* 필터 드로어 */}
      {showFilter && (
        <div style={{ background: '#fff', borderBottom: '2px solid #E5E7EB',
          padding: '16px 16px 20px', animation: 'fadeUp 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>필터</div>
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)}
              style={{ fontSize: 13, color: '#4F46E5', fontWeight: 700,
                border: 'none', background: 'none', cursor: 'pointer' }}>
              초기화
            </button>
          </div>

          {/* 카테고리 */}
          {categories.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>카테고리</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['전체', ...categories].map(c => (
                  <TagChip key={c} label={c}
                    active={c === '전체' ? !filters.category : filters.category === c}
                    onClick={() => updateFilter('category', c === '전체' ? '' : c)} />
                ))}
              </div>
            </div>
          )}

          {/* 브랜드 */}
          {brands.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>브랜드</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {brands.map(b => (
                  <TagChip key={b} label={b}
                    active={filters.brand === b}
                    onClick={() => updateFilter('brand', filters.brand === b ? '' : b)} />
                ))}
              </div>
            </div>
          )}

          {/* 연령대 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>연령대</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AGE_TAGS.map(t => (
                <TagChip key={t} label={t}
                  active={filters.targetAge.includes(t)}
                  onClick={() => updateFilter('targetAge', toggleArr(filters.targetAge, t))} />
              ))}
            </div>
          </div>

          {/* 스타일 태그 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>스타일</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STYLE_TAGS.map(t => (
                <TagChip key={t} label={t}
                  active={filters.styleTags.includes(t)}
                  onClick={() => updateFilter('styleTags', toggleArr(filters.styleTags, t))} />
              ))}
            </div>
          </div>

          {/* 실무 필터 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>실무 조건</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FEATURE_TAGS.map(t => (
                <TagChip key={t} label={t}
                  active={filters.featureTags.includes(t)}
                  onClick={() => updateFilter('featureTags', toggleArr(filters.featureTags, t))} />
              ))}
            </div>
          </div>

          {/* 특수 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>분류</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <TagChip label="신상품" active={filters.isNew} onClick={() => updateFilter('isNew', !filters.isNew)} />
              <TagChip label="베스트" active={filters.isBest} onClick={() => updateFilter('isBest', !filters.isBest)} />
              <TagChip label="재입고" active={filters.isRestock} onClick={() => updateFilter('isRestock', !filters.isRestock)} />
            </div>
          </div>

          {/* 재고상태 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>재고 상태</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STOCK_OPTIONS.map(s => {
                const labels: Record<string,string> = {
                  available:'주문가능', low_stock:'소량남음',
                  out_of_stock:'품절', restock_soon:'재입고예정'
                }
                return (
                  <TagChip key={s} label={labels[s]}
                    active={filters.stockStatus.includes(s)}
                    onClick={() => updateFilter('stockStatus', toggleArr(filters.stockStatus, s))} />
                )
              })}
            </div>
          </div>

          {/* 가격 범위 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>공급가 범위</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" value={filters.priceMin}
                onChange={e => updateFilter('priceMin', e.target.value)}
                placeholder="최소"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 10,
                  border: '1px solid #E5E7EB', fontSize: 14, outline: 'none' }} />
              <span style={{ color: '#9CA3AF', fontSize: 14 }}>~</span>
              <input type="number" value={filters.priceMax}
                onChange={e => updateFilter('priceMax', e.target.value)}
                placeholder="최대"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 10,
                  border: '1px solid #E5E7EB', fontSize: 14, outline: 'none' }} />
              <span style={{ fontSize: 13, color: '#6B7280' }}>원</span>
            </div>
          </div>
        </div>
      )}

      {/* 상품 그리드 */}
      <div style={{ padding: '16px 12px' }}>
        {loading && items.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 300 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #E0E7FF',
              borderTopColor: '#4F46E5', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>검색 결과가 없습니다</div>
            <div style={{ fontSize: 14 }}>다른 키워드나 필터를 시도해보세요</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
              gap: 12, marginBottom: 16 }}>
              {items.map(item => (
                <ProductCard key={item.id} item={item}
                  isFav={favIds.has(item.id)}
                  onToggleFav={toggleFav}
                  onClick={item => router.push(`/products/${item.id}`)} />
              ))}
            </div>
            {hasMore && (
              <button type="button"
                onClick={() => { setPage(p => p + 1); void loadProducts(false) }}
                disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: 14,
                  border: '1.5px solid #E5E7EB', background: '#fff',
                  fontSize: 14, fontWeight: 700, color: '#4F46E5', cursor: 'pointer' }}>
                {loading ? '불러오는 중...' : '더보기'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
