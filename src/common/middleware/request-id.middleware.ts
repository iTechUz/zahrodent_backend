import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const fromHeader = req.header('x-request-id')?.trim();
  const requestId =
    fromHeader && fromHeader.length <= 128 ? fromHeader : randomUUID();

  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
