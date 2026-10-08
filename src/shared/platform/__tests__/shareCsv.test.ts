import { ACTIVITY_FILE, deleteSharedCsv, shareCsv } from '@/shared/platform/shareCsv';

const mockFs = { exists: false, written: [] as string[], deleted: 0 };
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache' },
  File: class {
    uri: string;
    constructor(_dir: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    get exists() {
      return mockFs.exists;
    }
    write(text: string) {
      mockFs.written.push(text);
    }
    delete() {
      mockFs.deleted += 1;
    }
  },
}));
const mockSharing = { available: true, shareAsync: jest.fn(() => Promise.resolve()) };
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => Promise.resolve(mockSharing.available),
  shareAsync: (...a: unknown[]) => mockSharing.shareAsync(...(a as [])),
}));

beforeEach(() => {
  mockFs.exists = false;
  mockFs.written = [];
  mockFs.deleted = 0;
  mockSharing.available = true;
  mockSharing.shareAsync.mockClear();
});

it('writes the file and opens the share sheet as CSV', async () => {
  await shareCsv(ACTIVITY_FILE, 'a,b\r\n');
  expect(mockFs.written).toEqual(['a,b\r\n']);
  expect(mockSharing.shareAsync).toHaveBeenCalledWith(
    'file:///cache/bookhushly-scan-activity.csv',
    expect.objectContaining({ mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' }),
  );
});

it('removes the previous export first', async () => {
  mockFs.exists = true;
  await shareCsv(ACTIVITY_FILE, 'x');
  expect(mockFs.deleted).toBe(1);
});

it('rejects when sharing is unavailable', async () => {
  mockSharing.available = false;
  await expect(shareCsv(ACTIVITY_FILE, 'x')).rejects.toThrow('sharing unavailable');
  expect(mockSharing.shareAsync).not.toHaveBeenCalled();
});

it('the wipe deletes a leftover export and never throws', () => {
  mockFs.exists = true;
  deleteSharedCsv(ACTIVITY_FILE);
  expect(mockFs.deleted).toBe(1);
  mockFs.exists = false;
  deleteSharedCsv(ACTIVITY_FILE);
  expect(mockFs.deleted).toBe(1);
});
