# SPELLBOUND
## Game Design Document & Claude Code Development Instructions

**Document version:** 1.0  
**Project status:** Pre-development  
**Working title:** Spellbound  
**Genre:** Arcade Typing / Fantasy / Multiplayer  
**Platform:** Web browser (desktop-first)  
**Development environment:** Claude Code + VS Code  
**Primary objective:** Create an original, modern spiritual successor to MetroGames' Typing Maniac.

> Implementation notes: where the code deliberately differs from this document,
> the reason is recorded in `docs/decisions.md`.

---

# PART I — PROJECT OVERVIEW

## 1. Project vision

Develop a polished browser-based typing game inspired by the original MetroGames game, Typing Maniac.

The game must preserve the original's fundamental gameplay loop while introducing an original wizarding, alchemy and fantasy theme, additional gameplay mechanics, expanded spell systems, endless practice and online multiplayer.

The intended experience should feel like a complete indie game rather than a simple typing-game clone.

The player assumes the role of an apprentice wizard defending a magical tower against incoming spells, curses and magical manifestations.

Words descend from the top of the playing field. Players must type the words correctly to cast counterspells and eliminate them before they reach the bottom of the screen.

As the game progresses:
- Words fall faster.
- Word lengths increase.
- More words appear simultaneously.
- Special magical modifiers are introduced.
- The player must manage limited spell resources.
- Mistakes become increasingly costly.

The fundamental gameplay should remain recognizable to anyone familiar with Typing Maniac.

## 2. Core design principles

These principles should guide all development decisions.

1. **Preserve the original gameplay.** The fundamental falling-word typing mechanic is the foundation of the project.
2. **Build an original identity.** Do not simply reskin Typing Maniac. Develop a cohesive wizarding world, original artwork, animations, sound and branding.
3. **Prioritize gameplay readability.** Words must always remain legible.
4. **Make difficulty consistent.** Identical difficulty configurations must produce identical gameplay parameters across game modes.
5. **Design for expansion.** New spells, modifiers, levels and game modes should be addable without rewriting the game engine.
6. **Support multiplayer from the beginning.** Multiplayer must be considered in the initial architecture, even when certain features are implemented in later milestones.
7. **Keep the game accessible.** Keyboard-first gameplay, configurable settings and clear feedback are essential.
8. **Avoid unnecessary complexity.** The game should remain focused on typing skill, speed, accuracy and decision-making.

## 3. Working title and identity

Working title: **Spellbound**

Theme:
- Wizardry
- Alchemy
- Arcane magic
- Enchanted libraries
- Magical towers
- Ancient spellbooks
- Mystical creatures
- Elemental magic

Visual direction:
- Polished modern indie game.
- Dark academia mixed with high fantasy.
- Atmospheric environments.
- Antique parchment and illuminated manuscripts.
- Rich magical effects.
- Elegant typography.
- Restrained and consistent UI.

The title is provisional and should not be considered final branding.

---

# PART II — TECHNICAL ARCHITECTURE

## 4. Technology stack

Use the following technology stack unless a significant technical limitation is identified.

| Technology | Purpose |
|---|---|
| TypeScript | Primary programming language |
| Phaser 3 | 2D game engine and rendering |
| Vite | Development server and build tooling |
| HTML5 | Application structure |
| CSS | Menus, interface and styling |
| Node.js | Multiplayer server runtime |
| WebSockets | Real-time multiplayer communication |
| Git | Version control |
| GitHub | Repository and source control |
| GitHub Pages | Static game hosting |

Use a stable, mutually compatible set of package versions. Document the selected versions in the project.

Do not introduce additional frameworks without a clear technical justification.

## 5. Architecture requirements

The game must be modular.

Separate:
- Game logic.
- Rendering.
- User interface.
- Input processing.
- Word generation.
- Difficulty management.
- Scoring.
- Spells.
- Modifiers.
- Game modes.
- Multiplayer networking.
- Persistent data.

