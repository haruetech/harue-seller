# seller.haruepick.com 로그인 복구 (v1)

## 상태 (먼저 읽어 주세요)
- **원인 확정: 아직 못 했습니다.** 제가 있는 환경에서는 배포된 사이트, Supabase 프로젝트, Authentication Users, 서버 로그에 접속할 수 없습니다. 아래 "원인 확인 순서"를 한 번 실행해 주시면 원인이 가려집니다.
- **실제 Supabase 계정으로 로그인 성공은 확인하지 못했습니다.** 그래서 "복구 완료"가 아닙니다.
- 코드는 고쳤고, 실제 supabase-js 클라이언트를 로컬 가짜 인증 서버에 연결한 테스트 8개와 브라우저 흐름 확인은 통과했습니다.

## 코드에서 확인한 사실
1. `app/login/page.tsx`가 로그인 실패를 **전부** "이메일 또는 비밀번호가 올바르지 않습니다"로 표시했습니다. 그래서 이 문구만으로는 비밀번호 오류인지, 계정이 이 Supabase 프로젝트에 없는지, 이메일 미인증인지, 연결 문제인지 구분할 수 없었습니다.
2. Supabase 환경변수가 없으면 로그인 버튼이 **아무 반응 없이** 끝났습니다(화면 안내 없음).
3. 비밀번호 재설정 기능이 없고 메일 주소만 안내돼 있었습니다.
4. `lib/auth.ts`가 `lib/supabase.ts` 전체를 복사해 갖고 있어 Supabase 클라이언트가 **2개** 만들어졌습니다(세션 갱신 충돌 가능). 하나로 합쳤습니다.
5. 소스 ZIP에는 `.env`가 없어 **배포 환경에 어떤 Supabase 주소가 들어 있는지는 코드로 확인할 수 없습니다.**

## 수정 내용
| 파일 | 내용 |
|---|---|
| `lib/auth-errors.ts` (신규) | 오류 분류(비밀번호 오류 / 이메일 미인증 / 시도 제한 / 이용 제한 / 연결 실패 / 서버 문제 / 알 수 없음), 셀러 계정 확인 결과 분류, 환경변수 점검, 개발 로그(오류 코드만) |
| `app/login/page.tsx` | 오류별 안내, 환경변수 누락·형식 오류 별도 안내, `seller_users`·`sellers` 권한 확인 유지(없음/비활성/권한 오류/테이블 없음을 구분), 비밀번호 찾기 링크, 재설정 완료 안내, 스피너 애니메이션 누락 보완 |
| `app/forgot-password/page.tsx` (신규) | 재설정 메일 요청. 계정 존재 여부는 알려 주지 않음 |
| `app/reset-password/page.tsx` (신규) | 메일 링크로 들어와 새 비밀번호 설정(8자 이상, 확인 입력, 만료·재사용 링크 안내), 완료 후 로그아웃하고 로그인 화면으로 |
| `components/AuthCard.tsx` (신규) | 위 두 화면 공통 카드 |
| `app/layout.tsx` | `/forgot-password`, `/reset-password`를 로그인 없이 열리는 경로로 추가 |
| `lib/supabase.ts`, `lib/auth.ts` | 환경변수 읽기 함수 추가, 클라이언트 단일화 |
| `test/auth-errors.test.ts`, `package.json` | 테스트(`npm test`), `tsx` 개발 의존성 |
- 비밀번호·토큰·이메일은 코드에 고정하거나 로그로 남기지 않습니다. 개발 중 콘솔에는 `[seller-auth] signIn: invalid_credentials` 같은 **코드만** 나옵니다(운영 빌드에서는 출력 없음).
- 상품·주문·거래처 등 DB 데이터와 스키마(`seller_schema.sql`)는 건드리지 않았습니다. 인증 우회·임시 로그인은 없습니다.

