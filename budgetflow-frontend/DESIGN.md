---
omd: 0.1
brand: BudgetFlow
bootstrapped_from: alipay
bootstrapped_at: 2026-06-22T11:14:29+09:00
---

# Design System Inspiration of BudgetFlow

## 1. Visual Theme & Atmosphere

BudgetFlow is a Korean finance-operations admin product for small companies and sole proprietors: Slack-linked expense intake, AI analysis, human review, institution-ready Excel export, and tax-readiness preparation (evidence checks, VAT review candidates, accountant/self-filing packets). Its interface should read like Ant Design applied to a focused internal SaaS console: calm Daybreak Blue on clean white surfaces, neutral-gray structure, dense tables and forms, and semantic status colors that mean exactly one thing.

The product personality is clear, dependable, and procedurally precise. BudgetFlow should not feel like a marketing site, consumer wallet, or playful automation demo. It should feel like a work surface an operating team can open repeatedly, scan quickly, and trust when a risky expense needs review.

**Key Characteristics:**
- **Daybreak Blue `#1677FF`** as the primary action, focus, link, and info color.
- Clean white containers on a light gray app background, with 1px borders as the default separation.
- Status color is semantic only: green = approved/success, gold = review/warning, red = missing/rejected/error, blue = processing/info.
- **14px base type** for dense admin screens; headings use 600 weight, not heavy 700.
- **8px spacing grid**, 6px controls, 8px panels/modals.
- Tables, review queues, and multi-field forms are first-class surfaces.
- Motion is brief and calm; no bouncy, celebratory, or decorative motion.

## 2. Color Palette & Roles

### Brand / Primary
- **Daybreak Blue** (`#1677FF`): primary buttons, links, active navigation, focus rings, processing/info status.
- Hover: `#4096FF`.
- Active: `#0958D9`.
- Pale selected fill: `#E6F4FF`.

### Blue Value Ladder
`#E6F4FF` · `#BAE0FF` · `#91CAFF` · `#69B1FF` · `#4096FF` · **`#1677FF`** · `#0958D9` · `#003EB3` · `#002C8C` · `#001D66`

### Functional / Status
- **Success Green** (`#52C41A`): approved expenses, generated exports, completed sync.
- **Warning Gold** (`#FAAD14`): review needed, non-blocking risk, pending confirmation.
- **Error Red** (`#FF4D4F`): missing evidence, rejected expenses, failed mutations, destructive confirmation.
- **Info Blue** (`#1677FF`): processing, syncing, selected project state.

### Neutral (Text)
- Primary text: `#000000E0`.
- Secondary text: `#000000A6`.
- Muted/disabled text: `#00000040`.
- Use opacity-derived black/white neutrals before inventing gray hex values.

### Neutral (Surface & Border)
- Page background: `#F5F5F5`.
- Container/card/modal: `#FFFFFF`.
- Table header: `#FAFAFA`.
- Default border/input: `#D9D9D9`.
- Subtle split/divider: `#0000000F`.
- Row/list hover: `#0000000A`.

## 3. Typography Rules

### Font Stack
```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif
```

BudgetFlow uses system UI fonts first, with Korean fallbacks. Do not introduce decorative display fonts or heavy remote font loading for admin surfaces.

### Size Scale
| Role | Size | Weight | Line Height |
|---|---:|---:|---:|
| Heading 1 | 30px | 600 | 1.27 |
| Heading 2 | 24px | 600 | 1.33 |
| Heading 3 | 20px | 600 | 1.40 |
| Heading 4 / panel title | 16px | 600 | 1.50 |
| Body / table / form | 14px | 400 | 1.5715 |
| Small / captions / tags | 12px | 400-500 | 1.50 |

### Conventions
- 14px is the admin-density anchor.
- Headings use 600; reserve 700 only for compact brand marks or exceptional emphasis already established in a component.
- Money, counts, and percentages use tabular numerals.
- Korean copy should remain short and concrete; avoid slogan-like headings inside task surfaces.

## 4. Component Stylings

