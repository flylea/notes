import { z } from 'zod';

/**
 * 分页查询参数。
 *
 * `z.coerce` 负责把 query string 转成 number，`.default()` 负责补齐缺省值；
 * 因此 service 里可以直接使用 `query.page`，不需要再写 `?? 1`。
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const pageMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type PageMeta = z.infer<typeof pageMetaSchema>;

/** 分页响应形状：`ResponseInterceptor` 会把 `{ items, meta }` 摊平成 `{ data, meta }`。 */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: pageMetaSchema,
  });

/** 普通响应形状：`{ data: ... }`。 */
export const wrappedSchema = <T extends z.ZodType>(data: T) => z.object({ data });

export interface PaginatedResult<T> {
  items: T[];
  meta: PageMeta;
}

export const paginate = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> => ({
  items,
  meta: {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  },
});
