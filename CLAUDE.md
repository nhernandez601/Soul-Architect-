# Soul Architect — CLAUDE.md

Visual Novel engine for a Psychological Dark Fantasy / Cosmic Horror game. React 18 + PixiJS renderer, custom SASL scripting language, Zustand state, Electron packaging.

## Commands

```bash
npm run dev              # Vite dev server (browser)
npm run build            # tsc -b && vite build (zero errors required)
npm run type-check       # tsc --noEmit only
npm run lint             # ESLint
npm run test             # Vitest
npm run electron:dev     # Electron + Vite concurrently
npm run electron:build   # Package Electron app
npm run story:validate   # Validate SASL scene files
npm install --ignore-scripts  # Required — Electron binary download fails in this environment
```

## Architecture

### Path Alias
`@t/*` → `src/types/*` (NOT `@types/*` — that namespace is reserved by DefinitelyTyped and causes TS6137). Configured in both `tsconfig.json` and `vite.config.ts`.

### Core Loop
```
Engine.boot(config)
  → registerServices()     dynamic imports, registry.register()
  → registry.initAll()     calls onInit() on each BaseService
  → registry.startAll()    calls onStart() on each BaseService
  → loadGameData()         seeds EndingSystem with ENDING_DEFINITIONS
  → engine.start()         rAF loop begins
```

### Service Pattern
All systems extend `BaseService` (`src/engine/core/BaseService.ts`).
- Constructor: `constructor(serviceName = 'Service')` — `serviceName` is **optional** with default
- Lifecycle hooks: `onInit()`, `onStart()`, `onDestroy()`, `onPause()`, `onResume()`
- Event subscription helper: `this.subscribe(event, handler)` — auto-unsubscribes on destroy
- Logging: `this.log()`, `this.warn()`, `this.error()` — prefixed with `[ServiceName]`
- Service lookup: `registry.get<T>('key')` from `src/engine/core/ServiceRegistry`

### EventBus
`src/engine/core/EventBus.ts` — typed `eventemitter3` wrapper.
All events are in `EngineEventMap`. **Add new events there before emitting them** — emitting an event not in the map requires `as never` casts (a red flag).

### State → React Bridge
- `GameStore` (`src/engine/core/GameStore.ts`) — Zustand + immer store, React-facing state
- `StoreSync` (`src/engine/core/StoreSync.ts`) — subscribes to EventBus, writes to GameStore
- Pattern: engine emits event → StoreSync → GameStore.set → React re-renders

### Key Services

| Key | File | Purpose |
|-----|------|---------|
| `soul` | `src/systems/soul/SoulSystem.ts` | Soul stat tracking, flags, condition evaluation |
| `relationship` | `src/systems/relationship/RelationshipSystem.ts` | Per-character affinity/trust |
| `scene` | `src/engine/scene/SceneManager.ts` | SASL scene execution |
| `dialogue` | `src/engine/dialogue/DialogueManager.ts` | Speaker/text rendering |
| `choice` | `src/engine/choice/ChoiceManager.ts` | Choice presentation + soul/relationship deltas |
| `save` | `src/engine/save/SaveManager.ts` | Save slots, auto-save, load |
| `ending` | `src/systems/ending/EndingSystem.ts` | Ending conditions, NG+ state |
| `postprocessing` | `src/engine/postprocessing/PostProcessingManager.ts` | PixiJS VFX + 9 CSS presets |
| `transition` | `src/engine/transition/TransitionManager.ts` | Fade/flash/iris scene transitions |
| `codex` | `src/systems/codex/CodexSystem.ts` | Lore unlock tracking |
| `quest` | `src/systems/quest/QuestSystem.ts` | Quest + objective state |
| `achievement` | `src/systems/achievement/AchievementSystem.ts` | Achievement unlock |

## Soul System

Soul stats (`src/types/soul.ts`): `purpose`, `compassion`, `hope`, `love`, `knowledge`, `memory`, `fear`, `shadow`, `pride`, `regret`, `light`, `faith`. (12 total — defaults vary; see `SoulSystem.ts` `DEFAULT_SOUL_STATS`.)

- `soul.applyDelta(delta, source)` — `source` arg is required
- `soul.getFlag(key)` — returns `boolean | string | number | undefined`
- `soul.evaluateCondition(condition: SoulCondition)` — evaluates `{ attribute, operator, value }`
- Flags are set via EventBus: `bus.emit('flag:set', { key, value })`
- `soul:attribute_change` payload: `{ attribute, oldValue, newValue }` — **no `delta` field**; compute `delta = newValue - oldValue`

## Ending System

Endings are registered at boot via `src/data/endingDefinitions.ts` → `Engine.loadGameData()`.

