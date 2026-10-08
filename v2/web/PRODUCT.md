# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Primary: the owner/manager (admin) on a computer.** Pilots the print shop: production in progress, payments to validate, cash, prices, statistics, users, settings, AI assistant, files. Confirmed as the heaviest user (8 Oct 2026).
- Preparers (computer): receive customers, build quotes, create job folders, upload files.
- Printers Roland (large format) and Xerox (digital): follow their print queue near the machines.
- Delivery driver (phone, outdoors): round, call the customer, collect payment (cash, Wave, Orange Money).
- Staff of a print shop in Dakar, Senegal; not software experts. French-language interface.

## Product Purpose
Evocom Print v2 replaces the shop's previous platform: one place where every job ("dossier") goes from file to customer — preparation, printing on Roland or Xerox, delivery, payment — with quotes and invoices computed by a deterministic price engine. Success: anyone in the shop knows at a glance what to do next, and the owner sees what is late, what is unpaid and what must be validated.

## Operating Context
- Daily flow: quote (devis) → job folder (dossier, CMD-YYYY-NNNN) → validation with files → print (Roland m², Xerox per page/sheet) → ready to deliver → delivery round → payment collected → validated by admin → closed; invoice (FAC-) on demand.
- Amounts in whole FCFA. Payment modes: cash, Wave, Orange Money, card, cheque, transfer.
- ~3,000 historical jobs, ~4,900 print files (60 GB) imported from the old platform.
- Runs on a VPS (evocomprint.site); real-time updates in the open app.

## Capabilities and Constraints
- Roles and permissions are enforced by the server; the UI shows only actions the server returns.
- One workflow table (shared/src/workflow.ts) drives both permissions and buttons.
- Prices come only from the engine; the AI assistant only proposes specifications, never prices.
- Accessibility: every text/background pair must pass WCAG AA (checked by scripts/verif-contrastes.mjs); light and dark modes; 390 px phones.
- React 19 + Vite, lucide-react icons, CSS variables generated from src/styles/tokens.json.

## Brand Commitments
- Official Evocom identity from evocom-sn.com: bird logo (public/marque/), cyan #33B5E5, pink #E91E8C, night blue #0F1629 / #1A2340, Poppins for headings, Inter body on the website.
- Owner's verdict (8 Oct 2026): current UI is "trop basique" and hard to understand for non-experts; main problem is **too much text and jargon**.

## Evidence on Hand
- Real logo and brand colors (public/marque/, evocom-sn.com). Real imported data on the VPS; local demo data via scripts/demo-data.ts. No testimonials or customer quotes to use.

## Product Principles
1. Plain words before system words: say what happened and what to do next, in everyday French.
2. One obvious next action per screen and per job.
3. Show, don't list: state, urgency and money are visible before they are read.
4. The owner sees problems first (late, unpaid, to validate), details second.
5. Never trade correctness or permissions for looks.

## Accessibility & Inclusion
WCAG AA contrast in light and dark; large touch targets on phones; meaning never carried by color alone.