## 원인 확인 순서 (Supabase 대시보드, 읽기만 합니다)
1. **프로젝트 일치 확인**: Vercel(seller 프로젝트) → Settings → Environment Variables의 `NEXT_PUBLIC_SUPABASE_URL` 주소(`https://<ref>.supabase.co`)와, 계정이 들어 있는 Supabase 프로젝트의 주소가 같은지 비교. (admin 쪽 프로젝트와 다를 수 있습니다.) 값을 바꿨다면 **다시 배포**해야 적용됩니다.
2. **SQL Editor에서 실행** (비밀번호 해시는 조회하지 않습니다. `셀러이메일` 부분만 바꾸세요):
```sql
-- A. 이 프로젝트에 계정이 있는지, 인증·정지 상태
select id, email, email_confirmed_at, last_sign_in_at, banned_until, created_at
from auth.users where lower(email) = lower('셀러이메일');

-- B. 셀러 포털 권한(seller_users)과 셀러사 상태
select su.id, su.auth_id, su.is_active, s.code, s.name, s.status
from seller_users su join sellers s on s.id = su.seller_id
where lower(su.email) = lower('셀러이메일');

-- C. 연결이 끊긴 셀러 계정(auth 계정이 없는 seller_users)
select su.email, su.auth_id from seller_users su
left join auth.users u on u.id = su.auth_id where u.id is null;
```
| 결과 | 의미 | 조치 |
|---|---|---|
| A가 0행 | 이 프로젝트에 계정 자체가 없음(프로젝트가 다르거나 만든 적 없음) | 1번 비교. 맞는 프로젝트로 환경변수 수정 후 재배포, 또는 Authentication → Users → Add user로 계정 생성 후 `seller_users.auth_id` 연결 |
| A 있음, `email_confirmed_at`이 비어 있음 | 이메일 미인증 | 새 화면이 "이메일 인증" 안내를 표시. Users에서 인증 처리 또는 인증 메일 재발송 |
| A 있음, `banned_until` 값 있음 | 이용 제한 | 해제 |
| A 있음, B가 0행 또는 `auth_id` 불일치 | 로그인은 되지만 "셀러 포털 접근 권한 없음" | `seller_users.auth_id`를 A의 `id`로 연결(데이터 수정이라 직접 확인 후 진행) |
| A·B 정상 | 비밀번호가 다름 | 아래 재설정 |

## 비밀번호 초기화 방법
- **방법 1(권장)**: 로그인 화면 → "비밀번호를 잊으셨나요?" → 메일 받기 → 링크에서 새 비밀번호 설정.
  - 사전 설정: Supabase → Authentication → URL Configuration → **Redirect URLs**에 `https://seller.haruepick.com/reset-password` 추가(Site URL도 `https://seller.haruepick.com`). 없으면 메일 링크가 거부됩니다.
  - 메일이 안 오면 Supabase 기본 메일은 시간당 발송 한도가 작습니다. 사용자 수가 늘면 Authentication → SMTP에 별도 SMTP를 연결하세요.
- **방법 2**: Authentication → Users → 해당 계정 → "Send password recovery" 또는 새 비밀번호 직접 설정. 계정·주문·상품 데이터는 지워지지 않습니다.

## 테스트 결과
- `npm test`: 8개 통과 — 실제 supabase-js 클라이언트로 가짜 인증 서버(GoTrue 응답 형식)에서 invalid_credentials / email_not_confirmed / user_banned / 429 / 500 / 연결 불가 / 재설정 요청·한도 / weak·same password 분류 확인, 셀러 권한 분류, 환경변수 점검, 로그에 코드만 남는지
- 브라우저(헤드리스)로 가짜 서버에 연결해 확인: 비밀번호 오류·시도 제한·권한 없음·비활성 안내, 로그인 성공 후 홈 이동과 셀러 정보 표시, 비밀번호 찾기 요청, 재설정 링크(정상/만료/없음), 8자 미만·불일치 검사, 변경 후 로그인 화면 안내, 환경변수 누락 안내
- `tsc`·`next build` 통과
- **미확인**: 실제 Supabase 프로젝트·실제 계정으로 로그인, 실제 재설정 메일 발송·수신, 소매업체 권한·주문 화면(실데이터)

## 앞으로 ai.haruepick.com 통합 시
`seller_users`/`sellers`/`seller_orders` 구조와 RLS(`get_my_seller_id()`)는 그대로 두고, 인증 오류 분류(`lib/auth-errors.ts`)와 재설정 화면은 재사용할 수 있습니다.
