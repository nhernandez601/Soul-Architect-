#!/usr/bin/env ts-node
/**
 * Soul Architect — SASL Story Validator
 *
 * Parses all .sasl files under story/ and checks:
 *  1. Every `goto <target>` resolves to a defined `scene <id>`
 *  2. No duplicate scene IDs across files
 *  3. Every `choice` block contains at least one `option`
 *  4. Every `option` block ends with a `goto` or `end`
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORY_DIR = join(__dirname, '../../story');
const VALID_SOUL_STATS = new Set([
  'purpose', 'compassion', 'hope', 'love', 'knowledge',
  'memory', 'fear', 'shadow', 'pride', 'regret',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (extname(entry) === '.sasl') {
      results.push(full);
    }
  }
  return results;
}

function shortPath(p: string): string {
  return p.replace(join(__dirname, '../../'), '');
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface SceneEntry {
  id: string;
  file: string;
  line: number;
}

interface GotoEntry {
  target: string;
  file: string;
  line: number;
}

interface Issue {
  file: string;
  line: number;
  message: string;
  level: 'error' | 'warn';
}

function parseFile(filePath: string): {
  scenes: SceneEntry[];
  gotos: GotoEntry[];
  issues: Issue[];
} {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const scenes: SceneEntry[] = [];
  const gotos: GotoEntry[] = [];
  const issues: Issue[] = [];

  let inChoice = false;
  let choiceOptionCount = 0;
  let choiceLine = 0;
  let inOption = false;
  let optionHasTerminator = false;
  let optionLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // scene declaration — both `scene foo` and `scene foo:` forms
    const sceneMatch = trimmed.match(/^scene\s+(\S+?):?\s*$/);
    if (sceneMatch) {
      scenes.push({ id: sceneMatch[1], file: filePath, line: lineNum });
      // Closing out any open choice/option
      if (inChoice && choiceOptionCount === 0) {
        issues.push({ file: filePath, line: choiceLine, message: 'choice block has no options', level: 'warn' });
      }
      if (inOption && !optionHasTerminator) {
        issues.push({ file: filePath, line: optionLine, message: 'option block has no goto or end', level: 'warn' });
      }
      inChoice = false;
      inOption = false;
      continue;
    }

    // goto — both `goto foo` and `goto: foo` forms
    const gotoMatch = trimmed.match(/^goto:?\s+(\S+)/);
    if (gotoMatch) {
      gotos.push({ target: gotoMatch[1], file: filePath, line: lineNum });
      if (inOption) {
        optionHasTerminator = true;
      }
      continue;
    }

    // end
    if (trimmed === 'end') {
      if (inOption) {
        optionHasTerminator = true;
        inOption = false;
      }
      if (inChoice) {
        if (choiceOptionCount === 0) {
          issues.push({ file: filePath, line: choiceLine, message: 'choice block has no options', level: 'warn' });
        }
        inChoice = false;
      }
      continue;
    }

    // choice keyword
    if (trimmed.startsWith('choice') || trimmed === 'choice:') {
      if (inOption && !optionHasTerminator) {
        issues.push({ file: filePath, line: optionLine, message: 'option block has no goto or end', level: 'warn' });
        inOption = false;
      }
      inChoice = true;
      choiceOptionCount = 0;
      choiceLine = lineNum;
      continue;
    }

    // option keyword
    if (inChoice && (trimmed.startsWith('option ') || trimmed.match(/^-\s+"[^"]+"\s+->/))) {
      if (inOption && !optionHasTerminator) {
        issues.push({ file: filePath, line: optionLine, message: 'option block has no goto or end', level: 'warn' });
      }
      choiceOptionCount++;
      inOption = true;
      optionHasTerminator = false;
      optionLine = lineNum;

      // Inline arrow syntax: - "label" -> target
      const arrowMatch = trimmed.match(/->\s+(\S+)\s*$/);
      if (arrowMatch) {
        gotos.push({ target: arrowMatch[1], file: filePath, line: lineNum });
        optionHasTerminator = true;
        inOption = false;
      }
      continue;
    }

    // soul_change / soul directive — warn on unknown stats
    const soulMatch = trimmed.match(/^soul(?:_change)?:?\s+(.+)/);
    if (soulMatch) {
      const parts = soulMatch[1].split(/\s+/);
      for (let j = 0; j < parts.length; j += 2) {
        const stat = parts[j].replace(/^trust_/, ''); // relationship alias
        if (stat && !stat.startsWith('+') && !stat.startsWith('-') && !VALID_SOUL_STATS.has(stat)) {
          // Only warn on things that look like stat names (not relationship shorthands)
          if (!stat.includes('_') && !/^\d/.test(stat)) {
            issues.push({
              file: filePath,
              line: lineNum,
              message: `unknown soul stat: "${stat}"`,
              level: 'warn',
            });
          }
        }
      }
      continue;
    }
  }

  return { scenes, gotos, issues };
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

function validate(): boolean {
  const files = walkDir(STORY_DIR);
  const allScenes = new Map<string, SceneEntry>(); // id → first entry
  const allGotos: GotoEntry[] = [];
  const allIssues: Issue[] = [];

  for (const file of files) {
    const { scenes, gotos, issues } = parseFile(file);

    for (const scene of scenes) {
      if (allScenes.has(scene.id)) {
        const existing = allScenes.get(scene.id)!;
        allIssues.push({
          file: scene.file,
          line: scene.line,
          message: `duplicate scene ID "${scene.id}" (first defined at ${shortPath(existing.file)}:${existing.line})`,
          level: 'error',
        });
      } else {
        allScenes.set(scene.id, scene);
      }
    }

    allGotos.push(...gotos);
    allIssues.push(...issues);
  }

  // Resolve gotos
  for (const g of allGotos) {
    if (!allScenes.has(g.target)) {
      allIssues.push({
        file: g.file,
        line: g.line,
        message: `unresolved goto target: "${g.target}"`,
        level: 'error',
      });
    }
  }

  // Report
  const errors = allIssues.filter((i) => i.level === 'error');
  const warns = allIssues.filter((i) => i.level === 'warn');

  if (warns.length > 0) {
    console.log('\nWarnings:');
    for (const w of warns) {
      console.log(`  WARN  ${shortPath(w.file)}:${w.line}  ${w.message}`);
    }
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const e of errors) {
      console.error(`  ERROR ${shortPath(e.file)}:${e.line}  ${e.message}`);
    }
    console.log(`\n✗ Validation failed — ${errors.length} error(s), ${warns.length} warning(s)`);
    return false;
  }

  console.log(`✓ ${allScenes.size} scenes validated across ${files.length} files — ${warns.length} warning(s), 0 errors`);
  return true;
}

const ok = validate();
process.exit(ok ? 0 : 1);
