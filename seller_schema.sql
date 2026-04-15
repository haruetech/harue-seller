-- ============================================================
-- 하루에픽 Seller Portal DB 스키마
-- seller.haruepick.com
-- admin / vendor 구조와 연동
-- ============================================================

-- ────────────────────────────────────────────
-- 1. sellers (셀러 마스터)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sellers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,         -- SL-00001
  name            text NOT NULL,                -- 상호명
  owner_name      text,
  business_no     text,
  phone           text,
  email           text,
  address         text,
  region          text,                         -- 서울/경기/지방/해외
  seller_type     text DEFAULT 'general',       -- general / premium / vip
  tier            text DEFAULT 'bronze',        -- bronze / silver / gold / platinum
  status          text DEFAULT 'active',        -- active / suspended / pending
  joined_at       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sellers_code   ON sellers(code);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_tier   ON sellers(tier);

-- ────────────────────────────────────────────
-- 2. seller_users (셀러 로그인 계정)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id     uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'staff',  -- owner / manager / staff
  is_active     boolean DEFAULT true,
  last_login_at timestamptz,
  push_token    text,                           -- PWA 푸시
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_su_seller_id ON seller_users(seller_id);
CREATE INDEX IF NOT EXISTS idx_su_auth_id   ON seller_users(auth_id);

-- ────────────────────────────────────────────
-- 3. seller_addresses (배송지 관리)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_addresses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT '기본배송지',
  recipient    text NOT NULL,
  phone        text NOT NULL,
  zipcode      text,
  address1     text NOT NULL,
  address2     text,
  is_default   boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sa_seller_id ON seller_addresses(seller_id);

