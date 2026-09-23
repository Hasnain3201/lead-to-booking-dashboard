# Visual direction research — initial pass

Research started September 23, 2026. This is a direction brief; no final frontend redesign is claimed. Before implementation, visually inspect the reference interactions in a browser and add additional independent references. Current sources were read for their published design approach, not exhaustively visually audited.

## Primary references

- [Linear UI refresh, March 12, 2026](https://linear.app/changelog/2026-03-12-ui-refresh): consistent headers and controls, carefully scaled icons, and quieter navigation support scanning and focus. Apply this principle to the dashboard’s working screens without copying the brand.
- [Vercel Geist typography](https://vercel.com/geist/typography): explicit heading, label, copy, and tabular-number roles. Apply a deliberate type scale and steady-width numbers so changing metrics do not shift their layout.
- [Rauno Freiberg’s portfolio](https://rauno.me/): a source for the next interaction-craft review. Follow its Craft and project links and evaluate tactile details in the browser before deciding which patterns suit Leadflow.

## Proposed original concept: Harbor Observatory

Warm paper surfaces, deep ink typography, sea-glass teal, and small coral signals for overdue work. Pair an expressive editorial headline with crisp readable tables and tabular numerals. Use a restrained nautical navigation motif, expressed through flowing paths and fine coordinate rules rather than stock maritime illustrations. The main screen should feel like a calm operations instrument with a distinctive personality.

Signature interaction candidates: a flowing inquiry-to-job path that highlights linked records; a weekly timeline with a responsive focus marker; a satisfying import receipt that resolves into accepted counts after validation. Micro-interactions should respond to real actions, with reduced-motion alternatives. Never animate fabricated intermediate metric values as if they were observations.

## Architecture decision to resolve

The tested Python validation and SQL remain authoritative. A dedicated React/TypeScript frontend with a small Python API is the leading candidate if Streamlit cannot support the custom layouts and transitions cleanly. Prototype one real screen and error state before committing to a migration. Preserve the existing CSV contract, issue report, exact-cent totals, and offline local demo behavior. No new dependency or frontend framework was installed in this research pass.

## Skills discovery

The curated skill catalog was inspected. It includes Figma design-generation/design-system/implementation skills and screenshot/browser-testing skills; no general frontend-design skill appeared in that catalog. These are candidates to inspect if their workflows fit, not installed or validated dependencies. Existing computer-use tools already support browser QA. A Figma workflow is optional, not a prerequisite for high-quality code-native design.

## Next deliverables

1. Browser-reviewed reference board and a concrete type/color/motion specification.
2. One responsive high-fidelity screen using actual demo metrics, plus import error and empty states.
3. A frontend architecture decision with migration checklist and regression coverage.
4. Final screen set, reduced-motion/keyboard/mobile review, and real screenshots for the showcase README.

Final scope and public-launch authorization remain in IMPLEMENTATION-PLAN.md. Keep the repository private until the finished interface and showcase are ready.
