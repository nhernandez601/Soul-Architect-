/**
 * ScriptParser — tokenizes and parses the Soul Architect Script Language (SASL).
 *
 * SASL is a line-oriented scripting language for authoring scenes.
 * Each scene compiles to a SceneDefinition with a node graph.
 *
 * Example script:
 *
 *   scene cathedral_01
 *     title "The Cathedral at Dawn"
 *     background cathedral_day
 *     music cathedral_theme fade:2000
 *
 *     show seeker neutral left
 *     show aurelia smile right
 *
 *     dialogue seeker "I trust no one."
 *       emotion: fearful
 *       soul: shadow +5 fear +3
 *
 *     choice "What do you say?"
 *       option "I trust you."
 *         goto cathedral_02
 *         relationship aurelia affinity +10
 *         soul hope +3
 *       option "I remain silent."
 *         goto cathedral_03
 *         soul shadow +2
 *
 *     goto cathedral_end
 */

import type { SceneDefinition, SceneNode, DialogueNode, ChoiceNode, Choice, CharacterShowNode, GotoNode, SoulChangeNode, WaitNode, BackgroundChangeNode, MusicChangeNode, NarratorNode } from '@types/scene';
import type { SoulAttribute, SoulDelta } from '@types/soul';
import type { CharacterID, EmotionTag } from '@types/character';
import type { ID } from '@types/core';
import { SOUL_ATTRIBUTES } from '@types/soul';
import { CHARACTER_IDS } from '@types/character';

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type TokenType =
  | 'KEYWORD'
  | 'STRING'
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'SIGN'      // + or -
  | 'COLON'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  'scene', 'title', 'background', 'music', 'ambience', 'weather',
  'show', 'hide', 'move', 'emote',
  'dialogue', 'narrator', 'choice', 'option',
  'soul', 'relationship', 'flag', 'variable',
  'goto', 'wait', 'camera', 'effect',
  'if', 'else', 'endif',
  'macro', 'call',
  'label', 'jump',
  'end', 'ending',
]);

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

export class ScriptLexer {
  private pos = 0;
  private line = 1;
  private col = 1;
  private src: string;

  constructor(source: string) {
    this.src = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    const indentStack: number[] = [0];

    const lines = this.src.split('\n');

    for (const rawLine of lines) {
      const stripped = rawLine.trimEnd();
      if (!stripped || stripped.trimStart().startsWith('#')) {
        this.line++;
        continue;
      }

      const indent = rawLine.length - rawLine.trimStart().length;
      const currentIndent = indentStack[indentStack.length - 1]!;

      if (indent > currentIndent) {
        indentStack.push(indent);
        tokens.push({ type: 'INDENT', value: '', line: this.line, col: 1 });
      } else {
        while (indent < (indentStack[indentStack.length - 1] ?? 0)) {
          indentStack.pop();
          tokens.push({ type: 'DEDENT', value: '', line: this.line, col: 1 });
        }
      }

      const lineTokens = this.tokenizeLine(rawLine.trimStart(), this.line);
      tokens.push(...lineTokens);
      tokens.push({ type: 'NEWLINE', value: '\n', line: this.line, col: stripped.length });
      this.line++;
    }

    while (indentStack.length > 1) {
      indentStack.pop();
      tokens.push({ type: 'DEDENT', value: '', line: this.line, col: 1 });
    }

    tokens.push({ type: 'EOF', value: '', line: this.line, col: 1 });
    return tokens;
  }

