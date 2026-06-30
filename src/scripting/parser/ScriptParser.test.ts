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

    it('captures gotoNodeId for each option', () => {
      const src = [
        'scene s1',
        '  choice "Decide"',
        '    option "Path A"',
        '      goto path_a',
      ].join('\n');
      const scenes = parser.parse(src);
      const choice = scenes[0]?.nodes.find((n) => n.type === 'choice') as
        | { choices: { gotoNodeId: string }[] }
        | undefined;
      expect(choice?.choices[0]?.gotoNodeId).toBe('path_a');
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
});
