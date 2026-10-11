import { appendFileSync, writeFileSync } from 'node:fs';

export class TextLogger {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    writeFileSync(this.filePath, `# baud text log - started ${new Date().toISOString()}\n\n`);
  }

  logRecv(text: string): void {
    appendFileSync(this.filePath, `${text}\n`);
  }

  logSend(text: string): void {
    appendFileSync(this.filePath, `> ${text}\n`);
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
    appendFileSync(this.filePath, `$ ${text}\n`);
  }
}
