import { AsyncLocalStorage } from 'async_hooks';

type RequestContext = { requestId: string };

/** Per-request context (request id) visible to every log call in it. */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
