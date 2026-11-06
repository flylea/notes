import type { Request } from 'express';

/** 请求经过 requestIdMiddleware 后一定带有 id。 */
export interface RequestWithId extends Request {
  id: string;
}