The same gameplay rules must be reusable across campaign, practice and multiplayer.

Avoid placing all game logic inside a single Phaser scene or JavaScript file.

### Proposed project structure

```text
spellbound/
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
│
├── public/
│   └── assets/
│       ├── backgrounds/
│       ├── spells/
│       ├── modifiers/
│       ├── particles/
│       ├── creatures/
│       ├── audio/
│       └── fonts/
│
├── src/
│   ├── main.ts
│   │
│   ├── core/
│   │   ├── GameEngine.ts
│   │   ├── GameState.ts
│   │   ├── GameConfig.ts
│   │   └── EventBus.ts
│   │
│   ├── gameplay/
│   │   ├── Word.ts
│   │   ├── WordManager.ts
│   │   ├── WordGenerator.ts
│   │   ├── InputManager.ts
│   │   ├── TargetManager.ts
│   │   ├── ScoringSystem.ts
│   │   ├── InstabilityManager.ts
│   │   ├── SpellManager.ts
│   │   └── ModifierManager.ts
│   │
│   ├── difficulty/
│   │   ├── DifficultyConfig.ts
│   │   ├── LevelManager.ts
│   │   └── LevelDefinitions.ts
│   │
│   ├── modes/
│   │   ├── CampaignMode.ts
│   │   ├── PracticeMode.ts
│   │   ├── DuelMode.ts
│   │   └── CooperativeMode.ts
│   │
│   ├── spells/
│   │   ├── BaseSpell.ts
│   │   ├── FireSpell.ts
│   │   ├── IceSpell.ts
│   │   ├── SlowSpell.ts
│   │   ├── WindSpell.ts
│   │   └── AdditionalSpells.ts
│   │
│   ├── modifiers/
│   │   ├── BaseModifier.ts
│   │   ├── VolatileModifier.ts
│   │   ├── CursedModifier.ts
│   │   ├── ShieldedModifier.ts
│   │   ├── ConduitModifier.ts
│   │   └── IllusionModifier.ts
│   │
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MainMenuScene.ts
│   │   ├── GameScene.ts
│   │   ├── PracticeSetupScene.ts
│   │   └── ResultsScene.ts
│   │
│   ├── ui/
│   │   ├── GameHUD.ts
│   │   ├── SpellInventory.ts
│   │   ├── MainMenu.ts
│   │   ├── ResultsPanel.ts
│   │   └── SettingsPanel.ts
│   │
│   ├── multiplayer/
│   │   ├── NetworkClient.ts
│   │   ├── RoomManager.ts
│   │   ├── MatchManager.ts
│   │   └── GameSynchronizer.ts
│   │
│   ├── data/
│   │   ├── words.json
│   │   ├── levels.json
│   │   └── spells.json
│   │
│   ├── storage/
│   │   ├── SaveManager.ts
│   │   └── StatisticsManager.ts
│   │
│   └── styles/
│       ├── main.css
│       ├── menu.css
│       └── gameplay.css
│
└── server/
    ├── index.ts
    ├── rooms.ts
    ├── match.ts
    └── validation.ts
```

This structure is a starting point. Claude may recommend changes if they improve maintainability, but architectural changes must be explained and documented.

## 6. Architecture rules

- Use TypeScript types and interfaces consistently.
- Avoid unnecessary global variables.
- Use a centralized game state.
- Use a centralized difficulty configuration.
- Use a centralized spell registry.
- Use a centralized modifier registry.
- Avoid duplicating gameplay logic between modes.
- Use configuration files instead of hardcoding individual level parameters.
- Separate multiplayer networking from gameplay mechanics.
- Use deterministic random seeds where reproducibility is required.
- Keep the game playable locally without a multiplayer server.
- Do not introduce authentication or database infrastructure until required by a concrete feature.

### Multiplayer architecture

The client must not be trusted to determine authoritative match results.

