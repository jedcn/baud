import { appendFileSync, writeFileSync } from 'node:fs';

export class TextLogger {
  private filePath: string;
  private lastStamp = '';

  // The header names baud's version, when it is known, after the start time:
  // "# baud text log - started <iso> - baud 9d763ba". Readers take the first
  // word after "started" as the time, so the version doesn't disturb them.
  constructor(filePath: string, baudVersion?: string) {
    this.filePath = filePath;
    const version = baudVersion ? ` - baud ${baudVersion}` : '';
    writeFileSync(
      this.filePath,
      `# baud text log - started ${new Date().toISOString()}${version}\n\n`,
    );
  }

  logRecv(text: string): void {
    this.write(`${text}\n`);
  }

  logSend(text: string): void {
    this.write(`> ${text}\n`);
  }

  // A command an alias consumed, so it never reached the server and never got a
  // `> ` line. Without this a log cannot say whether a script was even running:
  // `map-area caves` leaves behind only its own echo output, so replaying a
  // session means guessing which aliases were invoked and when.
  //
  // Deliberately NOT the `> ` prefix. That one means "this went to the server",
  // and an alias is precisely the case where it did not -- anything reading the
  // log back needs to tell the two apart.
  logAlias(text: string): void {
    this.write(`$ ${text}\n`);
  }

  // A clock line ahead of the first entry of each second, so anything reading the
  // log back can time what happened without the script having to print the time.
  // Local time, like the game's own status bar. Only in the file: it never reaches
  // the screen or a trigger.
  private write(entry: string): void {
    const stamp = new Date().toTimeString().slice(0, 8);
    if (stamp === this.lastStamp) {
      appendFileSync(this.filePath, entry);
    } else {
      this.lastStamp = stamp;
      appendFileSync(this.filePath, `[T] ${stamp} tick\n${entry}`);
    }
  }
}
