import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';

const U = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('parseTicketCode', () => {
  it('accepts a bare uuid as a static code', () => {
    expect(parseTicketCode(U)).toEqual({ kind: 'static', value: U });
  });
  it('extracts the uuid from a printed-ticket url', () => {
    expect(parseTicketCode(`https://bookhushly.com/t/${U}?ref=pdf`)).toEqual({
      kind: 'static',
      value: U,
    });
  });
  it('lower-cases a static uuid so typed and scanned forms match', () => {
    expect(parseTicketCode(U.toUpperCase())?.value).toBe(U);
  });
  it('trims whitespace and newlines', () => {
    expect(parseTicketCode(`  ${U}\n`)?.value).toBe(U);
  });
  it('takes the first uuid when there are several', () => {
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(parseTicketCode(`${U} ${other}`)?.value).toBe(U);
  });
  it('passes BH1 and BH2 rotating codes through untouched', () => {
    const bh2 = `BH2.k1.AAAAAAAAAAAAAAAAAAAAAA.1a2b.${'x'.repeat(86)}`;
    expect(parseTicketCode(` ${bh2} `)).toEqual({ kind: 'rotating', value: bh2 });
    expect(parseTicketCode(`BH1.${U}.abc`)).toEqual({ kind: 'rotating', value: `BH1.${U}.abc` });
  });
  it('does not treat a lower-case prefix as rotating', () => {
    expect(parseTicketCode('bh2.k1.zzz')).toBeNull();
  });
  it('rejects empty, junk and over-long input', () => {
    expect(parseTicketCode('')).toBeNull();
    expect(parseTicketCode('   ')).toBeNull();
    expect(parseTicketCode('WIFI:S:cafe;T:WPA;P:secret;;')).toBeNull();
    expect(parseTicketCode(`BH2.${'a'.repeat(400)}`)).toBeNull();
  });
});