The multiplayer server should validate:
- Match state.
- Word generation.
- Typing events.
- Scoring.
- Spell activation.
- Match completion.
- Final results.

Use WebSockets for real-time communication.

For multiplayer, use a shared random seed and synchronized match start. The server must ensure both players receive equivalent word sequences and difficulty conditions.

Do not transmit raw keystrokes unnecessarily. Send the minimum information needed to validate gameplay.

---

# PART III — GAMEPLAY DESIGN

## 7. Core gameplay loop

The core gameplay must reproduce the fundamental Typing Maniac experience.

1. Words spawn at the top of the playing field.
2. Words descend toward the bottom.
3. The player identifies a target.
4. The player types the target word.
5. Correctly typed characters are highlighted.
6. Completing a word destroys it.
7. The player receives points.
8. Missed words increase tower instability.
9. The game continues until the level quota is completed or instability reaches 100%.

### Word objects

Each word must have:
- Unique identifier.
- Text.
- Position.
- Movement speed.
- Target status.
- Current typing progress.
- Difficulty classification.
- Modifier classification, if applicable.
- Spawn timestamp.

Words should support smooth movement and responsive visual feedback.

### Target selection

Implement automatic target selection as the default approach.

The player should be able to click a word to explicitly select it.

The targeting system must:
- Avoid accidental target switching while typing.
- Prioritize the current partially typed word.
- Provide clear visual target indication.
- Handle overlapping or matching word prefixes predictably.

### Typing feedback

- Correct characters should be highlighted.
- Incorrect input should be visually communicated.
- The currently selected target should be obvious.
- Completing a word should trigger a satisfying destruction animation.
- Input should be responsive and not blocked by unnecessary animations.

### Error handling

Support configurable consequences for:
- Incorrect character.
- Incorrect word submission.
- Abandoned partial word.
- Missed word.

The original game reportedly accelerates a word after certain mistakes. This behaviour must be investigated and reproduced where confirmed.

Do not invent additional penalties without documenting their purpose.

## 8. Tower instability

Replace the conventional health bar with a magical instability meter.

Every word that reaches the bottom increases instability.

At 100%, the player's defensive wards collapse and the game ends.

Visual stages:

| Instability | Visual state |
|---|---|
| 0–24% | Stable magical environment |
| 25–49% | Minor disturbances |
| 50–74% | Increasing magical instability |
| 75–99% | Critical ward failure warnings |
| 100% | Tower defence collapses |

These stages should affect the environment through subtle visual effects, lighting, sound and animations.

Do not make the effects obstruct the words.

The amount of instability added per missed word must be configurable.

## 9. Campaign mode

Campaign mode is the traditional progressive experience.

Each level contains a defined difficulty configuration.

A level is completed when the player reaches its required word quota.

A level is failed when instability reaches 100%.

Each level must define:

- Level number.
- Required words.
- Initial falling speed.
- Word spawn interval.
- Maximum simultaneous words.
- Minimum and maximum word lengths.
- Word length distribution.
- Special modifier probabilities.
- Error penalties.
- Instability penalties.
- Available spells.
- Difficulty-specific settings.

Create at least 10 initial levels.

These levels must demonstrate progressive difficulty rather than arbitrary parameter changes.

Do not invent a final level cap yet. The architecture should support additional levels.

### Difficulty configuration

Create a reusable DifficultyConfig interface.

Example:

```ts
interface DifficultyConfig {
  level: number;
  requiredWords: number;
  initialFallSpeed: number;
  spawnInterval: number;
  maxActiveWords: number;
  minWordLength: number;
  maxWordLength: number;
  modifierProbabilities: Record<string, number>;
  instabilityPerMiss: number;
  errorAcceleration: number;
}
```

Additional parameters may be introduced as required.

All game modes must consume these configurations rather than implementing their own independent difficulty calculations.

---

# PART IV — SPELL SYSTEM

