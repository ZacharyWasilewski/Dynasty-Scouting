export type MockDraftStep = "setup" | "draft" | "results";

export const MOCK_DRAFT_STEP_EVENT = "dd:mock-draft-step";

// Module-level, not React state — BottomTabBar needs this value
// synchronously on its own first render (before any event has fired),
// and it lives in the root layout, entirely outside MockDraftExperience's
// own component tree, so this can't be solved with normal props or
// context. Same reasoning and shape as lib/globalFormat.ts's sticky
// preference, which solves an analogous "a page needs to talk to
// something in the root layout" problem.
let currentStep: MockDraftStep | null = null;

/** Null once you're off the mock draft route entirely — BottomTabBar's
 *  own pathname check is still the first gate, this only matters for
 *  what happens while genuinely on /mock-draft. */
export function getMockDraftStep(): MockDraftStep | null {
  return currentStep;
}

export function setMockDraftStep(step: MockDraftStep | null) {
  currentStep = step;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MockDraftStep | null>(MOCK_DRAFT_STEP_EVENT, { detail: step }));
}
