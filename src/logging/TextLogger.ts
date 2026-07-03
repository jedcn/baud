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
}
