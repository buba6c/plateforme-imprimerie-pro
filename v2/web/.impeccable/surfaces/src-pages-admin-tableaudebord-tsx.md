---
version: 1
slug: "src-pages-admin-tableaudebord-tsx"
primary_target: "src/pages/admin/TableauDeBord.tsx"
related_targets: []
---

# Surface: Vue d'ensemble du gérant (admin dashboard)

Mode: Operate. Audience: owner/manager on a computer, non-expert staff vocabulary. Job: see in seconds what needs attention (late, unpaid, to validate, blocked) and where every job in progress stands. Constraints: data from /stats/apercu and /dossiers (role-filtered), WCAG AA, light/dark, works down to 390 px.

## Direction contract
THESIS: The shop's production wall. Every job in progress is a card pinned on a big board and slides column to column; problems are red magnets above the board. Refuses the stock SaaS arrangement of four KPI cards + chart + table.
OWN-WORLD: Night-blue rail (#0F1629/#1A2340) beside a pale workshop wall (#F4F6FA). Columns are wide lanes with a lane tab (stage pictogram + plain name + monumental count in Poppins). Cards are card-stock tickets: fixed plate = CMD number, customer, one plain line, due date, machine chip; left edge stripe in the stage color. Pink #E91E8C is reserved for "needs you now" magnets only. Cyan for action. Amber for late.
STORY: The owner understands at a glance what is late or unpaid, believes nothing is hidden, and clicks a magnet or a card to act.
FIRST VIEWPORT: Top band "À faire maintenant" with up to four large magnets (paiements à valider, livraisons en retard, dossiers à revoir, urgents) each with a huge number, a plain sentence and an arrow; under it, the four lanes Préparation, Impression, Livraison, Argent filling the rest of the screen; period switch moved to the money lane.
FORM: workshop production board, candidate 3 of 7 on my ordered list; seed key 50266cf3. Raises: plain-words next action on every card (airport wayfinding), pink reserved for attention (orienteering), monumental counts (type specimen), fixed card plate (character catalog), crisp lane tabs (high-density web).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