```typescript
interface EndingDefinition {
  id: ID; title: string; subtitle: string; description: string;
  category: 'true' | 'good' | 'neutral' | 'bad' | 'secret' | 'joke';
  conditions: { soul?: SoulCondition[]; flags?: Record<string, boolean|string|number>; requiresNGPlus?: boolean; };
  triggerScene: ID; isSecret: boolean; artPath?: string; musicId?: string;
}
```

Endings trigger when `scene:end` fires with a `sceneId` matching `def.triggerScene` and conditions pass. NG+ begins via `endingSystem.beginNGPlus(carryFlagKeys)`.

## VFX / Post-Processing

- **CSS layer** (`src/ui/components/ScreenTransition.tsx`): `VFXOverlay` renders vignette + SVG film grain. Always mounted in `App.tsx`.
- **PixiJS layer** (`src/engine/postprocessing/PostProcessingManager.ts`): `ColorMatrixFilter` pipeline. Connect with `postprocessing.connectApp(pixiApp)`.
- **Presets** (`src/engine/postprocessing/VFXPresets.ts`): `default | horror | dream | corruption | divine | memory | void | noir | warm`
- Switch preset: `bus.emit('postprocessing:preset', { preset: 'horror' })`

## Transitions

`TransitionManager` drives timing; `ScreenTransition` React component renders the overlay.

```typescript
// Via bus (from SASL or engine code)
bus.emit('transition:start', { style: 'fade', durationMs: 800, color: 0x000000 });
// Direct call
const tm = registry.get<TransitionManager>('transition');
await tm.run({ style: 'iris', durationMs: 600 }, onMidpoint);
```

## SASL Scripting

Story files live in `story/`. Parsed by `src/scripting/parser/ScriptParser.ts` (lexer + recursive-descent parser → `SceneDefinition[]`). Executed at runtime by `src/engine/scene/SceneManager.ts`.

**Parser features (all wired to runtime node executors):**
- Comments: `//` and `#` (skipped by both lexer and the multi-line-string collapse pass).
- Multi-line strings: a quoted string may span several physical lines; continuation-line indentation is collapsed to a single space.
- Speaker forms: same-line `nyx "..."`, own-line `nyx` then an indented string, and explicit `dialogue nyx "..."` / `narrator "..."`.
- Directives → nodes: `soul`, `relationship` → `relationship_change`, `flag` → `flag_set`, `codex unlock` → `codex_unlock`, `achievement unlock` → `achievement_unlock`, `weather` → `weather_change` (atmospheric label mapped onto `WeatherType`), `music`, `show`/`hide`, `wait`, `goto`.
- `if <expr> ... end`: each body statement is tagged with the parsed `SoulCondition[]` + `skipOnConditionFail` so a conditional `goto` falls through when conditions aren't met (chained `if` blocks + a trailing unconditional `goto` = an if/elif/else dispatcher). Operators: `>= <= == != > <`, joined by `and`; optional `soul.` prefix.
- Choice options carry `soulDelta`, `relationshipDeltas`, `flagsSet`, and `gotoSceneId` (option `goto` targets a scene; `SceneManager.execChoice` calls `loadScene`).
- Unrecognized directive lines (e.g. `require`, `fade_in`, `ending_title`) are skipped at line granularity.

```sasl
scene scene_id
  background "asset_key"
  music "music_key"
  show character_name position:center emotion:happy
  narrator "Text..."
  character_name "Dialogue..."
  soul purpose +5 compassion +3
  relationship nyx trust +8
  flag flag_name true
  codex unlock "entry_id"
  achievement unlock "ach_id"
  choice "Prompt text"
    option "Option label" id:option_id
      soul love +4
      goto other_scene
  end
  goto next_scene
  end
```

Conditional branching in scenes:
```sasl
if soul.purpose >= 30 and soul.compassion >= 20
  goto ending_check_true_seeker
end
goto chapter_02_start
```

## Chapter 1 Scenes (complete)

| File | Scene IDs | Notes |
|------|-----------|-------|
| `story/scenes/chapter_01_start.sasl` | `chapter_01_start` + 4 branches | Sanctuary entry |
| `story/scenes/chapter_01_sanctuary.sasl` | `chapter_01_sanctuary_*` → `chapter_01_the_chamber` | Interior + Heart Mirror |
| `story/scenes/chapter_01_voice_return.sasl` | `chapter_01_voice_return` + 4 branches → `chapter_01_voice_convergence` | Voice through mirror |
| `story/scenes/chapter_01_nyx_01.sasl` | `chapter_01_nyx_01` + 4 branches → `nyx01_end` | Nyx relationship scene |
| `story/scenes/chapter_01_echo_dreamscape.sasl` | `chapter_01_echo_dreamscape` + 4 branches → `echo01_convergence` | Echo first contact |
| `story/scenes/chapter_01_crossroads.sasl` | `chapter_01_crossroads` + east/west/center/delegate branches → `chapter_01_end` | Mirror District; `chapter_01_end` → `chapter_02_start` |

