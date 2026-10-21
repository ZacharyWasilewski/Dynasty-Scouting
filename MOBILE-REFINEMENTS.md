# Mobile and score-stage refinements

Base: the previously delivered `dynasty-database-completed.zip`, retaining the `scout-grid` project folder. This follow-up addresses the five reported issues and the completed-draft action-row overflow visible in the supplied recording.

## Changes

- **Mobile filters:** search, format and position remain readily available. Tier, evaluation stage, career outcome, outcome details and explanatory text sit behind a collapsed Advanced filters control on phones. The control shows the number of active advanced selections. Opening/closing it preserves selections; Clear resets all search filters while retaining league format. Desktop advanced controls remain visible.
- **Minimizing header:** a fixed header slides away over a stable document spacer. Hiding/revealing no longer changes document height, removing the scroll/layout feedback loop. Direction thresholds, transition guards, overscroll clamping and protection during button presses prevent unintended reversals. Open account menus stay usable. Anchor offsets measure the visible part of the header. Desktop retains a visible header.
- **Saved draft board:** saved and shared full-room snapshots render as team columns and round rows, with horizontally scrollable, keyboard-focusable boards on narrow screens. Original pick numbers, names, saved scores and user-pick highlighting are preserved. New saves also retain tier colors and player-image URLs. Previously saved full-room snapshots work without these optional additions; drafts that never recorded the full room continue to explain that limitation. Completed-draft action buttons wrap on phones so the board button remains reachable.
- **Homepage:** the existing Next Class Spotlight now separates Model Overview and Try Comparison. No section styling was changed.
- **Tier hit rates:** profile cohorts match the score stage actually displayed: DD, Pre-Draft or Raw, as well as position, tier and league format. Historical Pre-Draft/Raw cohorts use those historical scores, not final DD tiers or a replacement score. Draft-room rates likewise match the displayed DD/Pre-Draft stage. HIT / (HIT + MISS) excludes pushes and unresolved outcomes; empty samples display no rate. Existing small-sample notices remain.

No database migration, dependency upgrade, scoring coefficient, tier threshold, draft-engine or Railway configuration change is required. The prior exclusions for audit items 17 and 18 remain intact.

## Verification

- Reviewed all four supplied recordings and the displayed screenshots.
- 157 automated tests passed across 22 test files, including 16 new regression cases covering filter collapse/state/clearing, header transitions and button presses, overscroll, desktop reset, anchor geometry, saved-board placement for 8/12/16 teams, older snapshots, saved metadata, and stage cohorts across all four formats.
- Next.js lint: no warnings or errors.
- TypeScript strict checking: passed.
- Optimized production build: passed.
- Archive checked against the preceding completed ZIP: all existing files retained, only the scoped source changes and follow-up tests/documentation added; no installed dependencies, build output, Git internals or environment secrets included.

The interaction tests use jsdom. Physical iPhone/Safari motion and authenticated production database flows were not exercised against this modified build; automated checks do not substitute for that device-level verification. Earlier notes are preserved in SWEEP-CHANGES.md; this document supersedes their final-DD-only tier-rate description.
