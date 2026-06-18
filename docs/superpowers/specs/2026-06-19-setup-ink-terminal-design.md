# Setup screen as a Surogate "ink terminal"

Date: 2026-06-19

## Goal

Replace the flat first-run **Setup** wizard with a centered "terminal-window" experience
that channels Surogate's Ink CLI (`feature/watch-ink` → `StartScreen` + `Showcase`): a
window frame wrapping the existing 3-step wizard on the left and a cycling, self-animating
**Showcase** of training scenes on the right. White+gold in light mode, dark+gold in dark
mode. Also fix the website hero showcase, which is cramped and renders empty bars.

## Decisions (locked)

- **Aesthetic:** Hybrid — terminal-window chrome (traffic lights, title bar, monospace
  type) wrapping *smooth* SVG/CSS scenes (not raw char-grid).
- **Theme:** Follow the app's light/dark theme; gold accents either way (so it's
  white+gold when the app is light).
- **Scope:** First-run Setup screen only (Welcome untouched) + a fix to the website hero
  showcase, which the user flagged as broken/cramped.

## Wizard architecture

```
.setup (full-height centered flex)
└── .term (terminal window: border, soft shadow, rounded)
    ├── .term-bar      traffic-light dots · "jackalope · setup" · status
    ├── .term-brand    <Brand/> jackalope mark + "Jackalope by Surogate · first-run setup"
    ├── .term-body     grid: [ left: stepper + step body ] [ right: <Showcase/> ]
    └── .term-foot     "★ star github.com/invergent-ai/surogate"
```

- **Left column** keeps the existing wizard *behavior* verbatim (compute pick → version
  check → finish via `completeOnboarding`). Only markup/classes change. Stepper becomes a
  compact vertical/inline rail.
- **Right column** renders `<Showcase/>` (new), sized with a `min-height` that fits the
  tallest scene so nothing ever clips (the website's mistake).
- On a narrow window the right column drops below the left (single column).

## Showcase component

New folder `src/components/showcase/`:

- `useFrame.ts` — `useFrame(ms): number`, a `setInterval` frame counter (the Ink pattern).
- `Showcase.tsx` — cycles `SCENES` every ~6s; renders scene **title + progress dots** and
  the active scene **keyed by index** so entrance animations replay each cycle.
- `scenes.tsx` — the six scene components, each self-contained, no props:
  | Scene | Rendering |
  |---|---|
  | `LossScene` | SVG path drawing in via `stroke-dashoffset`; loss readout ticks down |
  | `ModelsScene` | model rows slide in with a moving highlight |
  | `GpusScene` | supported-GPU chips fade/stagger in |
  | `UtilScene` | 4 GPU bars whose width is **state-driven** from `useFrame` (pulsing) |
  | `ThroughputScene` | block-bar sparkline scrolling + tok/s counter ticking |
  | `SpeedupScene` | bf16 / fp8 / NVFP4 bars grow in with ×-multipliers |
- `data.ts` — curated `MODELS`, `GPU_GENS`, `RECIPES` (mirrored from the website's existing
  marketing copy; no fetching).

**Robustness rule:** continuous motion (bars, sparkline, loss tick) is driven by the
`useFrame` counter → inline `width`/values recomputed every frame. This cannot get "stuck
empty" the way the website's dueling `.barfill` CSS animations do.

## Styling

All new CSS in `src/styles.css` uses existing theme vars (`--gold`, `--bg`, `--line`,
`--green`, `--eval`, `--warm`, `--purple`). New blocks: `.term*`, the two-column setup
body, and `.sc-*` scene styles. The old `.setup-card` / `.stepper` / `.compute-*` /
`.ready-mark` rules are replaced/retitled. `prefers-reduced-motion` halts the frame-driven
loops (nice-to-have).

## Website fix (`site/index.html`)

- Give `.stage` a `min-height` instead of a fixed clipped `height`, and make the GPU
  utilization scene compact (horizontal/uniform rows) so it fits the hero window.
- Make the bars reliably render filled (single, non-competing animation, or set the final
  width directly) so they never show empty.
- Keep it within the existing dark hero window; just make it not cramped/cringe.

## Files

- **New:** `src/components/showcase/{useFrame.ts,Showcase.tsx,scenes.tsx,data.ts}`
- **Edit:** `src/panels/Setup.tsx`, `src/styles.css`, `site/index.html`

## Out of scope

- Welcome screen redesign, theme system changes, any backend/IPC changes.

## Learning-mode contribution

During implementation, the **loss-curve generator** (exponential-decay series vs. a
hand-tuned bezier) is a real visual choice left to the user — a ~5–10 line function.
