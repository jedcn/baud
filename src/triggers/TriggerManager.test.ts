import { beforeEach, describe, expect, it } from 'bun:test';
import { TriggerManager } from './TriggerManager.js';

describe('TriggerManager', () => {
  let manager: TriggerManager;

  beforeEach(() => {
    manager = new TriggerManager();
  });

  describe('removeTrigger', () => {
    it('removes a trigger by id and returns true', () => {
      const id = manager.createTrigger('hello', () => {});
      expect(manager.getTriggers()).toHaveLength(1);

      expect(manager.removeTrigger(id)).toBe(true);
      expect(manager.getTriggers()).toHaveLength(0);
    });

    it('returns false for an unknown id', () => {
      manager.createTrigger('hello', () => {});
      expect(manager.removeTrigger('does-not-exist')).toBe(false);
      expect(manager.getTriggers()).toHaveLength(1);
    });

    it('only removes the targeted trigger, leaving others intact', () => {
      const keep = manager.createTrigger('keep', () => {});
      const drop = manager.createTrigger('drop', () => {});

      expect(manager.removeTrigger(drop)).toBe(true);

      const remaining = manager.getTriggers();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(keep);
    });

    it('stops a removed trigger from matching further lines', async () => {
      let hits = 0;
      const id = manager.createTrigger('ping', () => {
        hits += 1;
      });

      await manager.processLine('ping');
      expect(hits).toBe(1);

      manager.removeTrigger(id);
      await manager.processLine('ping');
      expect(hits).toBe(1);
    });

    it('supports one-shot triggers that remove themselves when they fire', async () => {
      let hits = 0;
      let id = '';
      id = manager.createTrigger('summoned', () => {
        hits += 1;
        manager.removeTrigger(id);
      });

      await manager.processLine('summoned');
      await manager.processLine('summoned');

      expect(hits).toBe(1);
      expect(manager.getTriggers()).toHaveLength(0);
    });
  });
});
