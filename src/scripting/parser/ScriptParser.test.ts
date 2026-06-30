import { describe, it, expect } from 'vitest';
import { ScriptLexer, ScriptParser } from './ScriptParser';

// ---------------------------------------------------------------------------
// ScriptLexer
// ---------------------------------------------------------------------------

describe('ScriptLexer', () => {
  const lex = (src: string) => new ScriptLexer(src).tokenize();

  it('produces an EOF token for empty input', () => {
    const tokens = lex('');
    expect(tokens.at(-1)?.type).toBe('EOF');
  });

  it('skips comment lines starting with #', () => {
    const tokens = lex('# this is a comment\nscene foo');
    expect(tokens.some((t) => t.type === 'KEYWORD' && t.value === 'scene')).toBe(true);
    expect(tokens.some((t) => t.value === 'comment')).toBe(false);
  });

  it('classifies scene, goto, soul, narrator as KEYWORD', () => {
    const tokens = lex('scene goto soul narrator');
    const keywords = tokens.filter((t) => t.type === 'KEYWORD').map((t) => t.value);
    expect(keywords).toContain('scene');
    expect(keywords).toContain('goto');
    expect(keywords).toContain('soul');
    expect(keywords).toContain('narrator');
  });

  it('classifies unknown identifiers as IDENTIFIER', () => {
    const tokens = lex('my_scene_id');
    expect(tokens[0]?.type).toBe('IDENTIFIER');
    expect(tokens[0]?.value).toBe('my_scene_id');
  });

  it('tokenizes a double-quoted string', () => {
    const tokens = lex('"hello world"');
    const str = tokens.find((t) => t.type === 'STRING');
    expect(str?.value).toBe('hello world');
  });

  it('tokenizes a positive signed number', () => {
    const tokens = lex('soul purpose +10');
    const sign = tokens.find((t) => t.type === 'SIGN');
    const num = tokens.find((t) => t.type === 'NUMBER');
    expect(sign?.value).toBe('+');
    expect(num?.value).toBe('10');
  });

  it('tokenizes a negative signed number', () => {
    const tokens = lex('soul fear -5');
    const sign = tokens.find((t) => t.type === 'SIGN');
    expect(sign?.value).toBe('-');
  });

  it('emits INDENT on increased indentation', () => {
    const src = `scene foo\n  narrator "text"`;
    const tokens = lex(src);
    expect(tokens.some((t) => t.type === 'INDENT')).toBe(true);
  });

  it('emits DEDENT when indentation decreases', () => {
    const src = `scene foo\n  narrator "text"\nscene bar`;
    const tokens = lex(src);
    expect(tokens.some((t) => t.type === 'DEDENT')).toBe(true);
  });

  it('emits NEWLINE after each non-blank line', () => {
    const tokens = lex('scene foo\ngoto bar');
    expect(tokens.filter((t) => t.type === 'NEWLINE').length).toBeGreaterThan(0);
  });

  it('records line numbers on tokens', () => {
    const tokens = lex('scene foo\nnine ten');
    const sceneToken = tokens.find((t) => t.value === 'scene');
    expect(sceneToken?.line).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ScriptParser
// ---------------------------------------------------------------------------

const parser = new ScriptParser();

describe('ScriptParser', () => {
  // -------------------------------------------------------------------------
  // Basic scene
  // -------------------------------------------------------------------------

  describe('scene declaration', () => {
    it('parses a minimal scene with an id', () => {
      const scenes = parser.parse('scene prologue_01\n  goto chapter_01');
      expect(scenes[0]?.id).toBe('prologue_01');
    });

    it('parses multiple scenes from one source', () => {
      const src = `scene scene_a\n  goto scene_b\nscene scene_b\n  goto end_scene`;
      const scenes = parser.parse(src);
      expect(scenes).toHaveLength(2);
      expect(scenes[0]?.id).toBe('scene_a');
      expect(scenes[1]?.id).toBe('scene_b');
    });

    it('uses the scene id as default title', () => {
      const scenes = parser.parse('scene my_scene\n  goto next');
      expect(scenes[0]?.title).toBe('my_scene');
    });

    it('parses an explicit title', () => {
      const scenes = parser.parse('scene intro\n  title "The Beginning"\n  goto ch2');
      expect(scenes[0]?.title).toBe('The Beginning');
    });

    it('parses background declaration', () => {
      const scenes = parser.parse('scene s1\n  background cathedral_day\n  goto s2');
      expect(scenes[0]?.background.id).toBe('cathedral_day');
    });
  });

  // -------------------------------------------------------------------------
  // Node types
  // -------------------------------------------------------------------------

  describe('narrator node', () => {
    it('parses narrator text', () => {
      const scenes = parser.parse('scene s1\n  narrator "In the beginning..."');
      const node = scenes[0]?.nodes.find((n) => n.type === 'narrator');
      expect(node).toBeDefined();
      expect((node as { text: string })?.text).toBe('In the beginning...');
    });
  });

  describe('dialogue node', () => {
    it('parses dialogue with speaker and text', () => {
      const scenes = parser.parse('scene s1\n  dialogue nyx "Hello, seeker."');
      const node = scenes[0]?.nodes.find((n) => n.type === 'dialogue');
      expect(node).toBeDefined();
      expect((node as { text: string })?.text).toBe('Hello, seeker.');
    });
  });

  describe('goto node', () => {
    it('parses goto with target scene id', () => {
      const scenes = parser.parse('scene s1\n  goto chapter_02');
      const gotoNode = scenes[0]?.nodes.find((n) => n.type === 'goto');
      expect((gotoNode as { targetSceneId: string })?.targetSceneId).toBe('chapter_02');
    });
  });

  describe('soul_change node', () => {
    it('parses a positive soul delta', () => {
      const scenes = parser.parse('scene s1\n  soul purpose +10');
      const node = scenes[0]?.nodes.find((n) => n.type === 'soul_change');
      expect((node as { delta: Record<string, number> })?.delta.purpose).toBe(10);
    });

    it('parses a negative soul delta', () => {
      const scenes = parser.parse('scene s1\n  soul fear -5');
      const node = scenes[0]?.nodes.find((n) => n.type === 'soul_change');
      expect((node as { delta: Record<string, number> })?.delta.fear).toBe(-5);
    });

    it('parses multiple soul attrs in one statement', () => {
      const scenes = parser.parse('scene s1\n  soul hope +3 compassion +7');
      const node = scenes[0]?.nodes.find((n) => n.type === 'soul_change') as
        | { delta: Record<string, number> }
        | undefined;
      expect(node?.delta.hope).toBe(3);
      expect(node?.delta.compassion).toBe(7);
    });
  });

  describe('music node', () => {
    it('parses a music change', () => {
      const scenes = parser.parse('scene s1\n  music cathedral_theme');
      const node = scenes[0]?.nodes.find((n) => n.type === 'change_music');
      expect((node as { musicSpec: { trackId: string } })?.musicSpec.trackId).toBe('cathedral_theme');
    });
  });

  describe('show_character node', () => {
    it('parses a character show command', () => {
      const scenes = parser.parse('scene s1\n  show nyx neutral center');
      const node = scenes[0]?.nodes.find((n) => n.type === 'show_character');
      expect((node as { characterId: string })?.characterId).toBe('nyx');
    });
  });

  // -------------------------------------------------------------------------
  // Choice node
  // -------------------------------------------------------------------------

  describe('choice node', () => {
    it('parses a simple choice with two options', () => {
      const src = [
        'scene s1',
        '  choice "What do you do?"',
        '    option "Leave"',
        '      goto s2',
        '    option "Stay"',
        '      goto s3',
      ].join('\n');
      const scenes = parser.parse(src);
      const choice = scenes[0]?.nodes.find((n) => n.type === 'choice') as
        | { choices: { text: string }[] }
        | undefined;
      expect(choice?.choices).toHaveLength(2);
      expect(choice?.choices[0]?.text).toBe('Leave');
      expect(choice?.choices[1]?.text).toBe('Stay');
    });

    it('captures soul delta inside an option', () => {
      const src = [
        'scene s1',
        '  choice "Pick"',
        '    option "Bold move"',
        '      soul pride +5',
        '      goto s2',
      ].join('\n');
      const scenes = parser.parse(src);
      const choice = scenes[0]?.nodes.find((n) => n.type === 'choice') as
        | { choices: { soulDelta?: Record<string, number> }[] }
        | undefined;
      expect(choice?.choices[0]?.soulDelta?.pride).toBe(5);
    });

    it('captures the option goto target as a scene id', () => {
      const src = [
        'scene s1',
        '  choice "Decide"',
        '    option "Path A"',
        '      goto path_a',
      ].join('\n');
      const scenes = parser.parse(src);
      const choice = scenes[0]?.nodes.find((n) => n.type === 'choice') as
        | { choices: { gotoSceneId?: string }[] }
        | undefined;
      expect(choice?.choices[0]?.gotoSceneId).toBe('path_a');
    });

    it('captures flagsSet inside an option', () => {
      const src = [
        'scene s1',
        '  choice "Pick"',
        '    option "Set it"',
        '      flag brave_entry true',
        '      goto s2',
      ].join('\n');
      const scenes = parser.parse(src);
      const choice = scenes[0]?.nodes.find((n) => n.type === 'choice') as
        | { choices: { flagsSet?: Record<string, unknown> }[] }
        | undefined;
      expect(choice?.choices[0]?.flagsSet?.brave_entry).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Node IDs + sequential linking
  // -------------------------------------------------------------------------

  describe('node wiring', () => {
    it('assigns unique ids to all nodes', () => {
      const scenes = parser.parse('scene s1\n  narrator "A"\n  narrator "B"\n  goto end');
      const ids = scenes[0]?.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids?.length);
    });

    it('links nodes sequentially via nextNodeId', () => {
      const scenes = parser.parse('scene s1\n  narrator "A"\n  narrator "B"');
      const nodes = scenes[0]?.nodes ?? [];
      expect((nodes[0] as { nextNodeId?: string }).nextNodeId).toBe(nodes[1]?.id);
    });
  });

  // -------------------------------------------------------------------------
  // State directives (parser parity)
  // -------------------------------------------------------------------------

  describe('flag directive', () => {
    it('parses a boolean flag into a flag_set node', () => {
      const scenes = parser.parse('scene s1\n  flag chapter_01_complete true');
      const node = scenes[0]?.nodes.find((n) => n.type === 'flag_set') as
        | { flags: Record<string, unknown> } | undefined;
      expect(node?.flags.chapter_01_complete).toBe(true);
    });

    it('parses a string flag value', () => {
      const scenes = parser.parse('scene s1\n  flag path_taken shadow');
      const node = scenes[0]?.nodes.find((n) => n.type === 'flag_set') as
        | { flags: Record<string, unknown> } | undefined;
      expect(node?.flags.path_taken).toBe('shadow');
    });
  });

  describe('relationship directive', () => {
    it('parses a positive relationship change', () => {
      const scenes = parser.parse('scene s1\n  relationship nyx trust +8');
      const node = scenes[0]?.nodes.find((n) => n.type === 'relationship_change') as
        | { characterId: string; stat: string; delta: number } | undefined;
      expect(node?.characterId).toBe('nyx');
      expect(node?.stat).toBe('trust');
      expect(node?.delta).toBe(8);
    });

    it('parses a negative relationship change', () => {
      const scenes = parser.parse('scene s1\n  relationship nyx trust -5');
      const node = scenes[0]?.nodes.find((n) => n.type === 'relationship_change') as
        | { delta: number } | undefined;
      expect(node?.delta).toBe(-5);
    });
  });

  describe('codex / achievement directives', () => {
    it('parses codex unlock with a quoted id', () => {
      const scenes = parser.parse('scene s1\n  codex unlock "the_voice"');
      const node = scenes[0]?.nodes.find((n) => n.type === 'codex_unlock') as
        | { entryId: string } | undefined;
      expect(node?.entryId).toBe('the_voice');
    });

    it('parses achievement unlock with a quoted id', () => {
      const scenes = parser.parse('scene s1\n  achievement unlock "voice_found"');
      const node = scenes[0]?.nodes.find((n) => n.type === 'achievement_unlock') as
        | { achievementId: string } | undefined;
      expect(node?.achievementId).toBe('voice_found');
    });
  });

  describe('weather directive', () => {
    it('maps a fog-like label to the fog weather type', () => {
      const scenes = parser.parse('scene s1\n  weather "morning_mist"');
      const node = scenes[0]?.nodes.find((n) => n.type === 'weather_change') as
        | { weatherSpec: { type: string } } | undefined;
      expect(node?.weatherSpec.type).toBe('fog');
    });

    it('maps "none" to clear with zero intensity', () => {
      const scenes = parser.parse('scene s1\n  weather none');
      const node = scenes[0]?.nodes.find((n) => n.type === 'weather_change') as
        | { weatherSpec: { type: string; intensity: number } } | undefined;
      expect(node?.weatherSpec.type).toBe('clear');
      expect(node?.weatherSpec.intensity).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Conditional (if) blocks
  // -------------------------------------------------------------------------

  describe('if conditional', () => {
    it('tags a body goto with parsed conditions and skipOnConditionFail', () => {
      const src = [
        'scene s1',
        '  if soul.purpose >= 50 and soul.compassion >= 40',
        '    goto true_path',
        '  end',
        '  goto fallback_path',
      ].join('\n');
      const scenes = parser.parse(src);
      const gotos = scenes[0]?.nodes.filter((n) => n.type === 'goto') as
        | Array<{ targetSceneId?: string; conditions?: Array<{ attribute: string; operator: string; value: number }>; skipOnConditionFail?: boolean }>
        | undefined;

      const conditional = gotos?.find((g) => g.targetSceneId === 'true_path');
      expect(conditional?.skipOnConditionFail).toBe(true);
      expect(conditional?.conditions).toHaveLength(2);
      expect(conditional?.conditions?.[0]).toMatchObject({ attribute: 'purpose', operator: '>=', value: 50 });
      expect(conditional?.conditions?.[1]).toMatchObject({ attribute: 'compassion', operator: '>=', value: 40 });

      const fallback = gotos?.find((g) => g.targetSceneId === 'fallback_path');
      expect(fallback?.conditions).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Prose format: multi-line strings, own-line speakers, comments
  // -------------------------------------------------------------------------

  describe('prose formatting', () => {
    it('joins a string authored across multiple physical lines', () => {
      const src = [
        'scene s1',
        '  narrator',
        '    "The air here is different. Thicker. As if every breath',
        '     draws in something older than memory."',
      ].join('\n');
      const scenes = parser.parse(src);
      const node = scenes[0]?.nodes.find((n) => n.type === 'narrator') as
        | { text: string } | undefined;
      expect(node?.text).toContain('different');
      expect(node?.text).toContain('older than memory');
      expect(node?.text).not.toContain('\n');
    });

    it('parses an own-line speaker followed by an indented string', () => {
      const src = [
        'scene s1',
        '  nyx',
        '    "You can feel it, can\'t you?"',
      ].join('\n');
      const scenes = parser.parse(src);
      const node = scenes[0]?.nodes.find((n) => n.type === 'dialogue') as
        | { speaker: string | null; text: string } | undefined;
      expect(node?.speaker).toBe('nyx');
      expect(node?.text).toContain('feel it');
    });

    it('does not treat an apostrophe in a // comment as a string', () => {
      const src = [
        "// The Threshold Holds — reached when conditions aren't fully met",
        'scene s1',
        '  narrator "ok"',
        'scene s2',
        '  narrator "second"',
      ].join('\n');
      const scenes = parser.parse(src);
      expect(scenes.map((s) => s.id)).toEqual(['s1', 's2']);
    });
  });
});

// ---------------------------------------------------------------------------
// ScriptLexer — comparison operators
// ---------------------------------------------------------------------------

describe('ScriptLexer operators', () => {
  it('tokenizes >= as a single OPERATOR token', () => {
    const tokens = new ScriptLexer('if soul.purpose >= 50').tokenize();
    const op = tokens.find((t) => t.type === 'OPERATOR');
    expect(op?.value).toBe('>=');
  });

  it('tokenizes != as a single OPERATOR token', () => {
    const tokens = new ScriptLexer('if fear != 10').tokenize();
    const op = tokens.find((t) => t.type === 'OPERATOR');
    expect(op?.value).toBe('!=');
  });
});
