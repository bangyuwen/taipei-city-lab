---
name: Taipei Waste Lab
description: A public research index connecting bin records, places, comparisons, and service decisions.
colors:
  deep-petrol: "#16566a"
  rail-petrol: "#123d49"
  rail-muted: "#bcd5dc"
  cool-paper: "#f2f6f7"
  surface-white: "#ffffff"
  ink: "#18333b"
  muted-ink: "#52676d"
  selected-wash: "#e2eff3"
  rule-line: "#c6d6dc"
  focus-copper: "#bd5c16"
  rail-focus: "#ffc287"
  warning-paper: "#fff0d9"
  warning-ink: "#734917"
  control-border: "#91aab3"
  nav-current-wash: "#d9ecf1"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "clamp(26px, 2.3vw, 34px)"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.8
  compact-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.8
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  research-serif:
    fontFamily: "CitySerif, 'Noto Serif TC', serif"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  s-8: "8px"
  s-12: "12px"
  s-16: "16px"
  s-24: "24px"
  s-32: "32px"
components:
  button-primary:
    backgroundColor: "{colors.deep-petrol}"
    textColor: "{colors.surface-white}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "11px 15px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.deep-petrol}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "10px 15px"
    height: "46px"
  link-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.deep-petrol}"
    typography: "{typography.control}"
    padding: "10px 0"
    height: "44px"
  input-search:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "46px"
  navigation-current:
    backgroundColor: "{colors.nav-current-wash}"
    textColor: "{colors.rail-petrol}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "52px"
  dataset-selected:
    backgroundColor: "{colors.selected-wash}"
    textColor: "{colors.deep-petrol}"
    typography: "{typography.body}"
    padding: "12px 16px"
  filter-selected:
    backgroundColor: "{colors.deep-petrol}"
    textColor: "{colors.surface-white}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
    height: "44px"
  map-card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  point-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "10px 0"
  evidence-limit:
    backgroundColor: "{colors.warning-paper}"
    textColor: "{colors.warning-ink}"
    typography: "{typography.label}"
    padding: "12px 16px"
---

# Design System: Taipei Waste Lab

## Overview

The 2026-10-17 information architecture puts three reader journeys in the primary rail: 研究結論 (the default page), 台北的變化, and 各國垃圾桶. Sources/methods and execution materials are secondary links. Recommendations, dated observations and authored concepts have distinct content homes and direct evidence links. The country reader leads with the selected country's strategy, operating flow, city evidence, sources, and limits; photo and 3D remain supplementary media for twelve cases. The browser covers fourteen countries and regions. Guided design demonstrations replace the parameter workbench. These changes retain the petrol/paper identity and the existing type and interaction tokens.

**Creative North Star: "The Open-Shelf Research Index"**

The site borrows the clarity of a public library index: a deep petrol rail anchors cool paper pages, and pale blue marks the selected entry. Short rows, aligned counts, quiet rules, and familiar web controls carry dense public information without turning research into promotional cards.

Residents and researchers move from a dated record or place to its source, comparison, and service implications. The map starts with its location task; evidence pages use a continuous reading column with limits beside the claims they qualify. Four purpose choices remain distinct from the fourteen country strategies. Twelve photo-backed equipment supplements keep each real image beside its caption, credit, and license. Costs, observed results, and local interpretation stay separate.

**Key Characteristics:**

- Deep petrol navigation with pale labels and a clear current-page state.
- Cool paper surfaces, pale blue selections, and restrained line borders.
- A 16px reading base, compact labels, and tabular figures.
- Source and coverage limits stay close to the related record or claim.
- Native controls support the map, comparison, design, and research tasks.

## Colors

The palette uses cool blue-gray neutrals with a concentrated petrol accent; warm amber is reserved for warnings and copper for keyboard focus.

