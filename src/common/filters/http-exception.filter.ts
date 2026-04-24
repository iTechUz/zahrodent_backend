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

    const responseBody = isHttp ? exception.getResponse() : null;
    
    // Extracting message more robustly (especially for Validation errors)
    let message = 'Internal server error';
    if (typeof responseBody === 'string') {
      message = responseBody;
    } else if (responseBody && typeof responseBody === 'object') {
      const msgRaw = (responseBody as any).message;
      message = Array.isArray(msgRaw) ? msgRaw.join('; ') : msgRaw || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body = {
      success: false,
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} - Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} - ${status}: ${message}`);
    }

    res.status(status).json(body);
  }
}
