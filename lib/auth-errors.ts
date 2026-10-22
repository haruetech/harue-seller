// 로그인·비밀번호 재설정 오류를 종류별로 나누고, 화면에 보여 줄 안전한 안내문을 돌려줍니다.
// 화면에는 원문 오류 메시지(서버가 준 문자열)를 그대로 보여 주지 않고, 개발 로그에는 오류 '코드'만 남깁니다.
// 이메일·비밀번호·토큰은 어떤 경우에도 로그에 넣지 않습니다.

export type AuthFailureKind =
  | 'invalid_credentials' | 'email_not_confirmed' | 'rate_limited' | 'user_banned'
  | 'weak_password' | 'same_password' | 'link_expired' | 'network' | 'server' | 'unknown'
export type ProfileFailureKind = 'no_profile' | 'inactive' | 'seller_inactive' | 'permission' | 'db_setup' | 'profile_error'
export type ConfigFailureKind = 'env_missing_url' | 'env_missing_key' | 'env_bad_url'

type ErrLike = { code?: string | number; status?: number; name?: string; message?: string } | null | undefined

export const AUTH_MESSAGES: Record<AuthFailureKind, string> = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다. 비밀번호가 기억나지 않으면 아래 “비밀번호를 잊으셨나요?”를 눌러 주세요.',
  email_not_confirmed: '이메일 인증이 아직 끝나지 않았습니다. 받은 메일함의 인증 링크를 눌러 주세요.',
  rate_limited: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  user_banned: '이용이 제한된 계정입니다. 고객센터로 문의해 주세요.',
  weak_password: '비밀번호가 너무 약합니다. 영문·숫자를 섞어 8자 이상으로 정해 주세요.',
  same_password: '이전과 다른 새 비밀번호를 입력해 주세요.',
  link_expired: '재설정 링크가 만료되었거나 이미 사용되었습니다. 비밀번호 재설정을 다시 요청해 주세요.',
  network: '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.',
  server: '인증 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
  unknown: '로그인하지 못했습니다. 잠시 후 다시 시도하고, 계속되면 고객센터로 문의해 주세요.',
}
export const PROFILE_MESSAGES: Record<ProfileFailureKind, string> = {
  no_profile: '셀러 포털 접근 권한이 없습니다. 하루에픽 고객센터로 문의해 주세요.',
  inactive: '계정이 비활성화 상태입니다. 고객센터로 문의해 주세요.',
  seller_inactive: '계정이 비활성화 상태입니다. 고객센터로 문의해 주세요.',
  permission: '계정 정보를 읽을 권한이 없습니다. 관리자에게 문의해 주세요.',
  db_setup: '서비스 설정이 완료되지 않았습니다(셀러 계정 테이블). 관리자에게 문의해 주세요.',
  profile_error: '계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
}
export const CONFIG_MESSAGES: Record<ConfigFailureKind, string> = {
  env_missing_url: '서비스 설정이 완료되지 않았습니다(Supabase 주소 없음). 관리자에게 문의해 주세요.',
  env_missing_key: '서비스 설정이 완료되지 않았습니다(Supabase 공개 키 없음). 관리자에게 문의해 주세요.',
  env_bad_url: '서비스 설정이 올바르지 않습니다(Supabase 주소 형식 오류). 관리자에게 문의해 주세요.',
}

const msg = (e: ErrLike) => String(e?.message ?? '').toLowerCase()

/** supabase-js(auth) 오류 → 종류. 오류 코드(code)를 우선 보고, 코드가 없는 구버전 응답은 메시지로 보완합니다. */
export function classifyAuthError(e: ErrLike): { kind: AuthFailureKind; code: string } {
  const code = String(e?.code ?? '')
  const m = msg(e)
  const status = typeof e?.status === 'number' ? e.status : undefined
  const done = (kind: AuthFailureKind) => ({ kind, code: code || e?.name || (status !== undefined ? 'http_' + status : 'unknown') })
  if (code === 'invalid_credentials' || m.includes('invalid login credentials')) return done('invalid_credentials')
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) return done('email_not_confirmed')
  if (code === 'user_banned') return done('user_banned')
  if (code === 'weak_password') return done('weak_password')
  if (code === 'same_password') return done('same_password')
  if (code === 'otp_expired' || code === 'bad_jwt' || code === 'session_not_found' || code === 'session_expired' || m.includes('expired') || m.includes('auth session missing')) return done('link_expired')
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || code === 'over_sms_send_rate_limit' || status === 429) return done('rate_limited')
  if (e?.name === 'AuthRetryableFetchError' || e?.name === 'AuthUnknownError' && !status || m.includes('failed to fetch') || m.includes('fetch failed') || m.includes('networkerror') || status === 0) return done('network')
  if ((status !== undefined && status >= 500) || code === 'unexpected_failure') return done('server')
  return done('unknown')
}

/** seller_users 조회 결과 → 종류. data 가 있으면 활성 여부까지 판단합니다. */
export function classifyProfile(res: { data: { is_active?: boolean | null; seller?: { status?: string | null } | { status?: string | null }[] | null } | null; error: ErrLike }): { kind: ProfileFailureKind | 'ok'; code: string } {
  if (res.error) {
    const code = String(res.error.code ?? '')
    if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') return { kind: 'permission', code }
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST200' || code === '42703') return { kind: 'db_setup', code }
    return { kind: 'profile_error', code: code || 'unknown' }
  }
  if (!res.data) return { kind: 'no_profile', code: 'no_row' }
  const seller = Array.isArray(res.data.seller) ? res.data.seller[0] : res.data.seller
  if (!res.data.is_active) return { kind: 'inactive', code: 'user_inactive' }
  if (seller?.status !== 'active') return { kind: 'seller_inactive', code: 'seller_' + String(seller?.status ?? 'unknown') }
  return { kind: 'ok', code: '' }
}

/** 환경변수 점검. 값 자체는 돌려주지 않고 종류만 돌려줍니다. */
export function checkSupabaseEnv(url: string | undefined, key: string | undefined): ConfigFailureKind | null {
  if (!url || !url.trim()) return 'env_missing_url'
  if (!key || !key.trim()) return 'env_missing_key'
  try { const u = new URL(url.trim()); if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return 'env_bad_url' } catch { return 'env_bad_url' }
  return null
}

/** 개발 중에만 오류 '코드'를 콘솔에 남깁니다(메시지·이메일·토큰은 남기지 않음). */
export function logAuthCode(scope: string, code: string) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return
  console.warn(`[seller-auth] ${scope}: ${code}`)
}