### Buttons
- Primary: `#1677FF` background, white text, 6px radius, 32-40px height depending on density, hover `#4096FF`, active `#0958D9`.
- Default/outline: white background, `#D9D9D9` border, primary text, hover border/text Daybreak Blue.
- Ghost/text: transparent, muted text by default, hover `#0000000A` fill.
- Danger: `#FF4D4F` for destructive confirmation; do not use red for ordinary rejection filters unless the state is actually error/destructive.

### Inputs
- White background, 1px `#D9D9D9` border, 6px radius, 14px text.
- Focus: Daybreak Blue border plus faint blue ring.
- Error: Dust Red border plus one actionable helper line.
- Disabled: `#F5F5F5` fill and `#00000040` text.

### Cards / Panels
- White background, 1px `#D9D9D9` or subtle border, 8px radius.
- Padding: 16px for dense panels, 24px for primary dashboard panels.
- Shadow is absent by default. Use subtle shadow only for hoverable cards or floating surfaces.

### Tables
- White rows, `#FAFAFA` header, 14px text, split dividers, hover fill `#0000000A`.
- Amount columns align right with tabular numerals.
- Status uses semantic tags; do not encode risk by color alone.

### Tags / Badges
- 4px radius, 12px text, compact horizontal padding.
- Approved: green text/fill/border. Review: gold. Missing/rejected/error: red. Processing/export info: blue unless export means completed, then green.

### Navigation
- Desktop admin uses a fixed left sidebar or compact rail plus fluid content.
- Active item uses Daybreak Blue text/fill or, on dark sider, a blue selected state with white text.
- Breadcrumbs and secondary nav use secondary text; current location uses primary text.

### Modals
- White, 8px radius, 20-24px padding, elevated shadow, black translucent backdrop.
- Confirmation copy states exactly what will happen to the expense/project/export.

## 5. Layout Principles

### Spacing
| Token | Value |
|---|---:|
| `space-xs` | 8px |
| `space-sm` | 12px |
| `space-md` | 16px |
| `space-lg` | 24px |
| `space-xl` | 32px |

### Grid
- Use full-width admin layouts for project, expense, and settings workspaces.
- Use two-column desktop layouts only when the relationship is obvious, such as list + detail or settings nav + panel.
- Forms are label-top on narrow screens and may become compact multi-column forms on wide screens.

### Density
BudgetFlow is medium-to-high density. It should carry many expenses, statuses, reasons, and export controls without feeling bloated. Prefer organized tables, segmented controls, compact toolbars, and stable row/card dimensions over large decorative cards.

## 6. Depth & Elevation

Depth is restrained and layered. Most surfaces use a border, not a shadow.

| Level | Treatment | Use |
|---|---|---|
| Flat surface | 1px border, no shadow | panels, forms, tables |
| Subtle lift | `0 1px 2px rgba(0,0,0,.03), 0 2px 4px rgba(0,0,0,.02)` | clickable cards, selected summaries |
| Floating | `0 6px 16px rgba(0,0,0,.08), 0 9px 28px rgba(0,0,0,.05)` | dialogs, popovers, menus |

Sticky nav sits above page content. Dialogs, command popovers, and confirmation masks sit above navigation. Toasts and tour overlays sit at the top layer but must not cover primary review actions.

## 7. Do's and Don'ts

- **DO** use `#1677FF`, `#4096FF`, and `#0958D9` for primary state changes.
- **DON'T** keep legacy teal or invent near-blue variants for primary UI.
- **DO** use green/gold/red/blue only for their semantic meanings.
- **DON'T** use status colors as decoration or visual variety.
- **DO** build hierarchy with size, weight 600, spacing, and opacity.
- **DON'T** use 700-weight headings across panels.
- **DO** keep controls at 6px radius and panels at 8px.
- **DON'T** use pill controls for standard admin actions; reserve full pills for progress dots or intentionally compact counters.
- **DO** keep dense screens efficient at 14px.
- **DON'T** turn admin workspaces into landing-page cards or oversized hero sections.

## 8. Responsive Behavior

