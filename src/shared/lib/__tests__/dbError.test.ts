import { dbErrorToApiError } from '@/shared/lib/dbError';

it('maps PostgREST failures to the api taxonomy', () => {
  expect(dbErrorToApiError({ status: 401 })).toEqual({ kind: 'forbidden' });
  expect(dbErrorToApiError({ status: 403 })).toEqual({ kind: 'forbidden' });
  expect(dbErrorToApiError({ status: 503 })).toEqual({ kind: 'unavailable', status: 503 });
  expect(dbErrorToApiError({ status: 0 })).toEqual({ kind: 'network' });
  expect(dbErrorToApiError({})).toEqual({ kind: 'network' });
  expect(dbErrorToApiError({ status: 400 })).toEqual({ kind: 'unknown', status: 400 });
});
