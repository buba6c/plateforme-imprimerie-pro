# Design System: Evoprint Imprimerie

## 1. Visual Theme & Atmosphere
A balanced, modern dashboard interface for a professional printing platform ("Imprimerie"). The atmosphere is clean, structured, and operational. It uses an "App Balanced" density and "Fluid CSS" motion. It must feel like a premium, reliable enterprise tool rather than a generic SaaS. Absolute clarity in data presentation is crucial.

## 2. Color Palette & Roles
- **Canvas Light** (#F5F7FA) — Primary background surface for the whole page
- **Pure Surface** (#FFFFFF) — Cards, modals, and container fill
- **Deep Navy Ink** (#0F4C81) — Primary text, deep headers, extreme contrast
- **Muted Steel** (#71717A) — Secondary text, descriptions, metadata
- **Whisper Border** (rgba(46,46,46,0.08)) — Card borders, structural lines, dividers
- **Evoprint Blue** (#1A73E8) — Single primary accent for CTAs, active states, focus rings
- **Coral Warning** (#FF6F61) — Secondary bold accent used VERY sparingly for critical actions

Status Colors:
- **Success** (#10B981)
- **Warning** (#F59E0B)
- **Danger** (#EF4444)
- **Info** (#3B82F6)

## 3. Typography Rules
- **Display:** `Satoshi` or `Geist` — Track-tight, controlled scale, weight-driven hierarchy.
- **Body:** `Satoshi` or `Geist` — Relaxed leading, neutral secondary color.
- **Mono:** `Geist Mono` or `JetBrains Mono` — For order numbers (e.g., CMD-1029), timestamps, prices (e.g., 45,000 FCFA), and metrics.
- **Banned:** Inter, generic system fonts (`Arial`, `Roboto`). Serif fonts are strictly BANNED in this dashboard context.

## 4. Component Stylings
* **Buttons:** Flat, 0.5rem radius. Tactile -1px translateY on active/hover. Evoprint Blue fill for primary, ghost/outline with Deep Navy Ink for secondary. No outer glows.
* **Cards:** Clean 0.75rem rounded corners. Very subtle shadow (`0 1px 2px rgba(0,0,0,0.04)`). Used only to group semantic data.
* **Inputs/Forms:** Label above input, error text below. Focus ring is `0 0 0 3px rgba(26,115,232,0.35)`.
* **Badges:** Pill-shaped (`border-radius: 9999px`), bold uppercase text, very light transparent background of the status color.
* **Tables/Lists:** Clean horizontal dividers. Monospace for IDs and amounts.

## 5. Layout Principles
- Strict CSS Grid for dashboards. No flexbox percentage math.
- Desktop-optimized: Use sidebars for main navigation, top bars for context/search.
- Cards must have generous internal padding (1.5rem).
- No overlapping elements — clean spatial separation always.
- Single-column collapse below 768px.

## 6. Motion & Interaction
- Spring physics default for layout changes.
- Hover states on cards elevate slightly and increase border opacity (`border-color: rgba(26,115,232,0.3)`).
- Menus and dropdowns fade in with a slight vertical slide.

## 7. Anti-Patterns (Banned)
- No emojis anywhere.
- No `Inter` font.
- No generic serif fonts.
- No pure black (`#000000`).
- No neon glows or AI purple gradients.
- No 3-column equal grids for feature rows if variance is high, but acceptable for metric cards.
- No AI copywriting clichés ("Elevate", "Seamless", "Next-Gen").
- No fake fabricated data (Use clear labels like `[Client Name]`, `[Amount] FCFA` if needed).
