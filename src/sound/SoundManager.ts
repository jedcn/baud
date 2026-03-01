import fs from 'node:fs';

export interface SoundInfo {
  name: string;
  filepath: string;
}

export interface PlaySoundOptions {
  volume?: number;
}

export interface SayOptions {
  voice?: string;
  rate?: number;
}

export class SoundManager {
  private sounds: Map<string, string> = new Map();

  registerSound(name: string, filepath: string): void {
    this.sounds.set(name, filepath);
  }

  removeSound(name: string): boolean {
    return this.sounds.delete(name);
  }

  playSound(name: string, options?: PlaySoundOptions): void {
    const filepath = this.sounds.get(name);
    if (!filepath) {
      throw new Error(`Sound not registered: ${name}`);
    }
    if (!fs.existsSync(filepath)) {
      throw new Error(`Sound file not found: ${filepath}`);
    }

    const args = [filepath];
    if (options?.volume !== undefined) {
      args.push('--volume', String(options.volume));
    }

    Bun.spawn(['afplay', ...args], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  }

  say(text: string, options?: SayOptions): void {
    const args = [text];
    if (options?.voice) {
      args.push('-v', options.voice);
    }
    if (options?.rate !== undefined) {
      args.push('-r', String(options.rate));
    }

    Bun.spawn(['say', ...args], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  }

  getSounds(): SoundInfo[] {
    return Array.from(this.sounds.entries()).map(([name, filepath]) => ({
      name,
      filepath,
    }));
  }

  clearSounds(): void {
    this.sounds.clear();
  }
}
