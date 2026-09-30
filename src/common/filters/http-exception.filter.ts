import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { getRequestId } from '../logging/request-context';

export const INTERNAL_ERROR_MESSAGE =
  "Serverda ichki xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring";

/** Known Prisma request errors → client-safe HTTP status + Uzbek message. */
function mapPrismaError(
  e: Prisma.PrismaClientKnownRequestError,
  method: string,
): { status: number; message: string } | null {
  switch (e.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        message: 'Bunday qiymatli yozuv allaqachon mavjud',
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        message: "So'ralgan yoki bog'langan yozuv topilmadi",
      };
    case 'P2003':
      // Deleting a row that is still referenced → conflict; writing a
      // reference to a missing row → bad request.
      return method === 'DELETE'
        ? {
            status: HttpStatus.CONFLICT,
            message:
              "Yozuvni o'chirib bo'lmaydi: unga bog'langan boshqa yozuvlar mavjud",
          }
        : {
            status: HttpStatus.BAD_REQUEST,
            message: "Bog'langan yozuv (id) mavjud emas",
          };
    case 'P2034':
      return {
        status: HttpStatus.CONFLICT,
        message: "Parallel o'zgarish aniqlandi — qayta urinib ko'ring",
      };
    default:
      return null;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = INTERNAL_ERROR_MESSAGE;
    // What we log — may contain internals, never sent to the client.
    let logDetail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (responseBody && typeof responseBody === 'object') {
        const msgRaw = (responseBody as { message?: unknown }).message;
        message = Array.isArray(msgRaw)
          ? msgRaw.join('; ')
          : typeof msgRaw === 'string' && msgRaw
            ? msgRaw
            : 'Internal server error';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception, req.method);
      if (mapped) {
        status = mapped.status;
        message = mapped.message;
      }
      logDetail = `Prisma ${exception.code}: ${exception.message}`;
    } else if (exception instanceof Error) {
      logDetail = exception.message;
    }

    const requestId =
      (req as Request & { requestId?: string }).requestId ?? getRequestId();
    const body = {
      success: false,
      statusCode: status,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    };

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} - Error: ${logDetail ?? message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${req.method} ${req.url} - ${status}: ${message}${logDetail ? ` (${logDetail.split('\n').pop()?.trim()})` : ''}`,
      );
    }

    res.status(status).json(body);
  }
}
