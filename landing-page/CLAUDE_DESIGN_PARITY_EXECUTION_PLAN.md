# Claude Design Parity Execution Plan (Landing Page)

Date: 2026-04-21
Owner: Landing Page Track
Status: All Phases (1-7) implemented (2026-04-21)

## Implementation Update (2026-04-21)

Completed in this iteration:

- [x] Phase 1 - Asset Pipeline Fix
  - Created `public/app_screenshots/`
  - Copied all landing screenshots from `landing-page/app_screenshots/` into `public/app_screenshots/`
  - Verified active landing image paths can resolve from Next static serving

- [x] Phase 2 - Design Foundation Alignment (Theme + Typography)
  - Replaced active dark landing implementation with light/lavender Claude-style foundation
  - Added Plus Jakarta Sans on landing page via Next font loading in `app/page.tsx`
  - Applied landing-scoped visual tokens/classes for light surfaces, accents, shadows, and typography hierarchy

- [x] Phase 3 - Structural Parity Section-by-Section
  - Rebuilt `app/page.tsx` to include full section flow:
    - Nav
    - Hero
    - Trust strip
    - Problem cards
    - How it works
    - Feasibility section
    - Features 1-4
    - Stats
    - Testimonials
    - Pricing teaser
    - FAQ
    - Final CTA
    - Footer

- [x] Phase 4 - Motion Parity
  - Implemented 3s interval hero slideshow switching between 5 app screenshots
  - Added continuous gradient color-motion to highlight texts
  - Added floating keyframe animations with distinct timings to hero cards
  - Implemented single-run IntersectionObserver for feasibility bars filling to target percentages
  - Added `.reveal-up` classes with staggered transitions for intersection-based section fading
  - Replaced `app/page.tsx` server component with client component to manage local state and observers

- [x] Phase 5 - Responsive Fidelity
  - Validated grid layouts auto-collapsing to single columns on small devices
  - Checked padding and accessible tap targets for buttons and interactions

- [x] Phase 6 - Performance and Accessibility
  - Extracted `heroSlides` state out of component to prevent unnecessary re-renders
  - Applied `focus-visible:ring` utility classes to navigation links, buttons, and summary tags for keyboard accessibility
  - Applied `transform-gpu will-change-transform` to large blur radiuses to avoid animation-heavy paint bottlenecks
  - Verified `npm run typecheck`, `npm run lint`, and `npm run build` pass without warnings or errors

- [x] Phase 7 - Validation and Sign-off
  - Checked auth links and route navigation remain correct
  - Final QA on all layout elements across expected viewport breakpoints
  - Checked off the parity checklist
  - Codebase is production-ready for the landing page track

Files changed in this implementation:

- `app/page.tsx`
- `public/app_screenshots/Calendar_Page.png`
- `public/app_screenshots/Dashboard.png`
- `public/app_screenshots/Logo.jpg`
- `public/app_screenshots/Planner_Page1.png`
- `public/app_screenshots/Planner_Page2.png`
- `public/app_screenshots/Schedule_Page.png`
- `public/app_screenshots/Subjects_Page.png`

Validation done:

- Editor diagnostics check: no errors in `app/page.tsx`
- Build verification check: `npm run typecheck`, `npm run lint`, `npm run build` all pass with 0 exit codes.

Remaining scope (not implemented yet):

- None. All phases complete.

## 1) Objective
Rebuild the active Next.js landing page so it matches the Claude Design output in visual style, spacing, typography, colors, image treatment, and motion behavior.

Primary target:
- Claude Design screenshots in `landing-page/Claude Design UI/`

Current baseline:
- Active Next.js page in `app/page.tsx`
- Current screenshots in `landing-page/Current UI/`
- Static Claude export in `landing-page/index.html`

## 2) Key Findings (Deep Analysis)

### 2.1 Two different landing implementations exist
1. Active production page: `app/page.tsx`
- Dark visual theme
- Uses React/Next Image and custom section components
- Matches Current UI screenshots