## Chapter 2 Scenes (complete)

"The Name Below the Names." Chapter 1 (`chapter_01_end`) now always flows into Chapter 2; **all endings are reached through the Chapter 2 finale dispatcher**, not from Chapter 1.

| File | Scene IDs | Notes |
|------|-----------|-------|
| `story/scenes/chapter_02_start.sasl` | `chapter_02_start` + name branches → `chapter_02_first_steps` | The recurring dream-name |
| `story/scenes/chapter_02_the_name.sasl` | `chapter_02_descent` (companion branches) → `chapter_02_the_first_room` → `chapter_02_the_inscription` → `chapter_02_confrontation` → `chapter_02_finale` | Descent, the First Architect's chamber, the climax, and the ending dispatcher |

`chapter_02_finale` is an `if`-dispatcher (most-specific first): transcendent (NG+ + all stats ≥ 40) → corrupted (shadow ≥ 60) → `ending_check_true_seeker` (purpose ≥ 50, compassion ≥ 40) → guardian (compassion ≥ 50, love ≥ 40, fear ≤ 20) → neutral fallback. Each branch's conditions mirror the `EndingSystem` definitions so the reached scene triggers its ending.

## Endings (registered)

| ID | Category | Trigger Scene | Key Conditions |
|----|----------|--------------|----------------|
| `ending_true_seeker` | true | `ending_check_true_seeker` | purpose ≥ 50, compassion ≥ 40 |
| `ending_good_guardian` | good | `ending_guardian_approach` | compassion ≥ 50, love ≥ 40, fear ≤ 20 |
| `ending_neutral_threshold` | neutral | `ending_neutral_threshold` | (none — fallback) |
| `ending_corrupted` | bad | `ending_corrupted_approach` | shadow ≥ 60 |
| `ending_transcendent` | secret | `ending_transcendent_approach` | NG+, all stats ≥ 40, all_codex_unlocked |

## Codex Entries (registered)

10 entries in `src/data/codexDefinitions.ts`, loaded via `Engine.loadGameData()`:
`the_voice`, `echo`, `the_void_between`, `the_fracture`, `the_heart_mirror_truth`,
`the_first_architect`, `true_nature_of_the_architect`, `the_architecture_of_thresholds`,
`the_shattered_mirror_district`, `the_mirror_naming`.

## UI Screens

All screens are in `src/ui/screens/`. Mounted in `App.tsx` based on `activeScreen` (Zustand).

| Screen | activeScreen / overlayScreen |
|--------|------------------------------|
| `LoadingScreen` | `'loading'` |
| `MainMenuScreen` | `'main-menu'` |
| `GameScreen` | `'game'` |
| `EndingScreen` | `'ending'` |
| `CodexScreen` | overlay `'codex'` |
| `JournalScreen` | overlay `'journal'` |
| `GalleryScreen` | overlay `'gallery'` |
| `QuestLogScreen` | overlay `'quest'` |
| `SaveLoadScreen` | overlay `'save'` / `'load'` |
| `SettingsScreen` | overlay `'settings'` |
| `AchievementScreen` | overlay `'achievement'` |

Open an overlay: `useGameStore.getState().openMenu('codex')`.

## Types

`src/types/` — import with `@t/` alias:
- `@t/core` — `ID`, `EngineConfig`, `SaveConfig`, `EngineState`, etc.
- `@t/soul` — `SoulStats`, `SoulState`, `SoulCondition`, `SoulArchetype`
- `@t/character` — `CharacterID`, `CharacterRuntimeState`, `CharacterStats`
- `@t/scene` — `SceneDefinition`, `DialogueLine`, `ChoiceOption`
- `@t/save` — `SaveSlot`, `JournalEntry`, `GameSaveData`

## Build Notes

- `npm run build` must produce **zero TypeScript errors** before any commit
- Chunk size warnings for `pixi`, `animation`, `react-vendor` are expected — don't add `chunkSizeWarningLimit` workarounds
- `src/vite-env.d.ts` provides `import.meta.env` types (triple-slash reference to `vite/client`)
- `*.tsbuildinfo` is gitignored
- `npm install --ignore-scripts` is required in this environment (Electron postinstall downloads a binary that fails)

## Development Branch Convention

Phase branches: `claude/phase-N-description`
- Phase 1: core engine architecture
- Phase 2: game systems, UI screens, build fix
- Phase 3: EndingSystem, VFX, transitions, Chapter 1 story (merged)
