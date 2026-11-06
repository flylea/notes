import { SetMetadata } from '@nestjs/common';
import type { Role } from '../enums.js';

export const ROLES_KEY = 'roles';

/** 标记路由需要的角色，配合全局 RolesGuard 使用。 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
