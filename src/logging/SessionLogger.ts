import { writeFileSync, appendFileSync } from 'fs';

export class SessionLogger {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    writeFileSync(this.filePath, `# baud session log - started ${new Date().toISOString()}\n\n`);
  }

  logRecv(buffer: Buffer): void {
    this.writeEntry('RECV', buffer);
  }

  logSend(data: string): void {
    const buffer = Buffer.from(data);
    this.writeEntry('SEND', buffer);
  }

  private writeEntry(direction: string, buffer: Buffer): void {
    const timestamp = new Date().toISOString();
    const lines = formatHexDump(buffer);
    const entry = `[${timestamp}] ${direction} (${buffer.length} bytes)\n${lines}\n`;
    appendFileSync(this.filePath, entry);
  }
}

export function formatHexDump(buffer: Buffer): string {
  const lines: string[] = [];
  for (let offset = 0; offset < buffer.length; offset += 16) {
    const slice = buffer.subarray(offset, Math.min(offset + 16, buffer.length));

    const hexParts: string[] = [];
    for (let i = 0; i < 16; i++) {
      if (i < slice.length) {
        hexParts.push(slice[i].toString(16).padStart(2, '0'));
      } else {
        hexParts.push('  ');
      }
    }
    const hex = hexParts.join(' ');

    const ascii = Array.from(slice)
      .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('');

    lines.push(`  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
}
