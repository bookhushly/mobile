declare module 'node:sqlite' {
  type Value = string | number | null;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: Value[]): { changes: number | bigint };
      get(...params: Value[]): unknown;
      all(...params: Value[]): unknown[];
    };
  }
}