| Breakpoint | Width | Behavior |
|---|---:|---|
| `xs` | `<576px` | Single column, bottom or collapsed nav, cards instead of wide tables |
| `sm` | `>=576px` | Compact filters, stacked panels |
| `md` | `>=768px` | Two-column patterns can appear |
| `lg` | `>=992px` | Sidebar and table-first admin layout |
| `xl` | `>=1200px` | Full review workspace with summaries and actions |

Tables may scroll horizontally on mobile only when columns are genuinely required. Expense review should otherwise switch to stacked cards with the same semantic status tags. Touch targets must remain at least 44px on mobile even when desktop density is compact.

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary/link/info: `#1677FF`; hover `#4096FF`; active `#0958D9`.
- Success: `#52C41A`; warning: `#FAAD14`; error: `#FF4D4F`.
- Primary text: `#000000E0`; secondary: `#000000A6`; disabled: `#00000040`.
- Page: `#F5F5F5`; container: `#FFFFFF`; header: `#FAFAFA`; border: `#D9D9D9`.

### Example Component Prompts
- "Create a BudgetFlow primary button in Ant Design style: Daybreak Blue background, white text, 6px radius, 14px type, calm hover/active states."
- "Build an expense review table: white rows, `#FAFAFA` header, 14px text, subtle dividers, right-aligned tabular money, semantic review/approved/missing tags."
- "Design a project settings field: white input, 1px neutral border, 6px radius, Daybreak Blue focus ring, inline red helper text only for actionable errors."

### Iteration Guide
1. Primary blue is the anchor; do not keep legacy teal for core UI.
2. Color is semantic. Use status colors only for states.
3. 14px base plus 8px grid. Compact is acceptable when hierarchy is clear.
4. 6px controls and 8px cards. Avoid pill-shaped standard controls.
5. Border-first depth. Shadows are for floating UI.
6. Calm motion only: 100ms hover, 200ms component transitions, 300ms modal/drawer.

## 10. Voice & Tone

BudgetFlow's voice is clear, operational, and procedurally precise. It tells admins what happened, what needs review, and what action will happen next. The voice is Korean-first, direct, and calm. It does not expose implementation details unless they help the admin make a decision.

| Context | Tone |
|---|---|
| Buttons / CTAs | Immediate result: `승인`, `반려`, `엑셀 생성`, `프로젝트 만들기`. |
| Review status | Specific state: `검토 필요`, `승인 완료`, `증빙 없음`, `처리 중`. |
| Confirmation | State the target and consequence before final action. |
| Pending states | Honest and non-final: `처리 중입니다`, `엑셀을 생성하고 있습니다`. |
| Error messages | Blameless, actionable, one sentence near the failed action. |
| Empty states | One explanation plus one next action. No mascot or jokes. |
| Export/disclosure | Precise and complete; note excluded or unapproved expenses explicitly. |

Forbidden: hype, fake productivity claims, decorative exclamation marks, vague errors like `문제가 발생했습니다` without recovery, and auth architecture copy on the login screen.

## 11. Brand Narrative

<!-- omd:limitation BudgetFlow project history and official tagline were not supplied. Replace factual placeholders before shipping public brand materials. -->
BudgetFlow is a finance-operations dashboard for small companies and sole proprietors that receive expense evidence through Slack, review risk cases manually, export approved expenses into institution-ready Excel files, and prepare tax materials before handing them to a 세무사 or self-filing. It exists to reduce repetitive bookkeeping and pre-filing cleanup — and the tax fees paid for that cleanup — without removing human accountability from approval and final tax decisions.

The design system borrows Ant Design's certainty: a token has one job, a status color has one meaning, and each screen should make the next operational action visible. BudgetFlow refuses decorative dashboards, fake metrics, OCR-first positioning, and automatic final approval in risky cases. It embraces structured review, explicit export boundaries, and dependable admin density.

## 12. Principles

1. **Certainty.** Every state is named plainly and rendered consistently. *UI implication:* the same `검토 필요` badge looks and behaves the same in summaries, tables, and modals.

2. **Meaningful color.** Blue, green, gold, and red carry product state. *UI implication:* never borrow warning gold or error red for decoration.