## 10. Original power-ups

All four original Typing Maniac power-ups must be retained.

Reinterpret them as wizard spells.

The exact original effects must be verified through research of the original game before final implementation.

### 10.1 Fire — Incineration

Intended effect: Burns away words on the playing field.

Visual:
- Magical fireball or flame wave.
- Words ignite and disappear.
- Orange and red particle effects.

The original's precise targeting and coverage must be verified.

### 10.2 Ice — Frostbinding

Intended effect: Temporarily freezes falling words.

Visual:
- Ice spreads across the playing field.
- Words become encased in frost.
- Movement resumes after the effect expires.

### 10.3 Slow — Temporal Distortion

Intended effect: Temporarily slows the movement of words.

Visual:
- Purple/blue temporal energy.
- Distorted time effects.
- Brief screen-wide animation.

### 10.4 Wind — Arcane Purge

Intended effect: Reproduce the original Wind Book's defensive effect.

The historical descriptions suggest that it removes errors, but this must be verified.

Do not finalize its behaviour until the original game has been inspected.

Visual:
- Powerful gust of magical wind.
- Words or visual effects swept away as appropriate.

### Spell inventory

- Maintain a separate inventory count for each spell.
- Maximum of three charges per original spell initially.
- Allow spell activation using keyboard shortcuts.
- Display inventory counts in the HUD.
- Provide clear activation feedback.
- Prevent activation when inventory is empty.
- Ensure spell effects are consistent and predictable.

Spell charges may be collected through gameplay, rewards or other explicitly defined mechanics.

---

# PART V — NEW MAGIC AND ALCHEMICAL MODIFIERS

## 11. Special word modifiers

Introduce additional word behaviours that fit the wizarding and alchemy theme.

Modifiers should be data-driven and modular.

### 11.1 Volatile Words

Dangerous unstable words.

- Create an increased instability penalty if missed.
- Visually indicate volatility.
- Provide a higher score or reward for successful elimination.

### 11.2 Cursed Words

Words affected by magical curses.

- May require a special condition before normal elimination.
- Must communicate their special behaviour clearly.
- Can be countered through future cleansing spells.

### 11.3 Shielded Words

Words protected by magical barriers.

- Require additional typing sequences or another clearly defined condition.
- Visually communicate remaining protection.
- Should not introduce arbitrary or confusing input requirements.

### 11.4 Conduit Words

Words connected to other magical manifestations.

- Destroying a conduit triggers a chain reaction.
- Can destroy nearby words.
- Requires clear visual indication of connected targets.

### 11.5 Illusion Words

Words affected by illusion magic.

- May periodically change appearance.
- May disguise themselves.
- Must remain fair and readable.
- Avoid changing the underlying input unexpectedly while a player is typing.

Introduce these modifiers progressively through campaign progression.

Do not introduce all modifiers in the initial prototype.

## 12. Additional collectible spells

Future spell candidates:

| Spell | Intended effect |
|---|---|
| Chain Lightning | Destroys nearby words |
| Arcane Shield | Absorbs the next missed word |
| Transmutation | Converts a dangerous word into a harmless one |
| Alchemical Cleansing | Removes curses |
| Meteor | Destroys words in a selected area |
| Rejuvenation | Reduces tower instability |

These spells are proposed features, not finalized balancing decisions.

Implement them only after the original spell system works reliably.

---

# PART VI — GAME MODES

## 13. Campaign

Traditional level-based progression.

Requirements:
- Progressive difficulty.
- Level-specific word quotas.
- Unlockable modifiers.
- Unlockable spells.
- Performance tracking.
- Level completion screens.
- Persistent progress.

## 14. Endless Practice

This is a core feature, not an optional future enhancement.

Players must be able to select any available campaign level and practice indefinitely at that level's difficulty.

### Practice configuration

The player selects:
- Starting level.
- Modifier selection.