### Primary
- **Deep Petrol** (#16566a): Links, map markers, and selected controls use this accent on light surfaces.

### Secondary
- **Rail Petrol** (#123d49): The fixed navigation rail uses the darker petrol to frame the index.
- **Rail Mist** (#bcd5dc): Secondary navigation text stays readable against the dark rail.

### Tertiary
- **Copper Focus** (#bd5c16): Keyboard focus stands apart from the petrol states.
- **Rail Focus** (#ffc287): The outline lightens on the dark rail.
- **Warning Paper** (#fff0d9) with **Warning Ink** (#734917): Coverage and evidence cautions use a warm field with contrasting text.

### Neutral
- **Cool Paper** (#f2f6f7): The reading canvas keeps long pages cool and quiet.
- **Surface White** (#ffffff): Map, form, and evidence panels sit above the paper canvas.
- **Ink** (#18333b): Primary text uses a softened blue-black.
- **Muted Ink** (#52676d): Supporting text and source metadata retain contrast without competing with claims.
- **Selected Wash** (#e2eff3): A pale blue fill marks selected data and tab states.
- **Rail Current Wash** (#d9ecf1): The current route receives a slightly brighter fill inside the rail.
- **Rule Line** (#c6d6dc) and **Control Border** (#91aab3): Separators and native fields use cool blue-gray strokes.

**The Rail Contrast Rule.** The rail pairs pale labels with a dark field; its current destination uses a pale wash and bold dark text. Focus uses a lighter outline on the rail.

## Typography

**Display Font:** System sans with Noto Sans TC and Microsoft JhengHei fallbacks

**Body Font:** The same system sans stack

**Label/Mono Font:** No separate mono face; numeric values use tabular figures.

**Character:** The sans stack keeps Traditional Chinese copy familiar and compact. A bundled CitySerif face adds a restrained reading accent to selected evidence headings and case names.

### Hierarchy
- **Display** (700, clamp(26px, 2.3vw, 34px), 1.35): Route and map titles; the compact map title becomes 27px at phone widths.
- **Headline** (700, 28px, 1.45): Main section headings, with smaller route-specific sizes on narrow screens.
- **Title** (700, 20px, 1.5): Index and subsection headings; longer evidence headings use the serif accent.
- **Body** (400, 16px, 1.8): Default reading text; long evidence passages stay within roughly 74–76ch.
- **Label** (400, 14px, 1.8): Form labels, source details, and supporting metadata. The rail’s small brand descriptor remains a compact 11px exception.

**The Reading Column Rule.** Keep long evidence copy within the implemented 74–76ch reading widths; reserve the serif face for evidence headings and case names.

## Layout

On wide screens a fixed 224px rail anchors the page. It narrows to 200px at 1199px, then becomes a sticky expandable top menu at 959px. Main content uses 40px side padding on wide screens and a 1650px maximum width. Repeated gaps and insets draw from the observed 8, 12, 16, 24, and 32px steps.

The map workspace uses a 280px filter and result column beside a map that spans the second column; the left column narrows to 250px with the rail. At 639px and below, filters, map, and results stack in that order. The four-version strip keeps four columns on desktop.

Long research pages pair a sticky contents rail with a 76ch reading body, then collapse to a contents block above the article on phones. On wide screens, the country page pairs a roughly 190px sticky country index with a 76ch strategy column. Below 1160px, a native country select replaces the index list. The comparison follows the country browser and becomes labeled rows on narrow screens; the existing photo and 3D supplements stay below the strategy content.

## Elevation & Depth

Resting surfaces are flat. Thin rules, white panels, and pale blue or amber fills establish the reading layers. The map status label is the only persistent shadowed overlay, lifted just enough to remain legible above the map.

**The Border-First Rule.** Use tonal fills and 1px rules to define resting surfaces. Reserve the soft shadow for the transient map status overlay.

## Shapes

The form language is mostly rectangular, with softly rounded controls and larger rounded map workspaces. Small radii mark fields and selection controls (4px), navigation links and photo frames (6px), and map or design workspaces (8px). One-pixel separators carry structure; cards do not rely on heavy outlines or offset shadows.

## Components

### Buttons
Buttons are compact task controls, not oversized calls to action. Primary actions use a solid petrol field; secondary actions use a white field and quiet border; source and reset actions use an underlined text treatment. Common controls are 44–46px high. Hover transitions use 160ms ease-out; visible keyboard focus uses a 3px outline.

### Chips
Filter choices remain rectangular. An unselected choice uses white and a line border; a selected choice uses a solid petrol fill and white text. Dataset and history selections use a pale wash with a green underline or other visible state.

### Cards / Containers
Map and design workspaces use white surfaces and cool borders with 8px corners. Research records often remain open rows instead of boxed cards. The map status label alone uses the documented shadow.

### Inputs / Fields
Native inputs and selects use a white field, a 1px blue-gray border, 4px corners, and a 46px minimum height. Search text remains at 16px to avoid small input text on mobile. Focus is explicit; ordinary fields do not add a custom hover fill.

### Navigation
The desktop rail is fixed, petrol, and vertically stacked. Links use 16px text and a 52px minimum height; the current route uses a pale fill and bold dark text. At 959px and below, the rail becomes a sticky top bar with an expandable menu.

### Signature Components
- **Version strip:** Four aligned dataset choices lead with count and coverage; the active choice uses a pale fill and green underline.
- **Map workspace:** Filters and results sit beside the map on desktop and return to filter → map → results order on phones. The default CARTO Positron basemap keeps geographic detail quiet behind the dated point colors; a labeled native select offers the original street map. If CARTO fails, a desaturated street layer at 55% opacity preserves the map with a visible fallback notice. Basemap changes retain the current view, records, and filters.
- **Country strategy:** Fourteen country and region entries lead with a four-step flow, expanded city facts, sources, and limits. Twelve equipment media supplements retain their photo, caption, credit, and license below the strategy.
- **Evidence note:** Warm fill and contrasting text keep a coverage or source limit attached to the relevant record.

## Do's and Don'ts

### Do:
- **Do** keep dates, sources, and completeness limits beside the counts they qualify.
- **Do** keep prices, observed results, and local interpretation distinct.
- **Do** retain each real country photograph's caption, source credit, license, and hash with its case.
- **Do** keep keyboard focus visible and use native controls for ordinary fields and disclosures.
- **Do** place filters before the map and results at phone widths.

### Don't:
- **Don't** describe differences between archived and official snapshots as removal totals, or coordinate differences as migration.
- **Don't** separate a claim from the source and coverage limit that bounds it.
- **Don't** add public downloads or attachments to the research presentation.
- **Don't** borrow decorative motifs from unrelated visual worlds.

## Country discovery and parts

The country page shows one selected country at a time and leads with its strategy. Keep the four-step operating flow, optional 0–100% chart, expanded city cases with eight shared facts, source lists, and warm-tinted limitation rows together in the reading column. The index covers fourteen countries and regions, including Hong Kong and Uruguay; those two have no matching media. Twelve photo and 3D supplements follow the strategy and keep their provenance with the relevant equipment case. On wide screens, use a roughly 190px sticky index with a 76ch content column; on smaller screens, show the native country select. Place the cross-country comparison below the browser and convert its cells into labeled rows at phone widths without changing table semantics. Keep the equipment media optional and preserve its source, cost, and model limitations.

The shared Three.js renderer loads only when the visitor selects 3D in a country's media supplement. Keep direct part selection with labeled button alternatives, deterministic seeking, and reduced-motion/offscreen suspension. Switching country ends the old guide. Preserve the photo, full caption, credit, license, and case limitations in the supplement. Source labels retain date and coverage text on narrow layouts; never normalize currencies or turn unknown costs into numbers.

## T1 physical proposal

The design route pairs the fixed T1 street-bin proposal with the existing four-purpose experience. Lead with the street/shopping-district use and three actions: demonstrate cleaning, open the current specification, or read the design process. Keep drawings, proposed dimensions, material choices, siting, maintenance, validation and unquoted costs in four native disclosures. Readable 16px copy and aligned specification rows carry detail without adding a second navigation system.

T1 defaults to a 48 × 42 × 110 cm envelope and a 22 × 14.3 cm opening centered at 82.5 cm. The 60 L capacity is a target, not measured volume. Sliders change the interactive appearance only; the fixed proposal remains explicit. Three.js shows the hood, replaceable panels, door and rolling liner. Motion respects reduced-motion settings. Preserve all other purposes and the text-only/WebGL-failure path. No drawing or animation is a fabrication document or a verified physical result.

The T1 design process is a Read surface between the interactive workspace and the detailed proposal. Use five primary ordered native disclosures: needs and evidence, same-need comparison, complete design, full-size operation mock-up, and engineering/metal prototype. Each closed stage shows its deliverable and current evidence status. Expanded content explains participants, the question, actions and advancement conditions. Keep acceptance, approved pilot and production/operations in one secondary disclosure after the five stages. T1 remains a candidate until comparison supports selection. The existing process jump control focuses its heading without changing the route hash; specification links open and focus their existing disclosure. Keep 16px body copy, one-column phone details and no completion percentages or invented field results.

## Siting history overlay

Keep `#siting` as the fourth history subview and link it from the existing T1 actions. Reuse the petrol and cool-paper palette. Load the same-origin overlay document only on first activation, size it to its content to avoid nested scrolling, and preserve its filters when switching routes. Keep a full-page navigation link and retry state. The embedded document hides its duplicate masthead, while the standalone page retains its return navigation. Actual sidewalk polygons and separately dated snapshot markers remain distinct; coverage, provisional width units and unverified installation status stay adjacent to the controls and details. Publish only the display document and its runtime controller; preserve research inputs privately.
