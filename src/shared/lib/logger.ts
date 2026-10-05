export type LogLine = {
  level: 'debug' | 'info' | 'warn' | 'error';
  msg: string;
  data?: Record<string, unknown>;
};
type Sink = (line: LogLine) => void;

const SENSITIVE = /(token|password|secret|email|phone|ticket|code|authorization|session|key)/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : scrub(v)]),
    );
  }
  return value;
}

export function createLogger(sink: Sink, opts: { production: boolean }) {
  const emit = (level: LogLine['level']) => (msg: string, data?: Record<string, unknown>) => {
    if (level === 'debug' && opts.production) return;
    sink(data ? { level, msg, data: scrub(data) as Record<string, unknown> } : { level, msg });
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
}
