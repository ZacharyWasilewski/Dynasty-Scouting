# Dynasty Database user-sweep update

For the subsequent mobile and score-stage corrections, see `MOBILE-REFINEMENTS.md`. That follow-up supersedes the final-DD-only rate description below.

Built from the exact supplied `dynasty-database-user-sweep.zip`. Project folder: `scout-grid`.

This implements conservative fixes for audit items 1–16. Items 17 and 18 have no feature changes. The existing visual system, draft mechanics, scoring coefficients, grade thresholds, production dependencies, and Railway configuration are retained.

## Changes by audit item

1. **Score consistency:** profile summary and progression use the same format adjustments. Comparisons use a shared evaluation stage. Pre-draft values in draft-room and result views are identified as Pre-Draft rather than final DD scores.
2. **Analytics:** NFL capital is grouped by actual overall-pick bands, not 12-team fantasy rounds. Both ranking methods use the same eligible players and equal-size cohorts. The headline compares the model's top N with actual top-32 selections, rather than aggregating the same full population twice. Sample sizes are shown.
3. **Draft continuity:** picks, queue, league settings, draft mode, real pick order, and the session's score inputs are checkpointed locally. Reloaded active drafts resume paused. Guest results survive login. New saved drafts include the full room, available in an expandable saved/shared view. Saves use a stable draft ID to avoid duplicates on retries. Starting over requires confirmation.
4. **Save reliability:** board edits are retained locally until acknowledged and written in order; leaving before the debounce flushes the latest edit. A failed initial load cannot overwrite a saved board. Share snapshots contain the order requested at the time of sharing. Watchlist requests specify desired state, prevent overlapping toggles, roll back failures, and show success only after acknowledgment. Load failures no longer masquerade as empty watchlists or missing drafts.
5. **Comparison links:** comparison IDs are not cleared before data loads. The URL retains players and format. Swapping players does not switch the score basis. Raw-only comparisons are supported.
6. **Historical context:** profile and draft-room tier rates explicitly describe final-DD historical cohorts, include sample sizes, and flag small profile/detail samples. Early grades are not presented as individual calibrated probabilities. Analytics distinguish evaluated sample counts from total prospects.
7. **Ranking clarity:** incoming prospects' database rank is scoped to their class and evaluation stage, separate from drafted DD ranks. Rank sorting respects direction. Stage and outcome filters make mixed populations easier to inspect.
8. **Format continuity:** search results, comparison CTAs, class links, boards, and saved draft links retain explicit format context. Fresh pages continue to default to Superflex Standard.
9. **Draft projection wording:** the existing rank-to-pick calculation is labeled a model pick equivalent and tier span, with an explicit 12-team basis. Tier width is not described as forecast confidence. Raw-only prospects explain why no pick equivalent is available.
10. **Board usability:** the entire class is available, with search, direct move-to-rank, an order-undo action, and format controls. Saved opportunity overrides recalculate on reload and use the selected format. Personal tiers follow personal scores. Failed override/reset requests are reported.
11. **Accessibility:** shared modal focus containment, Escape dismissal, focus restoration, scroll locking, and bounded scrolling are applied to the existing dialogs. Comparison search supports keyboard selection and accessible combobox semantics.
12. **Comparison clarity:** copy accurately describes two same-position players; comparisons show class and shared stage, and explain that similarities do not predict identical careers. Sparse matches are excluded and equally close matches favor fuller shared data.
13. **Historical exploration:** outcome filters and an optional outcome display support retrospective research. Historical values explicitly use the current model; the update does not invent archived draft-day ratings or claim held-out validation.
14. **Definitions and copy:** Raw Score includes quantitative metrics beyond production, Standard and Weighted calculations are distinguished, tier descriptions avoid promises of NFL roles, rank denominators count scored players, and percentile ordinals/closely grouped signals are described correctly.
15. **Homepage:** the working comparison tool appears earlier, using the existing section design. Claims of instantaneous source updates and broad assumptions about other rankings are softened to accurate descriptions.
16. **Performance:** homepage comparison data loads as that section approaches the viewport; profile comparison payloads are limited to the relevant position; unopened mobile analytics/profile sections defer mounting. Saved-draft lists omit full-room snapshots until a detail page is opened.

## Validation

- Full Vitest suite: 141 tests across 19 files.
- TypeScript strict checking, Next.js ESLint, and optimized production build.
- New regressions cover score-stage symmetry, format adjustments, equal analytics cohorts, scoped ranks, malformed checkpoints, supported timers, board write ordering, unmount flushing, pending edit recovery, failed initial loads, comparison URL restoration, keyboard selection, modal focus/scroll restoration, watchlist rollback, active-draft reload, and completed guest-draft recovery.
- The original supplied ZIP had seven failing tests. Stale format/color fixtures were corrected without changing production defaults or colors; sparse comparison handling and tie-breaking were corrected. Existing trending test changes are TypeScript assertions only; its feature behavior is unchanged.
- No existing dependency versions were upgraded. `jsdom` was added only as a development dependency for component regression tests.
- Final package excludes installed dependencies, build output, Git internals, environment secrets, and temporary analysis files.

## Verification limits

The remote browser could not open the local server (`ERR_BLOCKED_BY_CLIENT`). Desktop/mobile visual verification of the modified build and authenticated end-to-end checks against the production database were therefore not completed. Component interaction tests and production compilation passed; these are not a claim that every device or live integration has been exercised. The build can emit the existing sitemap live-data fallback notice while prerendering; it completes successfully.

Browser recovery depends on local storage being available. The draft room reports when it cannot store recovery data. Historical estimates remain retrospective; collecting archived model versions or conducting new held-out research requires actual historical datasets, not reconstructed claims.

## Deploy

Run `bash deploy-railway.sh` from this folder. The script:

1. Clones the `main` branch of `ZacharyWasilewski/Dynasty-Scouting` into a fresh temporary `scout-grid` checkout.
2. Copies this package's source into that checkout, excluding environment files and local build/dependency artifacts.
3. Runs dependency installation, lint, tests, and the production build. Any failure stops before pushing.
4. Commits and performs a normal push to `main`, preserving Git history. Your existing Railway service must be connected to this branch with autodeploy enabled.

It does not change Railway variables, databases, domains, or service settings. GitHub authentication and your existing Git author configuration are required. Keep the ZIP as the tested source copy. The temporary deployment checkout's location is printed on success.
