import { parseLookup } from '@/features/gate/domain/lookupQuery';

describe('parseLookup', () => {
  it.each([
    ['21', { kind: 'phoneTail', value: '21' }],
    ['210', { kind: 'phoneTail', value: '210' }],
    [' 0803 ', { kind: 'phoneHead', value: '0803' }],
    ['ada', { kind: 'name', value: 'ada' }],
    ['  Ada Obi ', { kind: 'name', value: 'Ada Obi' }],
    ['Ọlá', { kind: 'name', value: 'Ọlá' }],
  ] as const)('%s', (input, out) => {
    expect(parseLookup(input)).toEqual(out);
  });
  it.each(['', '1', 'a', '12345', '08031234567', '%%'])('ignores %j', (input) => {
    expect(parseLookup(input)).toBeNull();
  });
});
