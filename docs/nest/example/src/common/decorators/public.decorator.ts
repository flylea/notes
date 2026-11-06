import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** 标记路由无需 JWT（注册、登录、刷新、健康检查等）。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
