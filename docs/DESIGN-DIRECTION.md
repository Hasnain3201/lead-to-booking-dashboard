# Design direction: Harbor Observatory

Leadflow's interface should feel like a calm, beautiful night-time instrument for a small service business: editorial where it tells a story, precise where it shows numbers, and playful only where play helps someone understand the data.

## Reference board

Research took place September 23, 2026. Sources were read for their published approach; they were inspiration, not templates. No assets or brand identities were copied.

| Source | What we took from it |
|---|---|
| [Cerebrium, Awwwards Site of the Day, Sep 10, 2026](https://www.awwwards.com/sites/cerebrium) | Data visualization as the hero of the page rather than a sidebar widget; deep blue and violet palette energy |
| [Unabyss, Awwwards nominee](https://www.awwwards.com/sites/unabyss) | "Data flow visualization" as a signature moment; motion that explains where things go |
| [Shift 5, Awwwards Site of the Day](https://www.awwwards.com/sites/shift-5) | Mixing retro instrument cues with data visualization and feature cards |
| [Codrops: Interactive Particles with Three.js](https://tympanus.net/codrops/2019/01/17/interactive-particles-with-three-js/) and [Dreamy GPGPU particles](https://tympanus.net/codrops/2024/12/19/crafting-a-dreamy-particle-effect-with-three-js-and-gpgpu/) | Particles that respond to the pointer, additive glow, and trails. We used Canvas 2D because 720 particles do not need WebGL |
| [Codrops: Infinite Liquid Glass Grid, Sep 8, 2026](https://tympanus.net/codrops/2026/09/08/building-an-infinite-liquid-glass-grid-with-three-js-webgpu-and-tsl/) | Spring physics for drag interactions, and glass surfaces that refract what is behind them |
| [Chrome: same-document View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) and [Akash Hamirwasia's theme toggle](https://akashhamirwasia.com/blog/full-page-theme-toggle-animation-with-view-transitions-api/) | Circular theme reveal grown from the toggle, with `flushSync`, progressive enhancement, and a reduced-motion fallback |
| [Linear UI refresh, Mar 12, 2026](https://linear.app/changelog/2026-03-12-ui-refresh) | Quiet, consistent controls so the data carries the personality |
| [Vercel Geist typography](https://vercel.com/geist/typography) | Explicit type roles and tabular numerals so values never shift width |
| [Rauno Freiberg](https://rauno.me/) | Tactile micro-interactions: springy presses, precise focus, small delights |

## Identity

- **Name of the look:** Harbor Observatory. It is night at a harbor: dark water, a sweeping lighthouse beam, sea-glass teal, coral warning flares, and warm paper for anything printed.
- **Type:** Fraunces Variable for display text, using its soft and "wonky" italic axes for signature words (*hello*, *current*, *tide*). Geist Variable for the interface, and Geist Mono for numbers, IDs, and small instrument labels. All fonts are bundled so the app works offline.
- **Color:** Night theme ink `#04070d`, paper-white text `#f1e9da`, tide `#5ce1c6`, sky `#7cc4ff`, beam `#ffc86b`, rose `#ff8fb1`, lilac `#b4a1ff`, and coral `#ff6f59` for problems. The day theme is a warm paper chart (`#efe7d8`) with deeper versions of the same hues. Each lead source always keeps its own color.
- **Surfaces:** Frosted glass panels with a cursor-following spotlight and glowing edge, fine chart-grid lines that fade out, animated film grain, and a slow aurora.
- **Printed artifacts:** The weekly dispatch and import receipt use a light paper stock in both themes, with lined paper, a torn receipt edge, and rubber stamps.

## Signature interactions

1. **The current.** A Sankey river where each glowing particle is one real inquiry. Particles travel from lead source through first response and booking to the furthest outcome, leaving comet trails. Leads that never book drift away at the booking column. Hover identifies a particle, clicking opens its record, and clicking a source focuses the whole dashboard on it.
2. **The tide chart.** A daily inquiry timeline you drag across to choose the inquiry cohort, with spring-feel handles, arrow-key control, and presets.
3. **Lighthouse theme switch.** The new theme grows as a circle from the toggle.
4. **Digit-swap numerals.** When filters change, each digit slides from its old value to its new one. Values never count up through made-up intermediate numbers.
5. **Printed intake.** Validation "prints" a receipt line by line and stamps it VALIDATED. A failed import replaces the dashboard with a clear issue list.
6. **Small delights:** a ⌘K palette, a floating filter dock, a pulsing follow-up queue, a voyage-log timeline in the record drawer, a particle burst on successful import, and a shimmering headline word.

## Rules we held to

- Python and SQL are the only source of metrics. The browser formats and draws what the API returns.
- Motion never implies data that does not exist. Ring sweeps and bar growth only reveal final values.
- `prefers-reduced-motion` pauses the particle current as a still frame and turns off decorative motion and the theme reveal.
- Every pointer interaction has a keyboard path: source nodes are buttons, date handles are sliders, rows open with Enter, and the drawer and palette close with Escape.
- Every screen has a legible synthetic-data label, and caveats stay next to the numbers they qualify.

## Architecture decision

Streamlit's layout and component model could not support these interactions without fighting the framework. The replacement is Vite + React 19 + TypeScript with hand-written CSS, D3 for chart geometry (`d3-sankey`, `d3-shape`, `d3-scale`), and Motion for transitions. A small Starlette API (already installed as a Streamlit dependency) serves the tested Python functions and the built frontend from one local process. Streamlit remains available as a classic analyst view.
