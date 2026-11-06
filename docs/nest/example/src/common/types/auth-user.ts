import type { Role } from '../enums.js';

/**
 * 通过 JWT 认证后挂在 request.user 上的用户信息。
 * 不要在这里放 passwordHash 等敏感字段。
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** JWT 载荷。access / refresh 通过 type 区分，避免 refresh token 被当访问令牌使用。 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
}
