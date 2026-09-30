import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContext } from '../logging/request-context';

/** Accepted incoming X-Request-Id (anything else → a fresh UUID). */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Sets `req.requestId` (from X-Request-Id or a new UUID), echoes it in the
 * response header and runs the rest of the request inside a context so
 * every log line and error response carries it.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const fromHeader = req.header('x-request-id')?.trim();
  const requestId =
    fromHeader && SAFE_REQUEST_ID.test(fromHeader) ? fromHeader : randomUUID();

  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId }, () => next());
}