Potential modifier options:
- All available modifiers.
- Original modifiers only.
- No special modifiers.

### Exact difficulty matching

Practice Mode must load the same DifficultyConfig used by the selected campaign level.

This includes:
- Falling speed.
- Word spawn frequency.
- Maximum simultaneous words.
- Word length distribution.
- Modifier probability.
- Error penalties.
- Other relevant difficulty parameters.

Practice must not use an approximate speed multiplier.

### Endless behaviour

- No automatic level progression.
- The selected difficulty remains fixed.
- The word generation continues indefinitely.
- The player can pause or end the session.
- Instability can still reach 100%.
- Practice statistics are recorded separately from campaign results.

### Practice statistics

Record:
- Score.
- Words completed.
- Words missed.
- Accuracy.
- Words per minute.
- Average word completion time.
- Longest combo.
- Time survived.
- Selected level.

Maintain a personal best for each practice level.

Practice records must not automatically count as campaign records.

## 15. Multiplayer

Multiplayer is a fundamental project requirement.

Build the architecture to support multiplayer from the beginning.

### 15.1 Wizard Duel

Two players compete against each other.

Requirements:
- Private room creation.
- Join using room code.
- Synchronized match start.
- Identical word sequences.
- Identical difficulty settings.
- Independent player instability.
- Independent scoring.
- Optional offensive spells.
- Match completion and results.

Victory conditions:
- First player to reach 100% instability loses.
- If both players fail simultaneously, apply a clearly defined tie-breaker.
- If a player disconnects, handle the match gracefully.

Offensive spells should be balanced carefully and should not make the match depend primarily on luck.

### 15.2 Cooperative Tower Defence

Two players defend the same tower.

Requirements:
- Shared instability.
- Shared defensive objective.
- Both players contribute to word elimination.
- Coordinated spell usage.
- Increasing difficulty.
- Survival-based scoring.

The exact cooperative input and word ownership rules should be documented before implementation.

### Multiplayer development priority

Implement in this order:

1. Networking foundation.
2. Room creation and joining.
3. Synchronized match start.
4. Two-player Wizard Duel.
5. Match result validation.
6. Cooperative mode.

Single-player must always remain functional without an active network connection.

---

# PART VII — VISUAL AND AUDIO DIRECTION

## 16. Art direction

The game should combine dark academia and high fantasy.

Visual references:
- Enchanted wizard towers.
- Ancient libraries.
- Alchemical laboratories.
- Illuminated manuscripts.
- Floating magical objects.
- Glowing runes.
- Magical candles.
- Arcane energy.
- Antique spellbooks.

Use original assets.

Do not simply extract and reuse copyrighted artwork, sounds, branding or other assets from Typing Maniac.

### Colour palette

| Element | Direction |
|---|---|
| Main background | Deep charcoal / midnight |
| Primary accent | Antique gold |
| Secondary accent | Arcane purple |
| Fire | Orange / red |
| Ice | Blue / cyan |
| Wind | Teal / pale green |
| Danger | Crimson |
| Positive feedback | Gold / soft green |

### Typography

Use:
- Elegant fantasy typography for headings.
- Highly legible sans-serif or similarly readable typography for gameplay words.
- Consistent visual hierarchy.

Never prioritize decorative fonts over typing readability.

## 17. Interface screens

Develop the following screens.

### Main menu

Options:
- Campaign.
- Endless Practice.
- Multiplayer.
- Spellbook.
- Settings.
- Credits.

### Gameplay HUD

Display:
- Current level.
- Score.
- Words completed.
- Instability meter.
- Spell inventory.
- Current combo.
- Pause control.

The playing field must occupy the majority of the screen.

### Spellbook

Display:
- Original spells.
- Additional spells.
- Descriptions.
- Unlock status.
- Usage information.

### Results screen

Display:
- Final score.
- Accuracy.
- WPM.
- Words completed.
- Words missed.
- Longest combo.
- Personal best.
- Rewards.
- Retry and return-to-menu options.

