import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { PageMeta } from '../dto/paginated.dto.js';

export interface ApiResponse<T> {
  data: T;
  meta?: PageMeta;
}

interface PaginatedPayload {
  items: unknown[];
  meta: PageMeta;
}

const isPaginatedPayload = (value: unknown): value is PaginatedPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PaginatedPayload>;
  return Array.isArray(candidate.items) && typeof candidate.meta === 'object' && candidate.meta !== null;
};

/**
 * 统一成功响应结构：
 * - 普通数据：{ data }
 * - 分页数据：{ data: items, meta }
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((payload: unknown) => {
        if (isPaginatedPayload(payload)) {
          return { data: payload.items, meta: payload.meta };
        }

        return { data: payload };
      }),
    );
  }
}
