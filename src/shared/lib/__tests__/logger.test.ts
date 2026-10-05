import { createLogger, type LogLine } from '@/shared/lib/logger';

it('scrubs sensitive keys and drops debug in production', () => {
  const lines: LogLine[] = [];
  const log = createLogger((l) => lines.push(l), { production: true });
  log.debug('hidden', { a: 1 });
  log.info('signed in', {
    email: 'a@b.c',
    ticket_id: 'abc',
    access_token: 'tok',
    ok: 1,
    nested: { phone: '0803' },
  });
  expect(lines).toHaveLength(1);
  expect(lines[0]?.data).toEqual({
    email: '[redacted]',
    ticket_id: '[redacted]',
    access_token: '[redacted]',
    ok: 1,
    nested: { phone: '[redacted]' },
  });
});
