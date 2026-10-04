// Pure PII scrubbers for crash/error reporting. No React/RN imports.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /Bearer\s+[\w.~+/=-]+/gi;

export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

export function redactText(text: string): string {
  return text.replace(JWT, '[token]').replace(BEARER, 'Bearer [token]').replace(EMAIL, '[email]');
}

type Breadcrumb = { category?: string; message?: string; data?: Record<string, unknown> };

export function scrubBreadcrumb<T extends Breadcrumb>(b: T): T | null {
  if (b.category === 'console') return null;
  const out: T = { ...b };
  if (out.message) out.message = redactText(out.message);
  if (out.data) {
    const data: Record<string, unknown> = { ...out.data };
    for (const k of ['url', 'to', 'from']) {
      const v = data[k];
      if (typeof v === 'string') data[k] = stripQuery(v);
    }
    out.data = data;
  }
  return out;
}

type EventLike = {
  user?: { id?: string | number | undefined };
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: { url?: string; cookies?: unknown; query_string?: unknown };
  breadcrumbs?: Breadcrumb[];
};

export function scrubEvent<T extends EventLike>(event: T): T {
  const out: T = { ...event };
  if (out.user) out.user = out.user.id === undefined ? {} : { id: out.user.id };
  if (out.message) out.message = redactText(out.message);
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) =>
        v.value === undefined ? v : { ...v, value: redactText(v.value) },
      ),
    };
  }
  if (out.request) {
    const { cookies: _cookies, query_string: _query, ...rest } = out.request;
    out.request = rest;
    if (typeof out.request.url === 'string') out.request.url = stripQuery(out.request.url);
  }
  if (out.breadcrumbs) {
    out.breadcrumbs = out.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter((b): b is Breadcrumb => b !== null);
  }
  return out;
}
