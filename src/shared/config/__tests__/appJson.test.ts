// No Node types in this project: read the file through Jest's own module loader.
const fs = jest.requireActual<{ readFileSync(path: string, enc: 'utf8'): string }>('fs');
const cwd = jest.requireActual<{ cwd(): string }>('process').cwd();

// Security review 7 (B4): checkout entries and other plain storage never go to a Google Drive
// backup. `android.allowBackup` is the SDK 57 app config key; Android defaults it to true.
describe('app.json', () => {
  it('turns Android auto backup off', () => {
    const raw = fs.readFileSync(`${cwd}/app.json`, 'utf8');
    const config = JSON.parse(raw) as { expo: { android: { allowBackup?: unknown } } };
    expect(config.expo.android.allowBackup).toBe(false);
  });
});