-- ────────────────────────────────────────────
-- 4. seller_catalog (셀러 노출용 상품 카탈로그)
--    vendor_products → admin 승인 → seller_catalog
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_catalog (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_product_id    uuid REFERENCES vendor_products(id),  -- 원본 도매상품
  wms_product_id       uuid REFERENCES wms_products(id),     -- WMS 연결
  -- 셀러 노출용 정보
  display_name         text NOT NULL,            -- 셀러 노출 상품명
  brand                text,
  category             text,
  sub_category         text,
  description          text,
  detail_html          text,                     -- 상세페이지 HTML
  thumbnail_url        text,
  images               jsonb DEFAULT '[]',       -- [{url, order, type}]
  -- 가격
  supply_price         integer NOT NULL DEFAULT 0,  -- 공급가
  recommended_price    integer DEFAULT 0,            -- 권장판매가
  min_order_qty        integer DEFAULT 1,
  -- 옵션
  options              jsonb DEFAULT '[]',
  -- [{name:'컬러', values:[{value:'블랙',sku_id,stock_status,price_diff}]}]
  -- 재고 상태 (WMS에서 계산, 셀러에게는 단순 표시)
  stock_status         text DEFAULT 'available',
  -- available / low_stock / out_of_stock / restock_soon / discontinued
  -- 태그 시스템
  target_age_tags      text[] DEFAULT '{}',
  -- ['20대','30대','40대','50대','시니어']
  style_tags           text[] DEFAULT '{}',
  -- ['기본','편한착화감','안정감','경량','쿠션','중장년']
  feature_tags         text[] DEFAULT '{}',
  -- ['빠른출고','상세페이지제공','모델컷제공','소량주문가능']
  category_tags        text[] DEFAULT '{}',
  -- ['로퍼','스니커즈','힐','부츠','샌들']
  season               text,                     -- SS/FW/AW/SS-FW
  is_new               boolean DEFAULT false,
  is_best              boolean DEFAULT false,
  is_restock           boolean DEFAULT false,
  has_detail_page      boolean DEFAULT false,
  has_model_cut        boolean DEFAULT false,
  fast_delivery        boolean DEFAULT false,
  small_order_ok       boolean DEFAULT false,
  -- 노출 설정
  is_visible           boolean DEFAULT true,
  sort_order           integer DEFAULT 0,
  approved_at          timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sc_stock    ON seller_catalog(stock_status);
CREATE INDEX IF NOT EXISTS idx_sc_visible  ON seller_catalog(is_visible);
CREATE INDEX IF NOT EXISTS idx_sc_new      ON seller_catalog(is_new);
CREATE INDEX IF NOT EXISTS idx_sc_best     ON seller_catalog(is_best);
CREATE INDEX IF NOT EXISTS idx_sc_brand    ON seller_catalog(brand);
CREATE INDEX IF NOT EXISTS idx_sc_age_tags ON seller_catalog USING gin(target_age_tags);
CREATE INDEX IF NOT EXISTS idx_sc_style    ON seller_catalog USING gin(style_tags);
CREATE INDEX IF NOT EXISTS idx_sc_feat     ON seller_catalog USING gin(feature_tags);
CREATE INDEX IF NOT EXISTS idx_sc_name_fts ON seller_catalog USING gin(to_tsvector('simple', display_name));

-- ────────────────────────────────────────────
-- 5. seller_price_policies (셀러 등급별 가격정책)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_price_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier            text NOT NULL,                -- bronze/silver/gold/platinum
  catalog_id      uuid REFERENCES seller_catalog(id) ON DELETE CASCADE,
  -- NULL이면 전체 적용
  discount_rate   numeric(5,2) DEFAULT 0,       -- 할인율 %
  fixed_price     integer,                      -- 고정가 (NULL이면 rate 적용)
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spp_tier       ON seller_price_policies(tier);
CREATE INDEX IF NOT EXISTS idx_spp_catalog_id ON seller_price_policies(catalog_id);

-- ────────────────────────────────────────────
-- 6. seller_favorites (찜상품)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES seller_catalog(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (seller_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_sf_seller_id  ON seller_favorites(seller_id);
CREATE INDEX IF NOT EXISTS idx_sf_catalog_id ON seller_favorites(catalog_id);

-- ────────────────────────────────────────────
-- 7. seller_orders (주문 헤더)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no           text NOT NULL UNIQUE,      -- SO-20260415-001
  seller_id          uuid NOT NULL REFERENCES sellers(id),
  seller_user_id     uuid REFERENCES seller_users(id),
  address_id         uuid REFERENCES seller_addresses(id),
  status             text NOT NULL DEFAULT '주문접수',
  -- 주문접수 / 확인중 / 준비중 / 출고완료 / 취소 / 부분취소
  total_qty          integer DEFAULT 0,
  total_amount       integer DEFAULT 0,
  note               text,
  -- 관리자 연결 (처리 후)
  purchase_order_id  uuid REFERENCES purchase_orders(id),
  wms_outbound_id    uuid REFERENCES wms_outbounds(id),
  ordered_at         timestamptz DEFAULT now(),
  confirmed_at       timestamptz,
  shipped_at         timestamptz,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_seller_id ON seller_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_so_status    ON seller_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_ordered   ON seller_orders(ordered_at DESC);

-- ────────────────────────────────────────────
-- 8. seller_order_items (주문 품목)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES seller_orders(id) ON DELETE CASCADE,
  catalog_id   uuid NOT NULL REFERENCES seller_catalog(id),
  option_name  text,
  option_value text,
  sku_id       uuid REFERENCES wms_skus(id),
  qty          integer NOT NULL,
  unit_price   integer NOT NULL,
  subtotal     integer NOT NULL,
  status       text DEFAULT '주문접수',
  note         text
);

CREATE INDEX IF NOT EXISTS idx_soi_order_id   ON seller_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_soi_catalog_id ON seller_order_items(catalog_id);

-- ────────────────────────────────────────────
-- 9. seller_cart (장바구니)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_cart (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  catalog_id   uuid NOT NULL REFERENCES seller_catalog(id),
  option_name  text,
  option_value text,
  sku_id       uuid REFERENCES wms_skus(id),
  qty          integer NOT NULL DEFAULT 1,
  added_at     timestamptz DEFAULT now(),
  UNIQUE (seller_id, catalog_id, option_value)
);

CREATE INDEX IF NOT EXISTS idx_cart_seller_id ON seller_cart(seller_id);

-- ────────────────────────────────────────────
-- 10. seller_viewed (최근 본 상품)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_viewed (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES seller_catalog(id),
  viewed_at  timestamptz DEFAULT now(),
  UNIQUE (seller_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_sv_seller_id ON seller_viewed(seller_id);
CREATE INDEX IF NOT EXISTS idx_sv_viewed_at ON seller_viewed(viewed_at DESC);

-- ────────────────────────────────────────────
-- 11. seller_notices (공지사항 - 셀러 전용)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  is_pinned   boolean DEFAULT false,
  is_visible  boolean DEFAULT true,
  target_tier text DEFAULT 'all',              -- all/bronze/silver/gold/platinum
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────
-- 12. seller_documents (셀러 문서함)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid REFERENCES sellers(id),     -- NULL이면 전체 공개
  doc_type    text NOT NULL,
  -- order_doc / statement / catalog_image / detail_page /
  -- sales_guide / model_cut / thumbnail / notice_doc
  title       text NOT NULL,
  file_url    text,
  thumbnail_url text,
  catalog_id  uuid REFERENCES seller_catalog(id),
  order_id    uuid REFERENCES seller_orders(id),
  is_public   boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_seller_id  ON seller_documents(seller_id);
CREATE INDEX IF NOT EXISTS idx_sd_catalog_id ON seller_documents(catalog_id);
CREATE INDEX IF NOT EXISTS idx_sd_type       ON seller_documents(doc_type);

-- ────────────────────────────────────────────
-- 13. RLS 정책
-- ────────────────────────────────────────────
ALTER TABLE sellers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_addresses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_favorites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_cart       ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_viewed     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_documents  ENABLE ROW LEVEL SECURITY;

-- 내 seller_id 조회 헬퍼
CREATE OR REPLACE FUNCTION get_my_seller_id()
RETURNS uuid AS $$
  SELECT seller_id FROM seller_users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- seller_catalog: 전체 셀러 읽기 가능
ALTER TABLE seller_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_read ON seller_catalog FOR SELECT TO authenticated USING (is_visible = true);

-- 각 테이블 자신의 seller_id만 접근
CREATE POLICY su_self ON seller_users FOR SELECT TO authenticated USING (auth_id = auth.uid());
CREATE POLICY sa_own ON seller_addresses FOR ALL TO authenticated USING (seller_id = get_my_seller_id());
CREATE POLICY sf_own ON seller_favorites FOR ALL TO authenticated USING (seller_id = get_my_seller_id());
CREATE POLICY so_own ON seller_orders FOR SELECT TO authenticated USING (seller_id = get_my_seller_id());
CREATE POLICY so_insert ON seller_orders FOR INSERT TO authenticated WITH CHECK (seller_id = get_my_seller_id());
CREATE POLICY soi_own ON seller_order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM seller_orders WHERE seller_id = get_my_seller_id()));
CREATE POLICY cart_own ON seller_cart FOR ALL TO authenticated USING (seller_id = get_my_seller_id());
CREATE POLICY sv_own ON seller_viewed FOR ALL TO authenticated USING (seller_id = get_my_seller_id());
CREATE POLICY sd_own ON seller_documents FOR SELECT TO authenticated
  USING (seller_id = get_my_seller_id() OR seller_id IS NULL);
CREATE POLICY sn_read ON seller_notices FOR SELECT TO authenticated USING (is_visible = true);

-- ────────────────────────────────────────────
-- 14. 재고상태 자동 동기화 (WMS → seller_catalog)
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_catalog_stock_status()
RETURNS void AS $$
DECLARE
  r RECORD;
  v_total int;
BEGIN
  FOR r IN SELECT sc.id, sc.wms_product_id FROM seller_catalog sc WHERE sc.wms_product_id IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(i.qty_available), 0) INTO v_total
    FROM wms_skus s
    JOIN wms_inventory i ON i.sku_id = s.id
    WHERE s.product_id = r.wms_product_id;

    UPDATE seller_catalog SET
      stock_status = CASE
        WHEN v_total = 0 THEN 'out_of_stock'
        WHEN v_total <= 5 THEN 'low_stock'
        ELSE 'available'
      END,
      updated_at = now()
    WHERE id = r.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- 15. 주문번호 생성 함수
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_seller_order_no()
RETURNS text AS $$
DECLARE
  today text := to_char(now(), 'YYYYMMDD');
  seq   bigint;
BEGIN
  SELECT COUNT(*) + 1 INTO seq FROM seller_orders WHERE order_no LIKE 'SO-' || today || '-%';
  RETURN 'SO-' || today || '-' || LPAD(seq::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────
-- 16. seller_catalog 샘플 데이터
-- ────────────────────────────────────────────
INSERT INTO seller_catalog (
  display_name, brand, category, supply_price, recommended_price,
  stock_status, is_new, is_best, target_age_tags, style_tags, feature_tags,
  thumbnail_url, description
) VALUES
  ('미니멈 클래식 로퍼 여성화', '미니멈', '로퍼', 32000, 59000,
   'available', true, false,
   ARRAY['40대','50대','시니어'], ARRAY['기본','편한착화감','안정감'],
   ARRAY['상세페이지제공','모델컷제공'],
   '/images/sample1.jpg', '편안한 착화감의 클래식 로퍼'),
  ('하루에 키높이 스니커즈 8cm', '하루에', '스니커즈', 28000, 52000,
   'low_stock', false, true,
   ARRAY['30대','40대'], ARRAY['경량','쿠션'],
   ARRAY['빠른출고','소량주문가능'],
   '/images/sample2.jpg', '일상에서 편하게 신을 수 있는 키높이 스니커즈')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────
-- 17. updated_at 트리거
-- ────────────────────────────────────────────
CREATE TRIGGER trg_sc_updated_at BEFORE UPDATE ON seller_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_so_updated_at BEFORE UPDATE ON seller_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sellers_updated_at BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
