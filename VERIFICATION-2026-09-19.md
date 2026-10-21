# Scoped update — September 19, 2026

Base: dynasty-database-audit-fixes.zip, verified byte-for-byte against the working project before edits.

## Changes
- Mock player statistics use non-shrinking, content-sized columns with a 104px minimum on both desktop and mobile. Labels, percentages, counts, and scores do not split mid-token. Existing horizontal scrolling, player controls, and draft logic are retained.
- Player pages generate individual descriptions, canonical URLs, Open Graph and Twitter metadata. Preview images include identity, correct evaluation stage, selected league format, score and tier. Unknown players return 404. Missing scores remain TBD.
- Signup explains watchlists, boards, saved drafts and Sleeper recommendations.
- /privacy describes implemented account storage, usage events, browser storage, public sharing, email, and deletion limitations. Linked from signup and footer; included in sitemap.

## Completed verification
- Production Next.js build passed.
- 192 automated tests passed across 30 files.
- New metadata cases cover drafted DD, Pre-Draft, Raw, missing/nonfinite data, format selection and fallback.
- Real image route rendered a 1200×630 PNG; preview visually inspected, including a long player name. Missing-player response checked.
- New player-row component tests cover large numeric counts, labels, queue action and user/computer-turn pick controls.
- Existing mobile-state tests cover header behavior, collapsed filters, filter persistence and clearing, restored drafts, and results/saved board content.
- New isolated account route tests cover anonymous-write rejection, watchlist saves, owner-scoped reads, board save/reload and malformed input, saved-draft ownership, notification preferences, login session responses, logout, and password-gated deletion.
- Existing component tests cover saved-board edits/retry, watchlist state, draft recovery, and save failure behavior.

## Boundaries
- Component/mobile tests use jsdom: they verify rendered structure and state transitions, not CSS layout or real touch gestures.
- Account route tests use isolated auth/database fixtures. They do not prove production database persistence, real email delivery, or actual Sleeper import success.
- This environment exposes no browser phone-viewport control and no configured application database. Current real-device mobile verification remains outstanding.
- Live signed-in verification requires the owner to sign in through the secure browser flow. No passwords should be sent in chat.
- Updated code has not been deployed by this task. After deployment, verify social previews (platform caches can retain old cards), phone horizontal/vertical scrolling, saved-account workflows, and /privacy.

## Remaining acceptance pass
On iPhone Safari and Android Chrome: test 360–430px portrait and landscape, draft player-list scroll on both axes, pick/bookmark separation, numeric readability, keyboard opening/dismissal, restored draft and results navigation. For an authenticated test account: verify watchlist persistence after reload, board reorder after navigation/reload, saved mock detail, Sleeper import, notification toggle, logout/login and password-reset email. Do not delete a real account as a test.