### Multiplayer lobby

Display:
- Create room.
- Join room.
- Room code.
- Player status.
- Match settings.
- Ready status.

---

# PART VIII — PROGRESSION AND STATISTICS

## 18. Achievements

Initial achievement ideas:

| Achievement | Requirement |
|---|---|
| Apprentice | Complete first level |
| Quick Incantation | Reach 60 WPM |
| Perfectionist | Complete a level without errors |
| Pyromancer | Destroy 25 words using Fire |
| Untouchable | Complete five levels without missing a word |
| Archmage | Complete the final campaign challenge |

Achievement requirements should be configurable.

## 19. Statistics

Track:
- Total words typed.
- Total words completed.
- Total words missed.
- Overall accuracy.
- Average WPM.
- Best WPM.
- Total playtime.
- Highest campaign level.
- Highest score.
- Spell usage.
- Practice records.

Initially, single-player statistics should be stored locally.

Online leaderboards can be introduced through the multiplayer server.

---

# PART IX — ORIGINAL GAME RESEARCH

## 20. Reverse-engineering Typing Maniac

The original MetroGames game is our primary gameplay reference.

Research must be conducted before finalizing uncertain mechanics.

Known historical information suggests:
- Words descend from the top of the screen.
- Completed words are eliminated.
- Missed words accumulate at the bottom.
- Accumulation eventually ends the game.
- Incorrect typing can accelerate words.
- The game contains Fire, Ice, Slow and Wind power-ups.
- The original includes progressive levels and scoring bonuses.

These are historical reference points, not a substitute for direct verification.

### Research source

An archived SWF has been identified in a game-preservation archive.

Historical source URL:

`https://games.coolgames.com/typing-maniac/en/1.0/typing-maniac.swf`

Archive reference:

`https://9o3o.com/games/typing-maniac`

### Research objectives

Investigate:

1. Original word movement.
2. Word targeting.
3. Keyboard input behaviour.
4. Incorrect typing penalties.
5. Word acceleration.
6. Level completion requirements.
7. Difficulty scaling.
8. Scoring and bonuses.
9. Fire Book behaviour.
10. Ice Book behaviour.
11. Slow Book behaviour.
12. Wind Book behaviour.
13. Spell inventory limits.
14. Special word types.
15. Original audio and visual effects.

### Research methodology

Use an appropriate Flash/SWF inspection tool or compatible emulator.

Possible tools include:
- Ruffle for compatible Flash playback.
- JPEXS Free Flash Decompiler for SWF inspection.
- Browser-based archival sources.
- Historical gameplay recordings.

Do not assume every original feature can be recovered.

If something cannot be verified, document it as unknown and propose a reasonable implementation.

Create:

`docs/original-game-research.md`

Include:
- Verified mechanics.
- Historical descriptions.
- Unverified mechanics.
- Observations.
- Screenshots or references where legally appropriate.
- Proposed adaptations.

Do not spend excessive time attempting to recover original editable source code if the compiled SWF provides sufficient information.

---

# PART X — DEVELOPMENT ROADMAP

## 21. Milestone 0: Project initialization

Objectives:
- Inspect the existing development environment.
- Establish the Git repository.
- Set up Vite, TypeScript and Phaser.
- Create the initial folder structure.
- Establish development scripts.
- Create project documentation.

Acceptance criteria:
- Application starts locally.
- Phaser initializes successfully.
- No build errors.
- Git repository is initialized.
- README explains how to run the project.

Do not begin implementing all game mechanics in this milestone.

## 22. Milestone 1: Core gameplay prototype

Implement:
- Game field.
- Word generation.
- Falling words.
- Keyboard input.
- Target selection.
- Character highlighting.
- Word destruction.
- Instability.
- Game-over condition.
- Basic scoring.

