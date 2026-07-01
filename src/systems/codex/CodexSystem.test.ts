import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodexSystem } from './CodexSystem';
import { SoulSystem } from '../soul/SoulSystem';
import { registry } from '../../engine/core/ServiceRegistry';
import { engineBus } from '../../engine/core/EventBus';
import type { CodexEntry } from './CodexSystem';

const makeEntry = (overrides: Partial<CodexEntry> = {}): CodexEntry => ({
  id: 'test_entry',
  title: 'Test Entry',
  category: 'concept',
  summary: 'A test.',
  fullContent: 'Longer test content.',
  iconPath: '',
  unlockCondition: [],
  relatedEntries: [],
  tags: [],
  isSecret: false,
  isNew: false,
  ...overrides,
});

describe('CodexSystem', () => {
  let codex: CodexSystem;
  let soul: SoulSystem;

  beforeEach(async () => {
    engineBus.removeAllListeners();
    registry.destroyAll();

    soul = new SoulSystem();
    await soul.init();
    await soul.start();
    registry.register('soul', soul);

    codex = new CodexSystem();
    await codex.init();
    await codex.start();
  });

  afterEach(() => { registry.destroyAll(); });

  // ---------------------------------------------------------------------------
  // Registration + unlock
  // ---------------------------------------------------------------------------

  describe('registerEntry / unlock', () => {
    it('stores an entry', () => {
      codex.registerEntry(makeEntry());
      expect(codex.getEntry('test_entry')?.title).toBe('Test Entry');
    });

    it('unlock marks entry unlocked and emits event', () => {
      codex.registerEntry(makeEntry());
      let unlocked: string | undefined;
      engineBus.on('codex:unlocked', ({ entryId }) => { unlocked = entryId; });
      codex.unlock('test_entry');
      expect(codex.isUnlocked('test_entry')).toBe(true);
      expect(unlocked).toBe('test_entry');
    });

    it('unlock is idempotent', () => {
      codex.registerEntry(makeEntry());
      let count = 0;
      engineBus.on('codex:unlocked', () => { count++; });
      codex.unlock('test_entry');
      codex.unlock('test_entry');
      expect(count).toBe(1);
    });

    it('unlock warns and does nothing for unknown id', () => {
      let fired = false;
      engineBus.on('codex:unlocked', () => { fired = true; });
      codex.unlock('nonexistent');
      expect(fired).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Automatic unlock via soul conditions
  // ---------------------------------------------------------------------------

  describe('auto-unlock on soul condition', () => {
    it('unlocks when a soul attribute crosses the required threshold', () => {
      codex.registerEntry(makeEntry({
        unlockCondition: [{ attribute: 'knowledge', operator: '>=', value: 50 }],
      }));
      soul.applyDelta({ knowledge: 30 }, 'test'); // 30 + 30 = 60
      expect(codex.isUnlocked('test_entry')).toBe(true);
    });

    it('does not unlock until threshold is crossed', () => {
      codex.registerEntry(makeEntry({
        unlockCondition: [{ attribute: 'knowledge', operator: '>=', value: 50 }],
      }));
      soul.applyDelta({ knowledge: 10 }, 'test'); // 30 + 10 = 40
      expect(codex.isUnlocked('test_entry')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Automatic unlock via scene tag
  // ---------------------------------------------------------------------------

  describe('auto-unlock on scene end', () => {
    it('unlocks when the entry is tagged for a scene that ends', () => {
      codex.registerEntry(makeEntry({ tags: ['scene:chapter_02_start'] }));
      engineBus.emit('scene:node_exit', {
        sceneId: 'chapter_02_start',
        nodeId: 'x',
        durationMs: 0,
      });
      expect(codex.isUnlocked('test_entry')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  describe('queries', () => {
    it('getUnlocked filters by category', () => {
      codex.registerEntry(makeEntry({ id: 'a', category: 'character' }));
      codex.registerEntry(makeEntry({ id: 'b', category: 'location' }));
      codex.unlock('a');
      codex.unlock('b');
      expect(codex.getUnlocked('character')).toHaveLength(1);
      expect(codex.getUnlocked('character')[0]?.id).toBe('a');
    });

    it('search scores title matches higher than content matches', () => {
      codex.registerEntry(makeEntry({
        id: 'a',
        title: 'The Mirror',
        summary: 'x',
        fullContent: 'the void mentioned once',
      }));
      codex.registerEntry(makeEntry({
        id: 'b',
        title: 'Something Else',
        summary: 'x',
        fullContent: 'mirror mirror mirror',
      }));
      codex.unlock('a');
      codex.unlock('b');
      const results = codex.search('mirror');
      expect(results[0]?.entry.id).toBe('a');
    });

    it('markRead clears the isNew flag', () => {
      codex.registerEntry(makeEntry());
      codex.unlock('test_entry');
      expect(codex.getEntry('test_entry')?.isNew).toBe(true);
      codex.markRead('test_entry');
      expect(codex.getEntry('test_entry')?.isNew).toBe(false);
      expect(codex.getNewCount()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('round-trips unlock state', () => {
      codex.registerEntry(makeEntry());
      codex.unlock('test_entry');
      const data = codex.serialize();

      const codex2 = new CodexSystem();
      codex2.registerEntry(makeEntry());
      codex2.deserialize(data);
      expect(codex2.isUnlocked('test_entry')).toBe(true);
    });
  });
});
