import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithId } from '../types/request-with-id.js';

/**
 * 为每个请求生成 requestId：
 * - 优先复用客户端传入的 x-request-id（限制长度，避免日志注入）
 * - 写回响应头，便于前端/网关串联日志
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();

  (req as RequestWithId).id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};
