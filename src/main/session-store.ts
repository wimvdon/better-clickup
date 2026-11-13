import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { EMPTY_SESSION, parseSession, type SessionFile } from '../shared/session-file';

/**
 * Keeps session.json (open tabs, window size, settings) in the app's data folder.
 * Writes are bundled (at most once a second) and atomic, so a crash never leaves half a file.
 */
export class SessionStore {
  private data: SessionFile;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string) {
    try {
      this.data = parseSession(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      // First start, or an unreadable file: start fresh.
      this.data = EMPTY_SESSION;
    }
  }

  get(): SessionFile {
    return this.data;
  }

  update(patch: Partial<SessionFile>): void {
    this.data = { ...this.data, ...patch };
    this.timer ??= setTimeout(() => this.flush(), 1000);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data, null, 2));
      renameSync(`${this.file}.tmp`, this.file);
    } catch (error) {
      console.warn('Could not save the session:', error instanceof Error ? error.message : error);
    }
  }
}
