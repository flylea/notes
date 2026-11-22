import { z } from 'zod';
import { Role } from '../../../common/enums.js';
import { updateProfileSchema } from './update-profile.schema.js';

/** 管理员更新用户时比本人多一个 role 字段。 */
export const updateUserSchema = updateProfileSchema.extend({
  role: z.enum(Role).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
