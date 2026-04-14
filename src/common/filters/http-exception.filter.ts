import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const httpResponse = isHttp ? exception.getResponse() : null;
    const message =
      typeof httpResponse === 'string'
        ? httpResponse
        : (httpResponse as { message?: string | string[] })?.message;

    const body = {
      statusCode: status,
      path: req.url,
      timestamp: new Date().toISOString(),
      message: Array.isArray(message)
        ? message.join('; ')
        : message || 'Internal server error',
    };

    if (!isHttp) {
      this.logger.error(exception);
    }

    res.status(status).json(body);
  }
}