Acceptance criteria:
- Words spawn and move correctly.
- Typing a complete word eliminates it.
- Incorrect input behaves consistently.
- Missed words increase instability.
- Game ends at the defined failure condition.
- Gameplay remains responsive.

This is the first playable milestone.

## 23. Milestone 2: Campaign and difficulty

Implement:
- DifficultyConfig.
- At least 10 initial levels.
- Word quotas.
- Level transitions.
- Progressive difficulty.
- Results screen.
- Persistent campaign progress.

Acceptance criteria:
- Levels use configuration data.
- Difficulty increases progressively.
- Completing a quota advances the player.
- Failed levels produce correct results.
- Progress persists after refreshing the browser.

## 24. Milestone 3: Original spells

Implement:
- Fire.
- Ice.
- Slow.
- Wind.
- Spell inventory.
- Spell activation.
- Spell feedback.
- Spell animations.

Acceptance criteria:
- All four spells work.
- Inventory limits are enforced.
- Empty spells cannot be activated.
- Effects behave consistently.
- Original mechanics have been verified or documented as adaptations.

## 25. Milestone 4: Endless Practice

Implement:
- Level selection.
- Difficulty configuration loading.
- Endless gameplay.
- Modifier filters.
- Statistics.
- Personal records.

Acceptance criteria:
- Selected practice difficulty matches the corresponding campaign configuration.
- Practice does not automatically advance difficulty.
- Gameplay continues until the player fails or exits.
- Records are stored separately from campaign records.

## 26. Milestone 5: Multiplayer

Implement:
- Multiplayer server.
- WebSocket connection.
- Room creation.
- Room joining.
- Match synchronization.
- Wizard Duel.
- Result validation.
- Disconnect handling.

Acceptance criteria:
- Two players can join the same room.
- Both begin simultaneously.
- Both receive equivalent words and difficulty conditions.
- Server validates match results.
- Disconnects do not crash the application.

## 27. Milestone 6: Additional content

Implement:
- Alchemical modifiers.
- Additional spells.
- Achievements.
- Spellbook.
- Cooperative mode.
- Additional levels.

## 28. Milestone 7: Polish and deployment

Implement:
- Final visual assets.
- Animations.
- Audio.
- Settings.
- Accessibility improvements.
- Performance optimization.
- Responsive layouts.
- GitHub Pages deployment.
- Multiplayer server deployment.

---

# PART XI — CLAUDE CODE OPERATING INSTRUCTIONS

## 29. Your role

You are the lead software engineer responsible for implementing Spellbound.

The user is the project owner and has limited programming experience.

You must:
- Explain technical decisions clearly.
- Avoid unnecessary technical jargon.
- Work incrementally.
- Maintain a clean and maintainable codebase.
- Preserve previously working functionality.
- Document architectural decisions.
- Test features before declaring them complete.

Do not assume the user knows how to troubleshoot programming errors.

When terminal commands are required, provide the commands and briefly explain what they do.

## 30. Mandatory development rules

### Rule 1: Work incrementally

Never attempt to implement the entire game in one response.

Work through the development milestones.

Complete one coherent feature at a time.

### Rule 2: Inspect before modifying

Before modifying files:
- Inspect the existing project.
- Read relevant files.
- Understand the current architecture.
- Identify dependencies.
- Determine whether existing functionality will be affected.

Never blindly overwrite existing files.

### Rule 3: Preserve working functionality

Before making significant changes:
- Identify existing working features.
- Avoid unnecessary rewrites.
- Test affected systems.
- Resolve regressions before continuing.

### Rule 4: Maintain documentation

Maintain:

`README.md`

`docs/GDD.md`

`docs/architecture.md`

`docs/original-game-research.md`

`docs/development-log.md`

`docs/decisions.md`

Update documentation when architectural or gameplay decisions change.

### Rule 5: Use version control

Encourage regular Git commits at completed milestones.

