import { handleApi } from './api';
import { handleAuth } from './auth';
import { parseQuery, run, tables, type Row } from './db';
import { bodyOf, headerOf, json, noContent, type Handled } from './respond';
import { uid } from './time';

const LATENCY_MS = 350;

// PostgREST over the in-memory tables: select (with count and single), update, upsert, delete.
async function handleRest(
  table: string,
  params: URLSearchParams,
  init?: RequestInit,
): Promise<Handled> {
  const rows = tables[table];
  if (rows === undefined) return json({ code: '42P01', message: `sample: no table ${table}` }, 404);
  const method = (init?.method ?? 'GET').toUpperCase();
  const q = parseQuery(params);
  const prefer = headerOf(init, 'Prefer') ?? '';
  if (method === 'GET' || method === 'HEAD') {
    const found = run(rows, q);
    const range = {
      'Content-Range': `0-${String(Math.max(0, found.length - 1))}/${String(found.length)}`,
    };
    if (method === 'HEAD') return new Response(null, { status: 200, headers: range });
    if ((headerOf(init, 'Accept') ?? '').includes('vnd.pgrst.object')) {
      const one = found[0];
      return one === undefined ? json({ code: 'PGRST116', message: 'no rows' }, 406) : json(one);
    }
    return json(found, 200, range);
  }
  if (method === 'PATCH') {
    const patch = await bodyOf(init);
    const hit = run(rows, { ...q, limit: null });
    for (const r of hit) Object.assign(r, patch);
    return json(hit);
  }
  if (method === 'DELETE') {
    const hit = run(rows, { ...q, limit: null });
    tables[table] = rows.filter((r) => !hit.includes(r));
    return json(hit);
  }
  if (method === 'POST') {
    const raw: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const incoming = (Array.isArray(raw) ? raw : [raw]) as Row[];
    const keys = (params.get('on_conflict') ?? '').split(',').filter(Boolean);
    const out: Row[] = [];
    for (const row of incoming) {
      const same =
        keys.length > 0 ? rows.find((r) => keys.every((k) => r[k] === row[k])) : undefined;
      if (same !== undefined && prefer.includes('merge-duplicates')) {
        Object.assign(same, row);
        out.push(same);
      } else {
        const added = {
          id: uid(Math.floor(Math.random() * 1e9)),
          created_at: new Date().toISOString(),
          ...row,
        };
        rows.unshift(added);
        out.push(added);
      }
    }
    return json(out, 201);
  }
  return null;
}

/**
 * Dev only. Replaces `fetch` so the whole app runs on sample data: Supabase Auth, the database
 * reads and writes, and the web API all answer from memory. Nothing reaches a server.
 */
export function installSampleBackend(supabaseUrl: string, apiBaseUrl: string): void {
  const realFetch = globalThis.fetch;
  // Origins, not the raw strings: a trailing slash, a path or a capital in the env value must
  // never let a call slip past to the real servers (security review, 2026-11-17).
  const supabase = new URL(supabaseUrl).origin;
  const api = new URL(apiBaseUrl).origin;
  const sampleFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const base = url.origin;
    let res: Handled = null;
    if (base === supabase && url.pathname.startsWith('/rest/v1/'))
      res = await handleRest(url.pathname.slice('/rest/v1/'.length), url.searchParams, init);
    else if (base === supabase && url.pathname.startsWith('/auth/v1/'))
      res = await handleAuth(url.pathname.slice('/auth/v1'.length), url.searchParams, init);
    else if (base === supabase) res = noContent();
    else if (base === api) {
      res = await handleApi(url.pathname, url.searchParams, init);
      if (res === null) {
        // eslint-disable-next-line no-console -- dev-only tool: names the endpoint that needs a sample.
        console.warn(`[sample] no sample answer for ${init?.method ?? 'GET'} ${url.pathname}`);
        res = json({ error: 'not_found' }, 404);
      }
    } else return realFetch(input, init);
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    return res ?? json({ error: 'not_found' }, 404);
  };
  globalThis.fetch = sampleFetch;
}