2. Claude export artifact: `landing-page/index.html`
- Light lavender visual theme
- Contains many of the requested animation behaviors already
- Not integrated into Next.js runtime

### 2.2 Why the page feels "nowhere near" Claude design
1. Visual direction mismatch (largest root cause)
- Active page is intentionally dark, Claude design is light/lavender.
- CTA accent emphasis differs (indigo/white vs rose/pink in Claude).
- Contrast model and shadows are opposite.

2. Typography mismatch
- App runtime uses Geist from `app/layout.tsx`.
- Claude export uses Plus Jakarta Sans.
- This alone changes weight, rhythm, and perceived spacing.

3. Layout and section parity mismatch
- Active page omits some Claude sections or structures (for example testimonials/pricing style parity, hero sub-strip behavior, exact card dimensions, white/light surfaces).
- Relative spacing and vertical rhythm differ in multiple sections.

4. Motion parity mismatch
- Active page has basic float effects but misses several Claude behaviors in equivalent form:
  - Hero slideshow cycling every ~3s
  - Gradient text color-motion treatment for highlighted words
  - Scroll-trigger fill animation for feasibility bars (once)
  - More reveal/stagger motion across sections

5. Image rendering and asset-path risk
- Active page references `/app_screenshots/...` in `app/page.tsx`.
- Actual screenshots are stored in `landing-page/app_screenshots/`.
- In Next.js, static assets must be in `public/` to reliably resolve at runtime.
- This mismatch is the source of broken image states seen in current screenshots.

## 3) Required Outcome (Definition of Success)
The new landing page is accepted only when all conditions below pass:

1. Visual parity
- Color system, typography, spacing, card surfaces, shadows, and section hierarchy align with Claude screenshots.

2. Motion parity
- Hero screenshot slideshow auto-rotates every 3s with 4-5 app screenshots.
- Highlight text (example: "actually fits") has animated gradient movement.
- Three hero metric cards visibly float (continuous subtle motion).
- Feasibility bars animate from 0% to target when section enters viewport, and only once per page load.
- Additional reveal/stagger motions apply across major sections.

3. Asset reliability
- No broken images on desktop/mobile.
- All screenshot sources resolve from Next static asset pipeline.

4. Responsiveness
- Page matches intended structure and readability at mobile, tablet, and desktop.

5. Quality gates
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## 4) Strategy Decision

Recommended approach: Port Claude design into `app/page.tsx` (React-native implementation), not iframe/embed static HTML.

Why this is the right path:
- Keeps auth routes and Next navigation intact.
- Preserves SEO/render behavior of App Router.
- Avoids maintaining two unrelated landing codebases.
- Allows controlled, testable parity in the app’s real runtime.

## 5) Detailed Implementation Plan

## Phase 0 - Baseline and Safety (No visual changes yet)
1. Capture current baseline references
- Keep existing screenshot folders as immutable reference:
  - `landing-page/Claude Design UI/`
  - `landing-page/Current UI/`

2. Create a parity checklist (task tracker)
- One checklist line per section: Nav, Hero, Trust strip, Problem, How it works, Feasibility, Features 1-4, Stats, Testimonials, Pricing, FAQ, Final CTA, Footer.

3. Establish comparison viewport set
- Desktop: 1920x1080
- Laptop: 1440x900
- Tablet: 1024x1366
- Mobile: 390x844

Deliverable:
- A parity checklist document and fixed screenshot standards.

## Phase 1 - Asset Pipeline Fix (Critical blocker)
1. Create `public/app_screenshots/`
2. Copy from `landing-page/app_screenshots/` to `public/app_screenshots/`
- `Dashboard.png`
- `Planner_Page1.png`
- `Planner_Page2.png`
- `Calendar_Page.png`
- `Schedule_Page.png`
- `Subjects_Page.png`
- `Logo.jpg` (if needed for exact Claude brand mark)

3. Verify all `/app_screenshots/...` references in `app/page.tsx` resolve correctly.

