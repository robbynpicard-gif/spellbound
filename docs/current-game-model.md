# Current game model — approved gameplay baseline

Updated 2026-11-19. This document is the concise current gameplay contract. Earlier GDD, decisions, and development-log entries remain as historical records; when they conflict with this document, newer accepted owner decisions and verified implementation take precedence. Do not treat older prototype descriptions as current requirements.

## Identity and priorities

A readable, skill-first fantasy typing game with intuitive magical interactions where useful. Gameplay feel, consistency, and testing precede art polish or speculative new systems. Browser game built with Phaser, TypeScript, Vite. Desktop keyboard first. No mobile keyboard is currently approved; the experiment was reverted.

## Modes and campaign

Normal and Hardcore each contain five stages, twenty levels per stage. Levels 1–19 use quotas; level 20 is a timed boss. The stage is a run; score, scrolls, combo, clean streak and surviving words carry between levels as configured. Hardcore damage persists within a stage, with designated healing breaks. Normal supports number-key quick-cast 1–8 and typed spell names; Hardcore uses typed spell names. Player-customizable spell slots are stored in settings.

Boss victory occurs when the survival timer expires. The player sees the victory screen and explicitly chooses whether to continue into Endless. Selecting Endless resumes the exact frozen battlefield in the same scene and engine: preserve words, coordinates, speeds, spell charges, ward, combo, Volley and active spell effects. Endless begins at the boss's finishing pace, then escalates with captured words. Do not silently restart at level 19. An independent Endless Practice option also exists.

## Spell and scoring behavior

Eight spells: Slow, Ice, Barrier, Shock, Alter, Fire, Wind and Harvest. Charges share a pool that grows with clean captures. Fire burns lower-field words without quota progress; Harvest captures with quota progress. Ice cannot cast on an empty field; Ice and Slow affect the boss clock differently. Summon produces ordinary non-spell scrolls; Emergency Summon produces a guaranteed spell scroll subject to cooldown/eligibility. Combo, Clean Streak, Volley, and bonus categories reward accurate fast play. Volley has a brief grace when the field empties, without an artificial one-tick minimum maintenance window.

## Visual and accessibility principles

Falling words must remain readable. Spell scrolls are distinct; unusually fast ordinary scrolls receive a brass cue. Between-level summary screens preserve a visible frozen field behind a light dim. The recorded announcer remains deferred; the removed browser-speech announcer is not an active feature.

## Unfinished / not automatically approved

Broader environmental elemental physics, grammar-based medals and Triumphs, deployable scroll banks, experimental encounter types, recorded announcer assets, and fully hosted multiplayer require separate design and implementation work. Historic proposed ideas do not become accepted simply because they appear in old documents.

## Validation and deployment

Main is the live stable GitHub Pages root. The branch `design/nov-18-playtest-handoff` is the development source published at `/preview/`; `codex/gameplay-iteration` is not the canonical preview branch. Changes should be built, tested and committed to dev, then promoted to main. A GitHub merge is not proof that deployment or interactive gameplay succeeded. Run `npm run check` and playtest the boss-to-Endless and spell-key paths before declaring verified.
