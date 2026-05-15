# Pillar 12 — UI/UX System

**Status:** Planning
**Depends on:** Pillars 1-11
**Estimated effort:** 4-5 sessions (UI is broad)

The visual + interaction language. Mohammed asked for: **ممتع، حي، غني، مؤتمت، فيه معلومات قيمة فعلاً**. Translation: fun + alive + dense + smart. We adopt the **Linear + Vercel** vibe (keyboard-first, dark, dense, beautiful) blended with **Arc's playfulness** (subtle animations with purpose, personality in copy).

---

## 1. Goals

- A design system: tokens, components, layout primitives, motion patterns.
- RTL-first (Arabic) with full English toggle.
- Keyboard-first navigation (Cmd+K palette for everything).
- Dark mode primary; light mode optional.
- Information density without clutter.
- Personality in copy + microcopy (Mohammed wants the team to LOVE it).
- Performance: every page renders in <1.5s; key interactions <100ms.

## 2. Success Criteria

1. Cmd+K → search/create/navigate anything in <2 keystrokes.
2. Project page renders in <1.5s with 100 deliverables + 30 messages.
3. RTL toggle works without visual glitch; mirrored where appropriate.
4. Mobile (PWA) works for all critical actions: check-in, project status, approve drafts, view tasks.
5. A new team member uses the system productively on day 1 (no training docs read).

---

## 3. Design Tokens

`packages/ui/src/tokens.ts`:

```typescript
export const tokens = {
  color: {
    // Backgrounds
    bg:        "#0b0d0e",
    surface:   "#14181a",
    surface2:  "#1a1f22",

    // Borders
    line:      "#2a3136",
    line2:     "#3a4248",

    // Text
    text:      "#e8ece9",
    mute:      "#7d8a90",
    mute2:     "#566268",

    // Action / Accent
    accent:    "#f5d60a",       // Volt yellow
    accentDim: "#8a7a10",

    // Semantic
    success:   "#6cd29a",
    warning:   "#ff8b3d",
    danger:    "#ff5a5a",
    info:      "#3dd8ff",
  },
  radius: {
    none: "0",
    sm:   "2px",
    md:   "4px",
    lg:   "8px",
  },
  spacing: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", "2xl": "32px" },
  fontFamily: {
    mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
    sans: ['"IBM Plex Sans Arabic"', "ui-sans-serif", "system-ui"],
  },
  fontSize: { xs: "11px", sm: "12px", base: "13px", md: "14px", lg: "16px", xl: "18px", "2xl": "22px" },
};
```

Tailwind config consumes these.

### Design rules (locked)

1. **No rounded corners on panels** (sharp industrial). Buttons OK with `radius.sm`.
2. **No emojis in UI** — Lucide React icons only.
3. **Mono for ALL codes, IDs, dates, numbers** (PRJ-0023, 25/05/2026, SAR 15,000).
4. **Yellow = action**: primary CTAs, active states, unread badges.
5. **Status pills**: 8px dot prefix + uppercase mono label.
6. **Information density**: 13px base size, tight line-height.
7. **Corner accents**: subtle dashed brackets on hero cards (4px lines, 8px from edges).
8. **Industrial vibe**: like aviation cockpit or studio control board.

---

## 4. Component Library Plan (`packages/ui/`)

shadcn/ui as the base; we customize per the tokens above.

| Component | Notes |
|-----------|-------|
| `Button` | Variants: primary (yellow), secondary (border), ghost, danger |
| `Input` | Mono font for codes; auto-validation; RTL-aware |
| `Select` | Searchable; supports multi-select |
| `DataTable` | Dense, sortable, sticky header, keyboard nav |
| `Tabs` | Underline style; keyboard nav |
| `Dialog` | Centered, max-w 600px |
| `Drawer` | Slides from right (RTL: from left) |
| `Toast` | Top-right; auto-dismiss |
| `StatusPill` | 8px dot prefix + uppercase mono |
| `MoneyDisplay` | Formats SAR amounts with mono font |
| `DateDisplay` | Relative + absolute (e.g., "3 days ago • 12 May") |
| `Avatar` | With fallback initials in Arabic + English |
| `MentionInput` | @-mentions resolving to profiles |
| `EmptyState` | Illustration + helpful action |
| `CommandPalette` | Cmd+K — see §5 |
| `LiveActivity` | Streaming feed of activity_events |
| `LangToggle` | AR/EN switch with dir attribute swap |
| `Kbd` | Keyboard shortcut badge |
| `ProgressRing` | For completion percentages |
| `SkeletonRow` | Loading state for tables |
| `TimelineRow` | For project_stages_log |

---

## 5. The Cmd+K Command Palette

The "spine" of keyboard navigation.

Actions:
- **Navigate**: type "MG GT" → matches client/project/contact, hit enter.
- **Create**: "n project" → new project flow.
- **Search**: "@mansoury" → find threads/projects involving him.
- **Act**: "approve draft 23" → invoke action with confirmation.
- **Ask**: "?" prefix opens Ask Antagna (AI chat surface).

Implementation: `cmdk` library + custom registry of commands per route.