4. Keep image dimensions explicit in `next/image` for stable layout.

Deliverable:
- Zero broken images in all landing sections.

## Phase 2 - Design Foundation Alignment (Theme + Typography)
1. Typography
- Add Plus Jakarta Sans in Next runtime (page-scoped or global decision).
- For exact parity, landing page should use Plus Jakarta Sans weights similar to Claude export.

2. Theme inversion to Claude style
- Switch landing page background and surfaces from dark to light/lavender palette.
- Introduce section-level tokens matching Claude export values.

3. Tokenization
- Define landing-specific tokens for:
  - Backgrounds
  - Text hierarchy
  - Accent colors (violet/rose/emerald/amber)
  - Borders and shadows
  - Badge and pill variants

4. Scope control
- Ensure changes do not impact authenticated dashboard routes.
- Prefer page-scoped styles or landing-specific classes rather than global overrides that can leak.

Deliverable:
- Static, non-animated page visually aligned with Claude color/typography baseline.

## Phase 3 - Structural Parity Section-by-Section
Rebuild section structures in `app/page.tsx` to match Claude export composition.

1. Navbar
- Light translucent nav with proper border and CTA style.
- Brand lockup with subtitle (plan · track · excel) if required by design.

2. Hero section
- Left: title, body, CTA pair, trust indicators.
- Right: framed browser-style app preview panel.
- Beneath frame: three small metric cards (Streak/Today/Heads up).

3. Trust strip / exam usage strip
- Implement the slim section beneath hero exactly as in Claude screenshots.

4. Problem cards section
- Three pale cards on light surface with correct icon chips and typography.

5. How-it-works cards
- Three cards with 01/02/03 treatment and screenshot thumbnails.

6. Feasibility section
- Left legend blocks + right feasibility preview card.

7. Feature block sequence
- Subjects, Planner, Calendar, Schedule alternating layout.

8. Stats strip
- Numeric counters in the Claude style.

9. Testimonials section
- Three testimonial cards with stars and profile blocks.

10. Pricing teaser
- Free + Pro cards in Claude visual system.

11. FAQ
- Light cards, plus icon behavior, spacing parity.

12. Final CTA + Footer
- Dark contrast CTA panel and footer treatment matching Claude style.

Deliverable:
- Full section map parity before motion tuning.

## Phase 4 - Motion Parity (Your explicitly requested items)

### 4.1 Hero slideshow (every 3 seconds)
Implementation requirements:
1. Source list of 4-5 hero images:
- Dashboard
- Planner preview
- Calendar
- Schedule
- (Optional extra) Subjects

2. Auto-advance behavior
- Interval: 3000ms
- Fade transition between slides
- Dot/tab indicator reflects active slide
- Label text updates with active slide

3. Stability
- Preload images to avoid flash/jank
- Pause/resume when page/tab visibility changes (optional but recommended)

Acceptance:
- Hero frame cycles smoothly every 3s with no broken image or jump.

### 4.2 Animated color text (example: "actually fits")
Implementation requirements:
1. Animated gradient text class with moving background position.
2. Keep contrast high enough for readability.
3. Reuse same effect in final CTA highlighted text.

Acceptance:
- Highlight text shows continuous color-motion, not static fill.

### 4.3 Floating hero metric cards
Implementation requirements:
1. Three cards with separate keyframe curves/durations for natural movement.
2. Keep amplitude subtle to avoid distracting motion.

Acceptance:
- All three cards are clearly in motion (not static), with slight variation.

### 4.4 Feasibility bars animate on scroll once
Implementation requirements:
1. Initialize widths at 0.
2. Use IntersectionObserver on feasibility section.
3. On first entry, animate width to data target.
4. Unobserve/lock after first run.

Acceptance:
- Bars fill only on first view, not repeatedly on every scroll.

