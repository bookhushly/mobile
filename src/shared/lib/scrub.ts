// Pure PII scrubbers for crash/error reporting. No React/RN imports.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /Bearer\s+[\w.~+/=-]+/gi;
// Ticket codes and ids identify a guest's ticket: never let them reach a report.
const TICKET_CODE = /BH[12]\.[A-Za-z0-9._~-]+/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// A payment reference (in GET /api/payment/status/<ref>) is enough to read that payment back.
const PAYMENT_STATUS_REF = /(\/api\/payment\/status\/)[^/?#\s]+/gi;
/** Data keys holding a payment reference (verify / check-status bodies, our own breadcrumbs). */
const REFERENCE_KEYS: ReadonlySet<string> = new Set(['reference', 'payment_reference']);

export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

// A whole path segment of 8 hex chars is a front-desk check-in code ([0-9A-F]{8} superset).
const CHECK_IN_SEGMENT = /\/[0-9A-F]{8}(?=\/|$)/gi;

export function redactText(text: string): string {
  return text
    .replace(PAYMENT_STATUS_REF, '$1[ref]')
    .replace(TICKET_CODE, '[code]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]');
}

/** For urls and paths: no query or fragment; ids, ticket codes and check-in codes masked. */
export function redactUrl(url: string): string {
  return redactText(stripQuery(url)).replace(CHECK_IN_SEGMENT, '/[code]');
}

type Breadcrumb = { category?: string; message?: string; data?: Record<string, unknown> };

// Dropped whole: console output, and touch breadcrumbs (they carry accessibility labels, which
// can be guest names on the front desk).
const DROPPED = new Set(['console', 'touch']);

export function scrubBreadcrumb<T extends Breadcrumb>(b: T): T | null {
  if (b.category !== undefined && DROPPED.has(b.category)) return null;
  const out: T = { ...b };
  if (out.message) out.message = redactText(out.message);
  if (out.data) {
    const data: Record<string, unknown> = { ...out.data };
    for (const k of ['url', 'to', 'from']) {
      const v = data[k];
      if (typeof v === 'string') data[k] = redactUrl(v);
    }
    for (const k of Object.keys(data)) if (REFERENCE_KEYS.has(k)) data[k] = '[ref]';
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
    if (typeof out.request.url === 'string') out.request.url = redactUrl(out.request.url);
  }
  if (out.breadcrumbs) {
    out.breadcrumbs = out.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter((b): b is Breadcrumb => b !== null);
  }
  return out;
}

type Span = { description?: string; data?: Record<string, unknown> };
type TransactionLike = EventLike & { transaction?: string; spans?: Span[] };

const SPAN_URL_KEYS = ['url', 'http.url', 'url.full'];
const SPAN_DROPPED_KEYS = ['http.query', 'http.fragment', 'url.query'];

// Performance data carries request urls in span descriptions and data (e.g. a ticket's id in
// /api/tickets/<id>/code): the same masking as breadcrumbs.
function scrubSpan<S extends Span>(span: S): S {
  const out: S = { ...span };
  if (typeof out.description === 'string') out.description = redactUrl(out.description);
  if (out.data) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.data)) {
      if (SPAN_DROPPED_KEYS.includes(k)) continue;
      if (REFERENCE_KEYS.has(k)) data[k] = '[ref]';
      else data[k] = SPAN_URL_KEYS.includes(k) && typeof v === 'string' ? redactUrl(v) : v;
    }
    out.data = data;
  }
  return out;
}

export function scrubTransaction<T extends TransactionLike>(event: T): T {
  const out: T = scrubEvent(event);
  if (typeof out.transaction === 'string') out.transaction = redactUrl(out.transaction);
  if (out.spans) out.spans = out.spans.map((s) => scrubSpan(s));
  return out;
}