  private tokenizeLine(line: string, lineNum: number): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < line.length) {
      const ch = line[i]!;

      // Skip whitespace within a line
      if (ch === ' ' || ch === '\t') { i++; continue; }

      // Comment
      if (ch === '#') break;

      // String literal
      if (ch === '"' || ch === "'") {
        const quote = ch;
        let str = '';
        i++;
        while (i < line.length && line[i] !== quote) {
          if (line[i] === '\\') { i++; str += line[i] ?? ''; }
          else str += line[i];
          i++;
        }
        i++; // close quote
        tokens.push({ type: 'STRING', value: str, line: lineNum, col: i });
        continue;
      }

      // Sign (+ -)
      if ((ch === '+' || ch === '-') && i + 1 < line.length && /\d/.test(line[i + 1]!)) {
        tokens.push({ type: 'SIGN', value: ch, line: lineNum, col: i });
        i++;
        continue;
      }

      // Number
      if (/\d/.test(ch)) {
        let num = '';
        while (i < line.length && /[\d.]/.test(line[i]!)) { num += line[i]; i++; }
        tokens.push({ type: 'NUMBER', value: num, line: lineNum, col: i });
        continue;
      }

      // Colon
      if (ch === ':') {
        tokens.push({ type: 'COLON', value: ':', line: lineNum, col: i });
        i++;
        continue;
      }

      // Identifier / keyword
      if (/[a-zA-Z_]/.test(ch)) {
        let id = '';
        while (i < line.length && /[a-zA-Z0-9_-]/.test(line[i]!)) { id += line[i]; i++; }
        const type: TokenType = KEYWORDS.has(id) ? 'KEYWORD' : 'IDENTIFIER';
        tokens.push({ type, value: id, line: lineNum, col: i });
        continue;
      }

      i++;
    }

    return tokens;
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class ScriptParser {
  private tokens: Token[] = [];
  private pos = 0;
  private nodeCounter = 0;
  private sceneId = '';

  parse(source: string): SceneDefinition[] {
    const lexer = new ScriptLexer(source);
    this.tokens = lexer.tokenize();
    this.pos = 0;

    const scenes: SceneDefinition[] = [];

    while (!this.isEOF()) {
      this.skipNewlines();
      if (this.match('KEYWORD', 'scene')) {
        scenes.push(this.parseScene());
      } else {
        this.advance();
      }
    }

    return scenes;
  }

  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------

  private parseScene(): SceneDefinition {
    this.nodeCounter = 0;
    const sceneId = this.expectIdentifier();
    this.sceneId = sceneId;

    let title = sceneId;
    let backgroundId = 'default';
    const nodes: SceneNode[] = [];

    this.skipNewlines();

    while (!this.isEOF() && !this.match('KEYWORD', 'scene')) {
      if (this.match('KEYWORD', 'title')) {
        title = this.expectString();
        this.skipToNewline();
      } else if (this.match('KEYWORD', 'background')) {
        backgroundId = this.expectIdentifier();
        this.skipToNewline();
      } else if (this.match('KEYWORD', 'music')) {
        const node = this.parseMusicChange();
        nodes.push(node);
      } else if (this.match('KEYWORD', 'show')) {
        nodes.push(this.parseShowCharacter());
      } else if (this.match('KEYWORD', 'hide')) {
        nodes.push(this.parseHideCharacter());
      } else if (this.match('KEYWORD', 'dialogue')) {
        nodes.push(this.parseDialogue());
      } else if (this.match('KEYWORD', 'narrator')) {
        nodes.push(this.parseNarrator());
      } else if (this.match('KEYWORD', 'choice')) {
        nodes.push(this.parseChoice());
      } else if (this.match('KEYWORD', 'soul')) {
        nodes.push(this.parseSoulChange());
      } else if (this.match('KEYWORD', 'goto')) {
        nodes.push(this.parseGoto());
      } else if (this.match('KEYWORD', 'wait')) {
        nodes.push(this.parseWait());
      } else {
        this.advance();
      }
      this.skipNewlines();
    }

    // Wire up sequential nextNodeId links
    for (let i = 0; i < nodes.length - 1; i++) {
      const node = nodes[i]!;
      if (!('nextNodeId' in node) || !(node as { nextNodeId?: string }).nextNodeId) {
        (node as { nextNodeId?: string }).nextNodeId = nodes[i + 1]!.id;
      }
    }

    return {
      id: sceneId,
      type: 'standard',
      title,
      background: {
        id: backgroundId,
        path: `/assets/backgrounds/${backgroundId}.jpg`,
        animated: false,
        transitionIn: 'fade',
        transitionOut: 'fade',
      },
      nodes,
      entryConditions: [],
      tags: [],
      chapter: 1,
      act: 1,
      isReplayable: true,
      wordCount: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Node parsers
  // ---------------------------------------------------------------------------

  private parseShowCharacter(): CharacterShowNode {
    const id = this.nextNodeId();
    const characterId = this.expectIdentifier() as CharacterID;
    const emotion = (this.peekIdentifier() ? this.expectIdentifier() : 'neutral') as EmotionTag;
    const position = (this.peekIdentifier() ? this.expectIdentifier() as 'left' | 'center' | 'right' : 'center');
    this.skipToNewline();

    return {
      id,
      type: 'show_character',
      characterId,
      emotion,
      position,
      transitionIn: 'fade',
      durationMs: 500,
    };
  }

  private parseHideCharacter(): SceneNode {
    const id = this.nextNodeId();
    const characterId = this.expectIdentifier() as CharacterID;
    this.skipToNewline();

    return {
      id,
      type: 'hide_character',
      characterId,
      transitionOut: 'fade',
      durationMs: 500,
    };
  }

  private parseDialogue(): DialogueNode {
    const id = this.nextNodeId();
    const speakerRaw = this.expectIdentifier();
    const speaker = (CHARACTER_IDS as readonly string[]).includes(speakerRaw)
      ? speakerRaw as CharacterID
      : null;

    const text = this.expectString();
    this.skipToNewline();

    return {
      id,
      type: 'dialogue',
      speaker,
      text,
    };
  }

  private parseNarrator(): NarratorNode {
    const id = this.nextNodeId();
    const text = this.expectString();
    this.skipToNewline();

    return {
      id,
      type: 'narrator',
      text,
      style: 'standard',
    };
  }

  private parseChoice(): ChoiceNode {
    const id = this.nextNodeId();
    const prompt = this.peekString() ? this.expectString() : undefined;
    this.skipToNewline();
    this.skipNewlines();

    const choices: Choice[] = [];

    while (this.match('KEYWORD', 'option')) {
      const optionText = this.expectString();
      this.skipToNewline();
      this.skipNewlines();

      let gotoNodeId = '';
      const soulDelta: SoulDelta = {};
      const relationshipDeltas: Record<string, number> = {};

      while (this.matchAnyKeyword(['goto', 'soul', 'relationship', 'flag'])) {
        const kw = this.current().value;
        this.advance();

        if (kw === 'goto') {
          gotoNodeId = this.expectIdentifier();
        } else if (kw === 'soul') {
          const attr = this.expectIdentifier() as SoulAttribute;
          const sign = this.match('SIGN') ? this.advance().value : '+';
          const val = parseFloat(this.expectNumber());
          soulDelta[attr] = sign === '-' ? -val : val;
        } else if (kw === 'relationship') {
          const charId = this.expectIdentifier();
          this.expectIdentifier(); // stat name
          const sign = this.match('SIGN') ? this.advance().value : '+';
          const val = parseFloat(this.expectNumber());
          relationshipDeltas[charId] = sign === '-' ? -val : val;
        }
        this.skipToNewline();
        this.skipNewlines();
      }

      choices.push({
        id: this.nextNodeId(),
        text: optionText,
        soulDelta: Object.keys(soulDelta).length ? soulDelta : undefined,
        relationshipDeltas: Object.keys(relationshipDeltas).length ? relationshipDeltas : undefined,
        gotoNodeId,
      });
    }

    return { id, type: 'choice', choices, layout: 'vertical' };
  }

  private parseMusicChange(): MusicChangeNode {
    const id = this.nextNodeId();
    const trackId = this.expectIdentifier();
    let fadeInMs = 1000;

    // Parse optional fade:XXXX
    if (this.peekIdentifier()?.startsWith('fade')) {
      const fadeStr = this.expectIdentifier();
      const match = fadeStr.match(/fade:(\d+)/);
      if (match?.[1]) fadeInMs = parseInt(match[1], 10);
    }

    this.skipToNewline();

    return {
      id,
      type: 'change_music',
      musicSpec: { trackId, volume: 0.8, fadeInMs, loop: true },
    };
  }

  private parseSoulChange(): SoulChangeNode {
    const id = this.nextNodeId();
    const delta: SoulDelta = {};

    while (this.peekIdentifier() && (SOUL_ATTRIBUTES as readonly string[]).includes(this.peekIdentifier()!)) {
      const attr = this.expectIdentifier() as SoulAttribute;
      const sign = this.match('SIGN') ? this.advance().value : '+';
      const val = parseFloat(this.expectNumber());
      delta[attr] = sign === '-' ? -val : val;
    }

    this.skipToNewline();
    return { id, type: 'soul_change', delta, animate: true };
  }

  private parseGoto(): GotoNode {
    const id = this.nextNodeId();
    const targetSceneId = this.expectIdentifier();
    this.skipToNewline();
    return { id, type: 'goto', targetSceneId };
  }

  private parseWait(): WaitNode {
    const id = this.nextNodeId();
    const ms = parseFloat(this.expectNumber());
    this.skipToNewline();
    return { id, type: 'wait', durationMs: ms };
  }

  // ---------------------------------------------------------------------------
  // Token helpers
  // ---------------------------------------------------------------------------

  private nextNodeId(): ID {
    return `${this.sceneId}_node_${this.nodeCounter++}`;
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private peek(offset = 1): Token {
    return this.tokens[this.pos + offset] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    const t = this.current();
    if (this.pos < this.tokens.length) this.pos++;
    return t;
  }

  private match(type: TokenType, value?: string): boolean {
    const t = this.current();
    return t.type === type && (value === undefined || t.value === value);
  }

  private matchAnyKeyword(keywords: string[]): boolean {
    const t = this.current();
    return t.type === 'KEYWORD' && keywords.includes(t.value);
  }

  private peekIdentifier(): string | undefined {
    const t = this.current();
    return (t.type === 'IDENTIFIER' || t.type === 'KEYWORD') ? t.value : undefined;
  }

  private peekString(): boolean {
    return this.current().type === 'STRING';
  }

  private expectIdentifier(): string {
    const t = this.advance();
    if (t.type !== 'IDENTIFIER' && t.type !== 'KEYWORD') {
      throw new Error(`[ScriptParser] Expected identifier at line ${t.line}, got ${t.type}("${t.value}")`);
    }
    return t.value;
  }

  private expectString(): string {
    const t = this.advance();
    if (t.type !== 'STRING') {
      throw new Error(`[ScriptParser] Expected string at line ${t.line}, got ${t.type}("${t.value}")`);
    }
    return t.value;
  }

  private expectNumber(): string {
    const t = this.advance();
    if (t.type !== 'NUMBER') {
      throw new Error(`[ScriptParser] Expected number at line ${t.line}, got ${t.type}("${t.value}")`);
    }
    return t.value;
  }

  private skipNewlines(): void {
    while (this.match('NEWLINE') || this.match('INDENT') || this.match('DEDENT')) {
      this.advance();
    }
  }

  private skipToNewline(): void {
    while (!this.match('NEWLINE') && !this.isEOF()) this.advance();
    if (this.match('NEWLINE')) this.advance();
  }

  private isEOF(): boolean {
    return this.current().type === 'EOF';
  }
}