---

## 6. Layout Primitives

```
┌─────────────────────────────────────────────────────────────┐
│  Top bar: logo · breadcrumb · search · user · notifications │  (48px)
├─────────────────────────────────────────────────────────────┤
│ Sidebar  │ Main content                                     │
│ (200px)  │                                                  │
│  · Home  │                                                  │
│  · CRM   │                                                  │
│  · Proj  │                                                  │
│  · Equip │                                                  │
│  · Tasks │                                                  │
│  · Inbox │                                                  │
│  · KPIs  │                                                  │
│  · Admin │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

Mobile: sidebar collapses to a bottom-tab bar (5 tabs: Home, Inbox, +Action, Tasks, Profile).

---

## 7. Key Page Specs

### 7.1 Home dashboard (per role)

Tiles arranged in a 12-col grid. Each tile:
- Title + value + delta vs last period
- Sparkline if applicable
- Click → drilldown view

### 7.2 Inbox (unified comms)

3-pane layout:
- Left: threads list (sortable by last activity, filterable by status/assignee/client).
- Middle: thread view (chronological messages, attachments inline).
- Right: context panel (project link, client info, AI summary, action buttons).

Keyboard: `j/k` to navigate threads, `r` to reply, `s` to snooze, `a` to assign.

### 7.3 Project detail

Tabs: Overview / Brief / Deliverables / Tasks / Timeline / Files / Comms / Money.

Header: status pill + assignee chips + due date + AI status paragraph (yellow card on the right with "Refresh" button).

### 7.4 Deliverables review (replaces Hara_BMW sheet)

Table:
- Column: # | Thumbnail | Title | Status pill | Latest client note | Updated | Actions
- Inline approve/reject buttons
- Status pills clickable to change (with confirmation if backward transition).

Public client view (`/p/<token>`) shows same table minus internal columns.

### 7.5 Equipment catalog

Grid view: image thumbnails + status pill + code (mono).
Table view: dense data.
Filter chips: category, status, location.
Reservation calendar overlay.

### 7.6 Calendar

Two views: month (gantt-like blocks) + day (timeline). Filter by project / crew / equipment.

### 7.7 KPI dashboards

Per-role tile grids per Pillar 9 §6.

---

## 8. Motion & Microcopy

### Motion rules
- Page transitions: 200ms fade + 4px slide.
- State changes (status pill): 150ms scale 0.95→1.
- Toast enter: 250ms slide from top + fade.
- Skeleton loaders: shimmer at 1.5s period.
- Never animate critical CTAs to grab attention — that's slot-machine behavior.

### Microcopy
- Empty states: helpful + slightly playful. e.g., "ما فيش مشاريع بعد. ابدأ بـ Cmd+K → 'new project'."
- Errors: clear + actionable. e.g., "ما قدرناش نحفظ. حاول تاني، ولو استمر، ابعت لـ HR."
- Success: small + brief. e.g., "تم ✓"
- Loading: "..." not "Loading...".

---

## 9. RTL/LTR

next-intl handles locale + direction. UI primitives accept `dir="rtl|ltr"` and adjust:
- Sidebar mirrors.
- Icons that have direction (back arrow ←/→) flip.
- Text-align follows direction.
- Numbers stay LTR even in Arabic text (Saudi convention).
- Mono content (codes, dates) always LTR within text.

CSS logical properties (`margin-inline-start` instead of `margin-left`) for clean RTL handling.

---

## 10. Performance Budget

| Page | Target FCP | LCP | TTI |
|------|------------|-----|-----|
| Home | 800ms | 1.2s | 1.5s |
| Project | 600ms | 1.3s | 1.8s |
| Inbox | 700ms | 1.5s | 2.0s |
| Catalog | 700ms | 1.4s | 1.8s |

Strategies:
- Next.js App Router with proper streaming.
- Server Components by default; Client Components only where interaction needs it.
- React Query with stale-while-revalidate.
- Supabase Realtime for live updates instead of polling.
- Skeleton loaders for perceived speed.
- Image optimization (Next.js Image).

---

## 11. Acceptance Checklist

- [ ] `packages/ui` initialized with tokens + 20+ components.
- [ ] Storybook (or simple component showcase route at `/app/dev/components`).
- [ ] Cmd+K palette functional with at least 10 commands.
- [ ] AR/EN toggle works on every page.
- [ ] Home dashboards per role render with mock data.
- [ ] Project detail page renders all tabs with sample data.
- [ ] Inbox 3-pane layout renders with keyboard nav.
- [ ] Deliverables review with status changes recorded in audit.
- [ ] Mobile (PWA) renders Home + Inbox + Tasks + Profile.
- [ ] Performance budget met on staging deploy.
- [ ] Light mode renders without breaking.

---

## 12. Deferred

- **Customizable dashboards** (drag-drop tile config) → Phase 2.
- **Themes beyond dark/light** → Phase 2.
- **Animations beyond the core set** → as needed.
- **i18n for languages beyond AR/EN** → Phase 2 (if Urdu, Hindi etc. become relevant).

---

## 13. Next: Pillar 13 — Integrations