3. **Human review stays visible.** Automation can draft and classify, but risky decisions remain inspectable. *UI implication:* review reasons sit next to editable fields and final actions.

4. **Density with order.** Admins need to scan many expenses. *UI implication:* tables, compact filters, priority strips, and stable spacing matter more than spacious marketing composition.

5. **Export integrity.** The system must make approved, excluded, and unready expenses clear before Excel generation. *UI implication:* export screens show eligibility, exclusions, and status before the primary action.

6. **Calm by default.** Motion and copy support confidence. *UI implication:* no bouncy transitions, fake celebration, or ambiguous pending/success language.

## 13. Personas

<!-- omd:limitation Personas are product archetypes inferred from the current BudgetFlow TaxOps contract, not verified research participants. Replace with researched personas when available. -->

**소규모 법인 재무 담당자, 32, Seoul.** Collects card receipts and invoices each month, checks missing evidence and VAT review candidates, and prepares a handoff packet for the company's 세무사. Wants clear tax-readiness status and minimal manual cleanup before the filing deadline.

**개인사업자 대표, 38, 인천.** Runs the business alone, has weak in-house accounting, and wants to reduce what is paid to a 세무사 for repetitive data cleanup. Needs to know which expenses are deduction candidates and which are blocked before submission.

**협업 세무사, 45, Seoul.** Receives the company's prepared packet, focuses on final classification, 세무조정, and filing. Wants a predictable review queue with reasons and explicit exclusions, not raw unsorted receipts.

## 14. States

| State | Treatment |
|---|---|
| Empty project list | White panel, one secondary text line, primary create action. |
| Empty filtered expenses | One exact explanation: no rows match the current filter. Keep filters visible. |
| Loading page/table | Skeleton rows or stable loading text at final dimensions; avoid layout jump. |
| Loading action | Button disabled with spinner/text; never show success until mutation resolves. |
| Review needed | Gold tag/fill, reason visible near the row or field. |
| Missing evidence | Red tag/fill, evidence requirement and recovery action nearby. |
| Approved | Green tag/fill, eligible for export unless another blocker is present. |
| Processing | Blue tag/spinner, honest pending copy. |
| Rejected | Red or neutral treatment depending on severity; pair with explicit reason. |
| Export generated | Green success treatment with generated file row and timestamp. |
| Disabled | `#F5F5F5` fill, disabled text, unchanged layout size. |

## 15. Motion & Easing

BudgetFlow motion follows Ant Design's naturalness: brief, useful, and unremarkable.

| Token | Value | Use |
|---|---:|---|
| `motion-fast` | 100ms | hover and small state changes |
| `motion-mid` | 200ms | tabs, dropdowns, inline transitions |
| `motion-slow` | 300ms | modal/drawer enter and exit |

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.645, 0.045, 0.355, 1)` | default component transition |
| `ease-out` | `cubic-bezier(0.215, 0.61, 0.355, 1)` | arriving popovers/drawers |
| `ease-in` | `cubic-bezier(0.55, 0.055, 0.675, 0.19)` | dismissals |

No spring or overshoot on finance actions. Sync pulses and progress changes may animate subtly, but confirmations, errors, and export states must stay calm. Under `prefers-reduced-motion: reduce`, collapse transitions toward instant and preserve all functionality.

<!--
OmD v0.1 Sources — BudgetFlow / Ant Design

Base reference: `.claude/data/references/alipay/DESIGN.md`, the catalog entry that documents Alipay/Ant Design's Daybreak Blue, semantic status colors, 14px base type, 6px radius, 8px spacing, border-first density, and calm motion.

Project context preserved from the previous BudgetFlow DESIGN.md: Korean admin SaaS, `/login`, `/projects`, `/expenses`, `/settings`, Slack-linked expense intake, human review, approved-only Excel export, no OCR-first positioning, no automatic final approval.

Limitation: BudgetFlow founding date, official tagline, and researched personas were not provided. §11-13 include marked placeholders/inferred archetypes and should be replaced before public brand use.
-->
