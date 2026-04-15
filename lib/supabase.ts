// ─────────────────────────────────────────────
// lib/supabase.ts
// seller.haruepick.com 공통 Supabase 클라이언트 + 타입
// ─────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Supabase 클라이언트 ──
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

export const supabase = getSupabase()

// ─────────────────────────────────────────────
// 공통 타입 정의
// ─────────────────────────────────────────────

export type Seller = {
  id: string
  code: string
  name: string
  owner_name: string | null
  phone: string | null
  email: string | null
  seller_type: 'general' | 'premium' | 'vip'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  status: 'active' | 'suspended' | 'pending'
}

export type SellerUser = {
  id: string
  seller_id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'staff'
  is_active: boolean
  seller: Seller
}

export type CatalogItem = {
  id: string
  display_name: string
  brand: string | null
  category: string | null
  description: string | null
  thumbnail_url: string | null
  images: { url: string; order: number; type: string }[]
  supply_price: number
  recommended_price: number
  min_order_qty: number
  options: CatalogOption[]
  stock_status: 'available' | 'low_stock' | 'out_of_stock' | 'restock_soon' | 'discontinued'
  target_age_tags: string[]
  style_tags: string[]
  feature_tags: string[]
  category_tags: string[]
  season: string | null
  is_new: boolean
  is_best: boolean
  is_restock: boolean
  has_detail_page: boolean
  has_model_cut: boolean
  fast_delivery: boolean
  small_order_ok: boolean
  is_visible: boolean
  sort_order: number
}

export type CatalogOption = {
  name: string  // 컬러 / 사이즈
  values: CatalogOptionValue[]
}

export type CatalogOptionValue = {
  value: string
  sku_id: string | null
  stock_status: string
  price_diff: number
}

export type SellerAddress = {
  id: string
  seller_id: string
  label: string
  recipient: string
  phone: string
  zipcode: string | null
  address1: string
  address2: string | null
  is_default: boolean
}

export type CartItem = {
  id: string
  catalog_id: string
  catalog: CatalogItem
  option_name: string | null
  option_value: string | null
  sku_id: string | null
  qty: number
}

export type OrderStatus = '주문접수' | '확인중' | '준비중' | '출고완료' | '취소' | '부분취소'

export type SellerOrder = {
  id: string
  order_no: string
  seller_id: string
  status: OrderStatus
  total_qty: number
  total_amount: number
  note: string | null
  ordered_at: string
  confirmed_at: string | null
  shipped_at: string | null
  seller_order_items: SellerOrderItem[]
  seller_addresses?: SellerAddress | null
}

export type SellerOrderItem = {
  id: string
  order_id: string
  catalog_id: string
  catalog?: CatalogItem
  option_name: string | null
  option_value: string | null
  qty: number
  unit_price: number
  subtotal: number
  status: string
}

export type SellerDocument = {
  id: string
  doc_type: string
  title: string
  file_url: string | null
  thumbnail_url: string | null
  catalog_id: string | null
  order_id: string | null
  created_at: string
}

export type SellerNotice = {
  id: string
  title: string
  body: string
  is_pinned: boolean
  created_at: string
}

// ─────────────────────────────────────────────
// 재고 상태 헬퍼
// ─────────────────────────────────────────────
export function stockLabel(status: string): string {
  const m: Record<string, string> = {
    available:    '주문 가능',
    low_stock:    '소량 남음',
    out_of_stock: '품절',
    restock_soon: '재입고 예정',
    discontinued: '단종',
  }
  return m[status] ?? status
}

export function stockColor(status: string): { bg: string; text: string; border: string } {
  const m: Record<string, { bg: string; text: string; border: string }> = {
    available:    { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
    low_stock:    { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    out_of_stock: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    restock_soon: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    discontinued: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  }
  return m[status] ?? { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' }
}

export function orderStatusColor(status: string): { bg: string; text: string; border: string } {
  const m: Record<string, { bg: string; text: string; border: string }> = {
    '주문접수': { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    '확인중':   { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    '준비중':   { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
    '출고완료': { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
    '취소':     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
    '부분취소': { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  }
  return m[status] ?? { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' }
}

export function fmt(v: number): string {
  return Number(v || 0).toLocaleString()
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '-'
  return new Date(v).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  return new Date(v).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─────────────────────────────────────────────
// lib/auth.ts
// 셀러 인증 훅
// ─────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useSellerAuth() {
  const [user, setUser] = useState<SellerUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const checkAuth = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) { setLoading(false); return }

    const { data: { session } } = await sb.auth.getSession()
    if (!session) { router.replace('/login'); return }

    const { data: su } = await sb
      .from('seller_users')
      .select('*, seller:sellers(*)')
      .eq('auth_id', session.user.id)
      .single()

    if (!su || !su.is_active) {
      await sb.auth.signOut()
      router.replace('/login')
      return
    }

    setUser(su as SellerUser)
    // 마지막 로그인 업데이트
    await sb.from('seller_users').update({ last_login_at: new Date().toISOString() }).eq('id', su.id)
    setLoading(false)
  }, [router])

  useEffect(() => { void checkAuth() }, [checkAuth])

  async function logout() {
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
    router.replace('/login')
  }

  return { user, loading, logout, refetch: checkAuth }
}
