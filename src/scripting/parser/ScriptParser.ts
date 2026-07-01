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

import type { SceneDefinition, SceneNode, DialogueNode, ChoiceNode, Choice, CharacterShowNode, GotoNode, SoulChangeNode, WaitNode, BackgroundChangeNode, MusicChangeNode, NarratorNode, FlagSetNode, RelationshipChangeNode, WeatherChangeNode, CodexUnlockNode, AchievementUnlockNode } from '@t/scene';
import type { SoulAttribute, SoulDelta, SoulCondition, ConditionOperator } from '@t/soul';
import type { CharacterID, EmotionTag } from '@t/character';
import type { ID } from '@t/core';
import { SOUL_ATTRIBUTES } from '@t/soul';
import { CHARACTER_IDS } from '@t/character';

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type TokenType =
  | 'KEYWORD'
  | 'STRING'
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'SIGN'      // + or -
  | 'OPERATOR'  // >= <= == != > <
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
    const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    this.src = ScriptLexer.collapseMultilineStrings(normalized);
  }

  /**
   * Join newlines that occur *inside* a quoted string into single spaces, so a
   * string authored across several physical lines becomes one logical token.
   * Leading whitespace on continuation lines is collapsed away.
   */
  private static collapseMultilineStrings(src: string): string {
    let out = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < src.length; i++) {
      const ch = src[i]!;

      if (inQuote) {
        if (ch === '\\') { out += ch + (src[i + 1] ?? ''); i++; continue; }
        if (ch === quoteChar) { inQuote = false; out += ch; continue; }
        if (ch === '\n') {
          out += ' ';
          while (i + 1 < src.length && (src[i + 1] === ' ' || src[i + 1] === '\t')) i++;
          continue;
        }
        out += ch;
        continue;
      }

      // Skip comments verbatim — apostrophes in prose must not open a string
      if (ch === '#' || (ch === '/' && src[i + 1] === '/')) {
        while (i < src.length && src[i] !== '\n') { out += src[i]!; i++; }
        if (i < src.length) out += '\n';
        continue;
      }

      if (ch === '"' || ch === "'") { inQuote = true; quoteChar = ch; }
      out += ch;
    }

    return out;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    const indentStack: number[] = [0];

    const lines = this.src.split('\n');

    for (const rawLine of lines) {
      const stripped = rawLine.trimEnd();
      const lead = stripped.trimStart();
      if (!stripped || lead.startsWith('#') || lead.startsWith('//')) {
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

      // Comment (# or //)
      if (ch === '#') break;
      if (ch === '/' && line[i + 1] === '/') break;

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

      // Comparison operator (>= <= == != > <)
      if (ch === '>' || ch === '<' || ch === '=' || ch === '!') {
        let op = ch;
        i++;
        if (line[i] === '=') { op += '='; i++; }
        tokens.push({ type: 'OPERATOR', value: op, line: lineNum, col: i });
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
    this.advance(); // consume 'scene'
    const sceneId = this.expectIdentifier();
    this.sceneId = sceneId;

    let title = sceneId;
    let backgroundId = 'default';
    const nodes: SceneNode[] = [];
    let chapter = 1;
    let act = 1;

    this.skipNewlines();

    while (!this.isEOF() && !this.match('KEYWORD', 'scene')) {
      if (this.match('KEYWORD', 'title')) {
        this.advance(); // consume 'title'
        title = this.expectString();
        this.skipToNewline();
      } else if (this.match('KEYWORD', 'background')) {
        this.advance(); // consume 'background'
        backgroundId = this.peekString() ? this.expectString() : this.expectIdentifier();
        this.skipToNewline();
      } else if (this.peekKeyword('chapter')) {
        this.advance(); // consume 'chapter'
        if (this.match('NUMBER')) chapter = parseInt(this.advance().value, 10);
        this.skipToNewline();
      } else if (this.peekKeyword('act')) {
        this.advance(); // consume 'act'
        if (this.match('NUMBER')) act = parseInt(this.advance().value, 10);
        this.skipToNewline();
      } else if (this.match('KEYWORD', 'if')) {
        nodes.push(...this.parseIfBlock());
      } else {
        const node = this.parseActionStatement();
        if (node) nodes.push(node);
        else this.skipStatement(); // skip an unrecognized directive line
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
      chapter,
      act,
      isReplayable: true,
      wordCount: 0,
    };
  }

  /**
   * Parse a single action statement (anything that becomes a SceneNode).
   * Returns null if the current token isn't a recognized action keyword.
   */
  private parseActionStatement(): SceneNode | null {
    if (this.match('KEYWORD', 'music'))        return this.parseMusicChange();
    if (this.match('KEYWORD', 'show'))         return this.parseShowCharacter();
    if (this.match('KEYWORD', 'hide'))         return this.parseHideCharacter();
    if (this.match('KEYWORD', 'dialogue'))     return this.parseDialogue();
    if (this.match('KEYWORD', 'narrator'))     return this.parseNarrator();
    if (this.match('KEYWORD', 'choice'))       return this.parseChoice();
    if (this.match('KEYWORD', 'soul'))         return this.parseSoulChange();
    if (this.match('KEYWORD', 'goto'))         return this.parseGoto();
    if (this.match('KEYWORD', 'wait'))         return this.parseWait();
    if (this.match('KEYWORD', 'flag'))         return this.parseFlagSet();
    if (this.match('KEYWORD', 'relationship')) return this.parseRelationshipChange();
    if (this.peekKeyword('weather'))           return this.parseWeatherChange();
    if (this.peekKeyword('codex'))             return this.parseCodexUnlock();
    if (this.peekKeyword('achievement'))       return this.parseAchievementUnlock();
    // Dialogue shorthand: `character_name "text"` or `character_name` then an
    // indented string on the following line(s).
    if (this.match('IDENTIFIER') && this.stringFollows()) {
      return this.parseShorthandDialogue();
    }
    return null;
  }

  /**
   * Parse an `if <conditions>` ... `end` block. Each body statement is tagged
   * with the parsed conditions and skipOnConditionFail so the SceneManager
   * falls through to the next node when the conditions aren't met.
   */
  private parseIfBlock(): SceneNode[] {
    this.advance(); // consume 'if'
    const conditions = this.parseConditions();
    this.skipToNewline();
    this.skipNewlines();

    const body: SceneNode[] = [];
    while (!this.isEOF() && !this.match('KEYWORD', 'scene') && !this.match('KEYWORD', 'end')) {
      const node = this.parseActionStatement();
      if (node) body.push(node);
      else this.skipStatement();
      this.skipNewlines();
    }
    if (this.match('KEYWORD', 'end')) this.advance(); // consume closing 'end'

    for (const node of body) {
      node.conditions = conditions;
      node.skipOnConditionFail = true;
    }
    return body;
  }

  /**
   * Parse a condition expression: `soul.purpose >= 30 and soul.compassion >= 20`.
   * The leading `soul.` prefix is optional (the lexer drops the `.`).
   */
  private parseConditions(): SoulCondition[] {
    const conditions: SoulCondition[] = [];

    while (!this.match('NEWLINE') && !this.isEOF()) {
      // Optional `soul` prefix (followed by a dropped `.`)
      if (this.match('KEYWORD', 'soul') ||
          (this.match('IDENTIFIER') && this.current().value === 'soul')) {
        this.advance();
      }

      const attribute = this.expectIdentifier();
      const operator = (this.match('OPERATOR') ? this.advance().value : '>=') as ConditionOperator;

      let value: number | boolean | string;
      if (this.match('SIGN')) {
        const sign = this.advance().value;
        value = (sign === '-' ? -1 : 1) * parseFloat(this.expectNumber());
      } else if (this.match('NUMBER')) {
        value = parseFloat(this.advance().value);
      } else {
        const raw = this.advance().value;
        value = raw === 'true' ? true : raw === 'false' ? false : raw;
      }

      conditions.push({ attribute, operator, value } as SoulCondition);

      // Conjunctions: `and` continues, anything else ends the expression
      if ((this.match('IDENTIFIER') || this.match('KEYWORD')) && this.current().value === 'and') {
        this.advance();
      } else {
        break;
      }
    }

    return conditions;
  }

  // ---------------------------------------------------------------------------
  // Node parsers
  // ---------------------------------------------------------------------------

  private parseShowCharacter(): CharacterShowNode {
    this.advance(); // consume 'show'
    const id = this.nextNodeId();
    const characterId = this.expectIdentifier() as CharacterID;

    // Attributes may be bare (`neutral left`) or keyed (`position:left emotion:happy`)
    let emotion: string = 'neutral';
    let position: string = 'center';
    const positions = new Set(['left', 'center', 'right']);

    while (this.peekIdentifier() && !this.match('NEWLINE')) {
      const key = this.expectIdentifier();
      if (this.match('COLON')) {
        this.advance(); // consume ':'
        const val = this.expectIdentifier();
        if (key === 'position') position = val;
        else if (key === 'emotion') emotion = val;
      } else if (positions.has(key)) {
        position = key;
      } else {
        emotion = key;
      }
    }
    this.skipToNewline();

    return {
      id,
      type: 'show_character',
      characterId,
      emotion: emotion as EmotionTag,
      position: position as 'left' | 'center' | 'right',
      transitionIn: 'fade',
      durationMs: 500,
    };
  }

  private parseHideCharacter(): SceneNode {
    this.advance(); // consume 'hide'
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
    this.advance(); // consume 'dialogue'
    const id = this.nextNodeId();
    const speakerRaw = this.expectIdentifier();
    const speaker = (CHARACTER_IDS as readonly string[]).includes(speakerRaw)
      ? speakerRaw as CharacterID
      : null;

    const text = this.readStringFlexible();
    this.skipToNewline();

    return {
      id,
      type: 'dialogue',
      speaker,
      text,
    };
  }

  /** Dialogue shorthand: `nyx "..."` or `nyx` on its own line then the string. */
  private parseShorthandDialogue(): DialogueNode {
    const id = this.nextNodeId();
    const speakerRaw = this.advance().value; // speaker token
    const isNarrator = speakerRaw === 'narrator';
    const speaker = isNarrator
      ? 'narrator'
      : (CHARACTER_IDS as readonly string[]).includes(speakerRaw)
        ? (speakerRaw as CharacterID)
        : null;

    const text = this.readStringFlexible();
    this.skipToNewline();

    return { id, type: 'dialogue', speaker, text };
  }

  private parseNarrator(): NarratorNode {
    this.advance(); // consume 'narrator'
    const id = this.nextNodeId();
    const text = this.readStringFlexible();
    this.skipToNewline();

    return {
      id,
      type: 'narrator',
      text,
      style: 'standard',
    };
  }

  private parseChoice(): ChoiceNode {
    this.advance(); // consume 'choice'
    const id = this.nextNodeId();
    const prompt = this.peekString() ? this.expectString() : undefined;
    this.skipToNewline();
    this.skipNewlines();

    const choices: Choice[] = [];

    while (this.match('KEYWORD', 'option')) {
      this.advance(); // consume 'option'
      const optionText = this.expectString();
      this.skipToNewline();
      this.skipNewlines();

      let gotoSceneId = '';
      const soulDelta: SoulDelta = {};
      const relationshipDeltas: Record<string, number> = {};
      const flagsSet: Record<string, boolean | string | number> = {};

      while (this.matchAnyKeyword(['goto', 'soul', 'relationship', 'flag']) ||
             this.peekKeyword('codex')) {
        const kw = this.current().value;
        this.advance();

        if (kw === 'goto') {
          gotoSceneId = this.expectIdentifier();
        } else if (kw === 'soul') {
          while (this.peekIdentifier() && (SOUL_ATTRIBUTES as readonly string[]).includes(this.peekIdentifier()!)) {
            const attr = this.expectIdentifier() as SoulAttribute;
            const sign = this.match('SIGN') ? this.advance().value : '+';
            const val = parseFloat(this.expectNumber());
            soulDelta[attr] = sign === '-' ? -val : val;
          }
        } else if (kw === 'relationship') {
          const charId = this.expectIdentifier();
          this.expectIdentifier(); // stat name (affinity/trust/tension)
          const sign = this.match('SIGN') ? this.advance().value : '+';
          const val = parseFloat(this.expectNumber());
          relationshipDeltas[charId] = sign === '-' ? -val : val;
        } else if (kw === 'flag') {
          const key = this.expectIdentifier();
          flagsSet[key] = this.parseFlagValue();
        } else if (kw === 'codex') {
          this.skipToNewline(); // `codex unlock "id"` — handled at node level elsewhere
        }
        this.skipToNewline();
        this.skipNewlines();
      }

      choices.push({
        id: this.nextNodeId(),
        text: optionText,
        soulDelta: Object.keys(soulDelta).length ? soulDelta : undefined,
        relationshipDeltas: Object.keys(relationshipDeltas).length ? relationshipDeltas : undefined,
        flagsSet: Object.keys(flagsSet).length ? flagsSet : undefined,
        gotoNodeId: '',
        gotoSceneId,
      });
    }

    return { id, type: 'choice', choices, layout: 'vertical' };
  }

  private parseMusicChange(): MusicChangeNode {
    this.advance(); // consume 'music'
    const id = this.nextNodeId();
    const trackId = this.peekString() ? this.expectString() : this.expectIdentifier();
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
    this.advance(); // consume 'soul'
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
    this.advance(); // consume 'goto'
    const id = this.nextNodeId();
    const targetSceneId = this.expectIdentifier();
    this.skipToNewline();
    return { id, type: 'goto', targetSceneId };
  }

  private parseWait(): WaitNode {
    this.advance(); // consume 'wait'
    const id = this.nextNodeId();
    const ms = parseFloat(this.expectNumber());
    this.skipToNewline();
    return { id, type: 'wait', durationMs: ms };
  }

  private parseFlagSet(): FlagSetNode {
    this.advance(); // consume 'flag'
    const id = this.nextNodeId();
    const key = this.expectIdentifier();
    const value = this.parseFlagValue();
    this.skipToNewline();
    return { id, type: 'flag_set', flags: { [key]: value } };
  }

  private parseRelationshipChange(): RelationshipChangeNode {
    this.advance(); // consume 'relationship'
    const id = this.nextNodeId();
    const characterId = this.expectIdentifier() as CharacterID;
    const stat = this.expectIdentifier() as 'affinity' | 'trust' | 'tension';
    const sign = this.match('SIGN') ? this.advance().value : '+';
    const delta = (sign === '-' ? -1 : 1) * parseFloat(this.expectNumber());
    this.skipToNewline();
    return { id, type: 'relationship_change', characterId, stat, delta };
  }

  private parseWeatherChange(): WeatherChangeNode {
    this.advance(); // consume 'weather'
    const id = this.nextNodeId();
    const label = this.peekString()
      ? this.expectString()
      : this.peekIdentifier()
        ? this.expectIdentifier()
        : 'clear';
    this.skipToNewline();

    // Map atmospheric labels onto the WeatherType enum (best-effort).
    const l = label.toLowerCase();
    let type: WeatherChangeNode['weatherSpec']['type'] = 'clear';
    let intensity = 0.5;
    if (l === 'none' || l === 'clear') { type = 'clear'; intensity = 0; }
    else if (l.includes('mist') || l.includes('fog')) type = 'fog';
    else if (l.includes('ash') || l.includes('fracture')) type = 'ash';
    else if (l.includes('dusk') || l.includes('dark') || l.includes('void')) type = 'void';
    else if (l.includes('storm')) type = 'storm';
    else if (l.includes('rain')) type = 'rain';
    else if (l.includes('snow')) type = 'snow';
    else type = 'fog';

    return {
      id,
      type: 'weather_change',
      weatherSpec: { type, intensity, windStrength: 0.2 },
      transitionMs: 1500,
    };
  }

  private parseCodexUnlock(): CodexUnlockNode {
    this.advance(); // consume 'codex'
    const id = this.nextNodeId();
    if (this.peekIdentifier() === 'unlock') this.advance(); // optional 'unlock'
    const entryId = this.peekString() ? this.expectString() : this.expectIdentifier();
    this.skipToNewline();
    return { id, type: 'codex_unlock', entryId };
  }

  private parseAchievementUnlock(): AchievementUnlockNode {
    this.advance(); // consume 'achievement'
    const id = this.nextNodeId();
    if (this.peekIdentifier() === 'unlock') this.advance(); // optional 'unlock'
    const achievementId = this.peekString() ? this.expectString() : this.expectIdentifier();
    this.skipToNewline();
    return { id, type: 'achievement_unlock', achievementId };
  }

  /** Parse a flag value token: true / false / number / bare or quoted string. */
  private parseFlagValue(): boolean | string | number {
    if (this.match('NUMBER')) return parseFloat(this.advance().value);
    if (this.match('SIGN')) {
      const sign = this.advance().value;
      return (sign === '-' ? -1 : 1) * parseFloat(this.expectNumber());
    }
    if (this.peekString()) return this.expectString();
    const raw = this.advance().value;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
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

  /** True if the current token is a keyword OR identifier with the given value. */
  private peekKeyword(value: string): boolean {
    const t = this.current();
    return (t.type === 'KEYWORD' || t.type === 'IDENTIFIER') && t.value === value;
  }

  private peekString(): boolean {
    return this.current().type === 'STRING';
  }

  /** Read a string, first skipping any layout tokens (own-line / multi-line). */
  private readStringFlexible(): string {
    while (this.match('NEWLINE') || this.match('INDENT') || this.match('DEDENT')) {
      this.advance();
    }
    return this.expectString();
  }

  /** Lookahead: does a STRING follow the current token (skipping layout)? */
  private stringFollows(): boolean {
    let k = this.pos + 1;
    while (k < this.tokens.length) {
      const t = this.tokens[k]!;
      if (t.type === 'NEWLINE' || t.type === 'INDENT' || t.type === 'DEDENT') { k++; continue; }
      return t.type === 'STRING';
    }
    return false;
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

  /** Skip one layout token, or an entire unrecognized directive line. */
  private skipStatement(): void {
    if (this.match('NEWLINE') || this.match('INDENT') || this.match('DEDENT')) {
      this.advance();
    } else {
      this.skipToNewline();
    }
  }

  private isEOF(): boolean {
    return this.current().type === 'EOF';
  }
}
