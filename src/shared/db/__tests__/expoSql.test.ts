import { isWrongKey, SQLCIPHER_MISSING } from '@/shared/db/expoSql';

jest.mock('expo-sqlite', () => ({}));

describe('isWrongKey', () => {
  it('matches a wrong key, never a build without SQLCipher (that file must not be deleted)', () => {
    expect(isWrongKey(new Error('file is not a database'))).toBe(true);
    expect(isWrongKey(new Error(SQLCIPHER_MISSING))).toBe(false);
  });
});
