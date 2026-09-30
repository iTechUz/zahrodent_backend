import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';

type Entry = {
  timestamp: string;
  level: LogLevel;
  context?: string;
  requestId?: string;
  message: unknown;
  stack?: string;
  pid: number;
};

/**
 * LOG_FORMAT=json|text; default — json in production, text otherwise.
 */
export function useJsonLogs(env: NodeJS.ProcessEnv = process.env): boolean {
  const f = env.LOG_FORMAT?.trim().toLowerCase();
  if (f === 'json') return true;
  if (f === 'text') return false;
  return env.NODE_ENV === 'production';
}

function toSerializable(message: unknown): unknown {
  if (message instanceof Error) return message.message;
  if (typeof message === 'function') return message.name || String(message);
  return message;
}

/**
 * Nest logger that adds the current request id to every line.
 * - text: `[Nest] … LOG [Context] [req:<id>] message` (dev friendly)
 * - json: one JSON object per line — timestamp, level, context, requestId,
 *   message (+ stack for errors), pid — for log collectors.
 */
export class AppLogger extends ConsoleLogger {
  private pendingErrors: Entry[] = [];

  constructor(
    private readonly json: boolean,
    logLevels?: LogLevel[],
  ) {
    super();
    if (logLevels) this.setLogLevels(logLevels);
  }

  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ): void {
    const requestId = getRequestId();
    if (!this.json) {
      const prefixed = requestId
        ? messages.map((m) =>
            typeof m === 'string' ? `[req:${requestId}] ${m}` : m,
          )
        : messages;
      super.printMessages(prefixed, context, logLevel, writeStreamType);
      return;
    }
    const entries: Entry[] = messages.map((m) => ({
      timestamp: new Date().toISOString(),
      level: logLevel,
      ...(context ? { context } : {}),
      ...(requestId ? { requestId } : {}),
      message: toSerializable(m),
      pid: process.pid,
    }));
    // error() prints messages, then the stack → merge them into one line.
    if (logLevel === 'error') {
      this.pendingErrors.push(...entries);
      return;
    }
    for (const e of entries) this.write(e, writeStreamType);
  }

  protected printStackTrace(stack: string): void {
    if (!this.json) {
      super.printStackTrace(stack);
      return;
    }
    const pending = this.pendingErrors;
    this.pendingErrors = [];
    if (!pending.length && stack) {
      this.write(
        {
          timestamp: new Date().toISOString(),
          level: 'error',
          message: stack.split('\n')[0],
          stack,
          pid: process.pid,
        },
        'stderr',
      );
      return;
    }
    for (const e of pending) {
      this.write(stack ? { ...e, stack } : e, 'stderr');
    }
  }

  private write(entry: Entry, stream: 'stdout' | 'stderr' = 'stdout') {
    let line: string;
    try {
      line = JSON.stringify(entry, (_k, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      );
    } catch {
      line = JSON.stringify({ ...entry, message: String(entry.message) });
    }
    process[stream].write(`${line}\n`);
  }
}