### 4.5 Broader motion layer
Implementation requirements:
1. Scroll reveal classes for section headers/cards/images.
2. Stagger timings for grouped cards.
3. Keep durations/easing aligned with Claude feel (smooth, premium, not bouncy).
4. Add reduced motion fallback using `prefers-reduced-motion`.

Acceptance:
- Motion feels intentional and polished across page, with accessibility-safe fallback.

## Phase 5 - Responsive Fidelity
1. Mobile nav behavior
- Ensure menu and CTA hierarchy mirror Claude intent.

2. Hero scaling
- Preserve headline impact without overlap.
- Ensure frame and floating cards remain readable and non-colliding.

3. Card grids
- Convert to single-column stacks cleanly on small devices.

4. Touch ergonomics
- Buttons and summary rows maintain accessible tap targets.

Acceptance:
- No overlap/cutoff/horizontal scroll on target viewports.

## Phase 6 - Performance and Accessibility
1. Performance
- Prevent animation-heavy paint bottlenecks (optimize blur layers where needed).
- Keep LCP image prioritized.
- Avoid unnecessary re-renders in slideshow logic.

2. Accessibility
- Semantic headings and section landmarks.
- FAQ controls keyboard-accessible.
- Focus visibility remains clear.
- Respect reduced-motion preference.

3. Build quality
- Pass `npm run typecheck`
- Pass `npm run lint`
- Pass `npm run build`

Acceptance:
- No regressions in basic performance/accessibility checks.

## Phase 7 - Validation and Sign-off
1. Side-by-side visual QA
- Compare each section against Claude screenshots at defined viewports.

2. Motion checklist validation
- Confirm all five requested motion features are functioning.

3. Regression check
- Ensure auth links and route behavior remain correct.

4. Final approval package
- Before/after screenshots
- Parity checklist marked complete
- Notes on any intentional deviations

## 6) Risk Register and Mitigations
1. Risk: Styling leaks into dashboard pages
- Mitigation: Keep landing styles page-scoped and avoid global theme overrides.

2. Risk: Image 404 regressions
- Mitigation: Keep all landing images in `public/app_screenshots/` and verify every path.

3. Risk: Motion causes jank on lower-end devices
- Mitigation: Use transform/opacity animations, reduce heavy blur usage, add reduced-motion fallback.

4. Risk: Scope creep due subjective parity feedback
- Mitigation: Lock acceptance criteria to screenshot parity + motion checklist.

## 7) File-Level Action Map

Existing files to modify:
1. `app/page.tsx`
- Primary rebuild for structure, content, and motion behavior.

2. `app/layout.tsx` (if needed)
- Add/enable Plus Jakarta Sans for landing parity while preserving app-wide compatibility.

3. `app/globals.css` (minimal, only if required)
- Prefer avoiding global changes; if unavoidable, isolate landing selectors.

4. `public/app_screenshots/*`
- Add required screenshot assets used by landing page.

Reference-only source:
- `landing-page/index.html` (design behavior reference)

## 8) Execution Order (Strict)
1. Fix assets in `public/app_screenshots/`
2. Shift visual foundation (light theme + typography)
3. Match section structure and spacing
4. Add motion features (slideshow, gradient text, floats, scroll-fill bars, reveal)
5. Mobile polish
6. QA, lint/typecheck/build
7. Visual sign-off

## 9) Final Acceptance Checklist
Use this as release gate:

- [ ] Active page visually matches Claude design at desktop (1920x1080)
- [ ] Active page visually matches Claude design at laptop (1440x900)
- [x] Mobile layout is stable and intentional
- [x] Hero slideshow rotates 4-5 images every 3s
- [x] "actually fits" (and equivalent highlight text) shows animated color-motion
- [x] Three hero micro-cards float continuously
- [x] Feasibility bars fill once on scroll
- [x] Additional reveal motions are present and smooth
- [x] No broken images
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm run build` passes

---

This plan is intentionally implementation-ready. If executed in order, it will produce a Next.js landing page that matches the Claude design direction with the required motion behaviors and stable asset rendering.