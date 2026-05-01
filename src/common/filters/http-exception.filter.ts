import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ichki server xatoligi yuz berdi';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (responseBody && typeof responseBody === 'object') {
        const msgRaw = (responseBody as any).message;
        message = Array.isArray(msgRaw) ? msgRaw.join('; ') : msgRaw || message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma known errors
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[]) || [];
          message = `Ushbu ma'lumot allaqachon mavjud: ${target.join(', ')}`;
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          message = "Bog'langan ma'lumot topilmadi (Foreign key constraint)";
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          message = "So'ralgan ma'lumot topilmadi";
          break;
        }
        default:
          message = `Baza xatoligi: ${exception.code}`;
      }
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
