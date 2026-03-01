import { describe, expect, it, beforeEach, mock, spyOn } from 'bun:test';
import fs from 'node:fs';
import { SoundManager } from './SoundManager.js';

describe('SoundManager', () => {
  let manager: SoundManager;

  beforeEach(() => {
    manager = new SoundManager();
  });

  describe('registerSound', () => {
    it('registers a sound by name', () => {
      manager.registerSound('alert', '/path/to/alert.aiff');
      const sounds = manager.getSounds();
      expect(sounds).toEqual([{ name: 'alert', filepath: '/path/to/alert.aiff' }]);
    });

    it('overwrites an existing sound with the same name', () => {
      manager.registerSound('alert', '/path/one.aiff');
      manager.registerSound('alert', '/path/two.aiff');
      const sounds = manager.getSounds();
      expect(sounds).toEqual([{ name: 'alert', filepath: '/path/two.aiff' }]);
    });
  });

  describe('removeSound', () => {
    it('returns true when removing an existing sound', () => {
      manager.registerSound('alert', '/path/to/alert.aiff');
      expect(manager.removeSound('alert')).toBe(true);
      expect(manager.getSounds()).toEqual([]);
    });

    it('returns false when removing a nonexistent sound', () => {
      expect(manager.removeSound('nope')).toBe(false);
    });
  });

  describe('getSounds', () => {
    it('returns all registered sounds', () => {
      manager.registerSound('a', '/a.aiff');
      manager.registerSound('b', '/b.wav');
      const sounds = manager.getSounds();
      expect(sounds).toHaveLength(2);
      expect(sounds).toContainEqual({ name: 'a', filepath: '/a.aiff' });
      expect(sounds).toContainEqual({ name: 'b', filepath: '/b.wav' });
    });

    it('returns empty array when no sounds registered', () => {
      expect(manager.getSounds()).toEqual([]);
    });
  });

  describe('clearSounds', () => {
    it('removes all registered sounds', () => {
      manager.registerSound('a', '/a.aiff');
      manager.registerSound('b', '/b.wav');
      manager.clearSounds();
      expect(manager.getSounds()).toEqual([]);
    });
  });

  describe('playSound', () => {
    it('throws when sound name is not registered', () => {
      expect(() => manager.playSound('nope')).toThrow('Sound not registered: nope');
    });

    it('throws when sound file does not exist', () => {
      const existsSpy = spyOn(fs, 'existsSync').mockReturnValue(false);
      manager.registerSound('alert', '/nonexistent/sound.aiff');
      expect(() => manager.playSound('alert')).toThrow('Sound file not found: /nonexistent/sound.aiff');
      existsSpy.mockRestore();
    });

    it('spawns afplay with the correct filepath', () => {
      const existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
      const spawnSpy = spyOn(Bun, 'spawn').mockReturnValue({} as any);

      manager.registerSound('alert', '/System/Library/Sounds/Glass.aiff');
      manager.playSound('alert');

      expect(spawnSpy).toHaveBeenCalledWith(
        ['afplay', '/System/Library/Sounds/Glass.aiff'],
        { stdout: 'ignore', stderr: 'ignore' },
      );

      existsSpy.mockRestore();
      spawnSpy.mockRestore();
    });

    it('passes volume option to afplay', () => {
      const existsSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
      const spawnSpy = spyOn(Bun, 'spawn').mockReturnValue({} as any);

      manager.registerSound('alert', '/sound.aiff');
      manager.playSound('alert', { volume: 0.5 });

      expect(spawnSpy).toHaveBeenCalledWith(
        ['afplay', '/sound.aiff', '--volume', '0.5'],
        { stdout: 'ignore', stderr: 'ignore' },
      );

      existsSpy.mockRestore();
      spawnSpy.mockRestore();
    });
  });

  describe('say', () => {
    it('spawns say with the text', () => {
      const spawnSpy = spyOn(Bun, 'spawn').mockReturnValue({} as any);

      manager.say('hello world');

      expect(spawnSpy).toHaveBeenCalledWith(
        ['say', 'hello world'],
        { stdout: 'ignore', stderr: 'ignore' },
      );

      spawnSpy.mockRestore();
    });

    it('passes voice option', () => {
      const spawnSpy = spyOn(Bun, 'spawn').mockReturnValue({} as any);

      manager.say('hello', { voice: 'Samantha' });

      expect(spawnSpy).toHaveBeenCalledWith(
        ['say', 'hello', '-v', 'Samantha'],
        { stdout: 'ignore', stderr: 'ignore' },
      );

      spawnSpy.mockRestore();
    });

    it('passes rate option', () => {
      const spawnSpy = spyOn(Bun, 'spawn').mockReturnValue({} as any);

      manager.say('hello', { rate: 300 });

      expect(spawnSpy).toHaveBeenCalledWith(
        ['say', 'hello', '-r', '300'],
        { stdout: 'ignore', stderr: 'ignore' },
      );

      spawnSpy.mockRestore();
    });

    it('passes both voice and rate options', () => {
      const spawnSpy = spyOn(Bun, 'spawn').mockReturnValue({} as any);

      manager.say('hello', { voice: 'Daniel', rate: 120 });

      expect(spawnSpy).toHaveBeenCalledWith(
        ['say', 'hello', '-v', 'Daniel', '-r', '120'],
        { stdout: 'ignore', stderr: 'ignore' },
      );

      spawnSpy.mockRestore();
    });
  });
});
