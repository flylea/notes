import { z } from 'zod';
import { paginationSchema } from '../../../common/dto/pagination.schema.js';
import { Role } from '../../../common/enums.js';

export const queryUsersSchema = paginationSchema.extend({
  role: z.enum(Role).optional(),
  keyword: z.string().max(50).optional(),
});

export type QueryUsersInput = z.infer<typeof queryUsersSchema>;
