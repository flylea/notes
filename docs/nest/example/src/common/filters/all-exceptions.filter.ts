import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';
import type { RequestWithId } from '../types/request-with-id.js';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 全局异常过滤器：把 HttpException、DTO 校验错误和未知异常
 * 统一成 { statusCode, message, error, requestId }。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const statusText = STATUS_CODES[status] ?? 'Error';
    let message: string | string[] = statusText;
    let error = statusText;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (isRecord(exceptionResponse)) {
        const bodyMessage = exceptionResponse.message;
        if (typeof bodyMessage === 'string' || Array.isArray(bodyMessage)) {
          message = bodyMessage as string | string[];
        }
        if (typeof exceptionResponse.error === 'string') {
          error = exceptionResponse.error;
        }
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.originalUrl} -> ${status}`, stack);
      // 不把内部错误细节返回给客户端。
      message = statusText;
      error = statusText;
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      requestId: request.id ?? 'unknown',
    };

    response.status(status).json(body);
  }
}