Do not perform destructive Git operations without explicit user approval.

Never discard uncommitted user work.

### Rule 6: Avoid placeholders in completed features

A feature should not be marked complete simply because its interface exists.

It must actually function and pass its acceptance criteria.

Clearly identify temporary assets, mock data and unfinished systems.

### Rule 7: Explain dependencies

Before installing major dependencies, explain why they are needed.

Avoid unnecessary packages.

### Rule 8: Test continuously

After each feature:
- Run the development server.
- Run TypeScript checks.
- Run the production build.
- Test relevant gameplay behaviour.
- Fix errors before moving forward.

Introduce automated tests for important deterministic game logic.

### Rule 9: Keep multiplayer in mind

Do not build single-player systems in ways that prevent their reuse in multiplayer.

Game rules, difficulty configuration, scoring and spell behaviour should be independently testable.

### Rule 10: Ask before making major design changes

If a requirement is ambiguous or a proposed architectural change significantly alters the project, explain the alternatives and ask the user before proceeding.

Minor implementation details can be decided independently.

---

# PART XII — INITIAL CLAUDE CODE SESSION

## 31. First instruction

Begin by reading this entire document.

Do not immediately attempt to build the game.

Your first task is to establish the project foundation and prepare the development environment.

Perform the following steps:

**Step 1 — Inspect the environment**

- Determine the current operating system.
- Inspect the current working directory.
- Determine whether a Git repository already exists.
- Check Node.js and npm availability.
- Check whether VS Code and Claude Code are operating in the intended project directory.
- Identify any existing project files.

Do not overwrite or delete existing files.

**Step 2 — Assess the project**

Explain:
- What is already installed.
- What is missing.
- What needs to be configured.
- Whether the current environment is ready for development.

**Step 3 — Establish the architecture**

Propose the initial project structure using the architecture in this document.

Make any recommended changes explicit and explain why.

**Step 4 — Initialize the project**

Once the environment is understood, create the initial Vite + TypeScript + Phaser project.

Install the required dependencies.

Create the initial documentation files.

**Step 5 — Verify everything**

Run:
- Development server.
- TypeScript checks.
- Production build.

Confirm that Phaser initializes and the application loads successfully.

**Step 6 — Report completion**

Provide a concise report containing:
- Files created.
- Dependencies installed.
- Commands executed.
- Tests performed.
- Outstanding issues.
- Recommended next milestone.

Do not begin full gameplay implementation until the project foundation is verified.

---

# PART XIII — FUTURE DEVELOPMENT PROMPT FORMAT

## 32. How to approach subsequent development

For every subsequent milestone, follow this workflow:

1. Review the relevant requirements in this document.
2. Inspect the existing implementation.
3. Explain the intended changes.
4. Identify files to be created or modified.
5. Implement the feature.
6. Test the feature.
7. Fix errors and regressions.
8. Update documentation.
9. Summarize what changed.
10. Identify the next recommended task.

Do not implement multiple unrelated milestones simultaneously.

When a feature cannot be completed, explain why and identify what remains.

Do not claim that a feature works without testing it.

---

# FINAL PROJECT OBJECTIVE

Deliver a complete, polished, browser-based wizard-themed typing game that captures the addictive gameplay of MetroGames' Typing Maniac while establishing its own identity and expanding the experience.

The final game must include:

- Original campaign gameplay.
- Progressive difficulty.
- Four original power-ups reimagined as spells.
- Additional alchemical modifiers.
- Expanded collectible spells.
- Endless Practice with exact campaign-level difficulty matching.
- Player statistics and achievements.
- Online Wizard Duel multiplayer.
- Cooperative Tower Defence multiplayer.
- Original visual and audio assets.
- Persistent player records.
- A maintainable and documented codebase.
- Deployment through GitHub Pages and a separately hosted multiplayer server.

**The guiding principle: Preserve what made Typing Maniac fun. Build something entirely new around it.**
