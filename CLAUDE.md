# CLAUDE.md — worker-assignment

This file provides full context for Claude Code to work on this project autonomously.
Read this file fully before writing any code or making any changes.

---

## Project Overview

A web application for two domains at Yi Hui Tech (internal tooling):

1. **Projects domain** — daily worker assignment to projects, timesheets, and rolling labour cost tracking
2. **Trips domain** — truck trip dispatch, bin tracking, and WhatsApp message generation for drivers

**Live URL:** Deployed on Vercel (staging)
**Repo:** https://github.com/yihui-tech/worker-assignment
**Companion app:** `trips-records` (driver-facing, runs on localhost:3001 in dev) shares the same Supabase project

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 16.2.6 (App Router), React 19, Tailwind CSS v4, TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (not yet implemented) |
| Deployment | Vercel |

---

## Essential Commands

```bash
npm install          # Install dependencies
npm run dev          # Run dev server (localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
```

---

## Project Structure

```
app/
  components/
    Nav.tsx              # Top navigation bar (two sections: Projects | Trips)
  page.tsx               # Home dashboard (cost summary + bin locations)
  analytics/
    page.tsx             # Bin swap analytics per customer site (week/month toggle)
  assignments/
    page.tsx             # Daily worker assignment page
  bins/
    page.tsx             # Bin inventory management (CRUD + type/size/location filters + days at site)
  cost/
    page.tsx             # Rolling cost dashboard per project
  customers/
    page.tsx             # Customer management (CRUD + multi-site management)
  projects/
    page.tsx             # Project creation and management
  timesheets/
    page.tsx             # Timesheet entry per worker per project
  trips/
    page.tsx             # Trip dispatch, bin movements, WhatsApp message generation, drag-to-reorder
  lib/
    supabase.ts          # Supabase client initialisation
  layout.tsx             # Root layout with Nav
  globals.css            # Global styles (dark mode disabled)
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xshucanagbaxgfirtbuc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both apps (worker-assignment and trips-records) share the same Supabase project in staging.

---

## Database Schema

> Schema reflects actual Supabase table structure. All columns nullable unless marked NOT NULL / PK.

### workers
```sql
employee_id  text PRIMARY KEY        -- Format: YH0001 (from Times Software HR)
nric         text UNIQUE             -- Singapore NRIC
name         text NOT NULL
monthly_rate numeric NOT NULL        -- Gross monthly salary in SGD
role         text
active       boolean
created_at   timestamptz
```

### projects
```sql
id           uuid PRIMARY KEY
name         text NOT NULL
location     text
start_date   date
end_date     date
status       text                    -- active | completed | on-hold
created_at   timestamptz
```

### assignments
```sql
id             uuid PRIMARY KEY
worker_id      text REFERENCES workers(employee_id)
project_id     uuid REFERENCES projects(id)
assigned_date  date NOT NULL
shift          text                  -- full_day | morning | afternoon
notes          text
created_at     timestamptz
-- UNIQUE (worker_id, assigned_date, shift)
```

### timesheets
```sql
id             uuid PRIMARY KEY
worker_id      text REFERENCES workers(employee_id)
project_id     uuid REFERENCES projects(id)
date           date NOT NULL
regular_hours  numeric
ot_15_hours    numeric               -- OT at 1.5x multiplier
ot_20_hours    numeric               -- OT at 2.0x multiplier
source         text                  -- manual | csv_import
created_at     timestamptz
```

### vehicles
```sql
plate_number      text PRIMARY KEY   -- e.g. SBX1234A
default_driver_id text               -- references drivers(employee_id)
vehicle_type      text
status            text
purpose           text
supervisor        text
cartrack          boolean            -- GPS tracking installed
coe_expiry        date
ownership_type    text               -- company | leased
leasing_cost      numeric
depreciation      numeric
insurance_premium numeric
road_tax          numeric
vpc_season_parking numeric
created_at        timestamptz
```

### drivers
```sql
employee_id    text PRIMARY KEY      -- matches workers.employee_id format
nric           text NOT NULL
name           text NOT NULL
contact_number text
license_class  text                  -- e.g. Class 3, Class 4
supervisor     text
status         text                  -- active | inactive
monthly_salary numeric
access_token   uuid                  -- used by trips-records app for driver auth
created_at     timestamptz
```
> `access_token` is the simple auth mechanism for the trips-records driver app (pre-full Auth implementation).

### customers
```sql
customer_id    integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY
name           text NOT NULL
contact_person text
contact_number text
address        text
created_at     timestamptz
```

### customer_locations
```sql
id             integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY
customer_id    integer REFERENCES customers(customer_id)
name           text NOT NULL         -- site name, e.g. "Tuas Plant"
address        text
contact_person text
contact_number text
created_at     timestamptz
```
> One customer can have multiple named sites. Both `trips` and `bins` reference `customer_location_id` to track which specific site a pickup/bin relates to. Legacy records use `customer_id` directly (still supported).

### locations
```sql
id         integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY
name       text NOT NULL
address    text                      -- used as dropoff destination in trips
created_at timestamptz
```

### trips
```sql
id                   uuid PRIMARY KEY
vehicle_number       text REFERENCES vehicles(plate_number)
driver_id            text REFERENCES drivers(employee_id)
customer_id          integer REFERENCES customers(customer_id)       -- pickup source (customer)
customer_location_id integer REFERENCES customer_locations(id)       -- specific site within customer (nullable)
dropoff_id           integer REFERENCES locations(id)                -- dropoff destination (yard/location)
requester            text
remarks              text
status               text            -- open | completed | cancelled
trip_order           integer         -- display order for drag-to-reorder
created_at           timestamptz
completed_at         timestamptz
```

### trip_bins
```sql
id         uuid PRIMARY KEY
trip_id    uuid REFERENCES trips(id)
bin_id     uuid REFERENCES bins(id)
action     text NOT NULL            -- dropoff | pickup
created_at timestamptz
```
- `dropoff` = bin delivered TO the customer site (leaves yard, arrives at customer)
- `pickup` = bin collected FROM the customer site (leaves customer, returns to yard)

### bins
```sql
id                   uuid PRIMARY KEY
serial_number        text UNIQUE NOT NULL  -- e.g. H1232
customer_id          integer REFERENCES customers(customer_id)
customer_location_id integer REFERENCES customer_locations(id)
location_id          integer REFERENCES locations(id)
unit_weight          numeric               -- empty bin weight in kg
size                 text                  -- e.g. 5T, 10T
type                 text                  -- e.g. hook, hook-open-top
status               text                  -- active | retired
remarks              text
created_at           timestamptz
```
Current location logic (checked in priority order):
- `customer_location_id` set → bin is at that specific customer site
- `customer_id` set (legacy) → bin is at that customer (no specific site)
- `location_id` set → bin is at that yard/location
- all null → location unknown

### weigh_bridge
```sql
vehicle_number    text REFERENCES vehicles(plate_number)
driver_id         text REFERENCES drivers(employee_id)
material_type_ids integer[]          -- array of material_types.id
material_custom   text
gross_weight      numeric
tare_weight       numeric
net_weight        numeric            -- manually entered or computed by driver app
customer_id       integer REFERENCES customers(customer_id)
pickup_id         integer            -- legacy field
dropoff_id        integer REFERENCES locations(id)
trip_id           uuid REFERENCES trips(id)  -- links load to a trip (null for legacy entries)
remarks           text
created_at        timestamptz
```
> `net_weight` is stored (not generated) — driver app calculates and inserts it.
> Legacy standalone entries may have null `trip_id`.

### material_types
```sql
id    integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY
name  text NOT NULL
```

---

## Row Level Security

RLS is enabled on all tables. Current staging policies allow public SELECT, INSERT, UPDATE, DELETE.
When Auth is implemented, policies must be updated to scope by authenticated user role.

**Known issue pattern:** missing UPDATE or INSERT policies cause silent failures (data appears saved but Supabase returns no error in some client versions). Always verify all four policies exist on new tables.

---

## Supabase Client

```typescript
// app/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

> Note: Currently using `@supabase/supabase-js` directly. When Auth is added, migrate to `@supabase/ssr` with `createBrowserClient` for client components and `createServerClient` for server components.

**FK join syntax:** `supabase.from('trips').select('*, customers(name, address)')` — results require `as unknown as MyType[]` cast due to Supabase TypeScript limitations.

**Integer PKs on customers/locations:** use `String(id)` in select values, `parseInt(value, 10)` in insert/update payloads.

---

## Pages Summary

### / (Home Dashboard)
- Two-panel layout: Project Costs (2/3 width) + Bin Locations (1/3 width)
- Cost panel: current month, active projects only, sorted by cost descending. Links to `/cost`
- Bins panel: grouped by At Customer Site / At Yard / Unknown Location. Links to `/bins`
  - Each section shows a count badge and the specific location name per bin
  - Sections with more than 10 bins show the first 10 with a "Show N more" / "Show less" toggle

### /projects
- Create new projects with name, location, start date, end date, status
- Edit existing projects via modal (pencil icon button)
- Mandays column shows total assignment mandays per project
- Status options: active | completed | on-hold

### /assignments
- Pick a date → see all active workers
- Assign each worker to a project for that day
- Toggle **Split** to assign a worker to two different projects (morning/afternoon)
- Save handles upsert — re-opening the same date reloads existing assignments

### /timesheets
- Enter regular hours and OT hours per worker per project per date
- Source tracked as `manual` (CSV import from Times Software not yet built)

### /cost
- Toggle between This Month and All Time views
- Filter by project status (all | active | completed | on-hold)
- Shows rolling labour cost per project calculated from timesheets
- Summary card shows total cost across all projects

### /trips
- Create and manage truck dispatch trips
- Fields: vehicle, driver, customer, customer site (optional — filtered by selected customer), dropoff location, requester, remarks
- Customer site dropdown appears after customer is selected; shows site address/contact as preview
- Bin movements: optionally add bins to a trip with action = `dropoff` or `pickup`
  - Auto-suggests action based on bin's current location (yard → dropoff, customer → pickup)
  - **Conflict validation** enforced — see *Bin Movement Validation* section below
- Trip list shows: vehicle, customer (+ site name), dropoff, net weight breakdown per load, requester, status badge, date
- Drag-to-reorder: open trips can be reordered by dragging the grip handle; order persisted via `trip_order`
- Actions per trip:
  - **Complete** (open trips only) — sets status to `completed`, records `completed_at`, auto-updates bin locations
  - **Cancel** (open trips only) — sets status to `cancelled`
  - **Copy icon** — opens WhatsApp message preview modal with Copy Message button
  - **Edit icon** — opens edit modal
  - **Delete icon** — deletes trip

### /bins
- Register and manage physical bin inventory
- CRUD via modal (create + edit): serial number, type, size, unit weight, status, remarks, location
- Filter tabs: All / At Customer / At Yard / Unknown
- Type and size filter dropdowns (populated from existing bin values)
- **Days at Site** column — shows how long each bin has been at its current customer location, colour-coded: green = today, gray = <7d, orange = 7–13d, red = 14+d
- Current location shown as colour-coded badge: blue = customer site, green = yard, gray = unknown
- Location is auto-updated when a trip containing the bin is marked complete

### /customers
- Manage customer records: company name, contact person, contact number, address
- Full CRUD with edit (pencil) and delete (trash) icon buttons
- **Manage Sites** (pin icon) per customer — opens a modal to create/edit/delete `customer_locations` for that customer
  - Each site has: name, address, contact person, contact number
  - Sites appear as the site dropdown in the Trips form

### /analytics
- Bin swap analytics per customer site
- Toggle between **This Week** and **This Month** views
- Table shows: Customer, Site, number of bins swapped, with a proportional bar chart
- Groups by `customer_location_id`; fetches completed `trip_bins` with `action = dropoff`

---

## WhatsApp Message Format

Generated by `generateMessage()` in `/trips/page.tsx`. Format:

```
Date : DD/MM/YYYY

Order placed by - {requester}

Pick up from - {customer name} ({site name if site selected})
Pick up address - {site address ?? customer address}
Person in charge - {site contact_person ?? customer contact_person}
Contact no. - {site contact_number ?? customer contact_number}

Drop off to - {location name}
Drop off address - {location address}
Person in charge -
Contact no. -

Remarks: {remarks}
Bin drop off - {serial_number}   ← repeated per bin with action=dropoff
Bin pick up - {serial_number}    ← repeated per bin with action=pickup
```
> When a `customer_location_id` is set on the trip, the site's address and contacts take precedence over the customer-level fields. The pickup name is formatted as `Customer Name (Site Name)`.


---

## Bin Movement Validation

This validation applies wherever bins are added to a trip — both the admin app (`/trips`) and the `trips-records` driver app.

### Rule

A bin's current location determines which action is valid:

| Bin current location | Allowed action | Blocked action |
|---|---|---|
| At customer (`customer_location_id` or `customer_id` set) | `pickup` | `dropoff` — already at site |
| At yard (`location_id` set) | `dropoff` | `pickup` — not at a customer |
| Unknown (all null) | Either | — |

### Implementation (three layers)

**1. Auto-suggest on bin select** — when a bin is chosen from the dropdown, set the action automatically:
- `location_id` set → `dropoff`
- `customer_id` or `customer_location_id` set → `pickup`
- All null → keep current selection

**2. Disable conflicting option** — in the action `<select>`, disable the option that would conflict:
- Bin at customer → `<option value="dropoff" disabled>`
- Bin at yard → `<option value="pickup" disabled>`

**3. Block on submit** — before writing to the DB, check all bin rows. If any conflict exists, surface a specific error per bin and abort:

```typescript
function binActionConflict(bin, action) {
  const atCustomer = !!(bin.customer_id || bin.customer_location_id);
  const atYard     = !!(bin.location_id);
  if (atCustomer && action === 'dropoff')
    return `${bin.serial_number} is already at a customer site — select Pick up instead.`;
  if (atYard && action === 'pickup')
    return `${bin.serial_number} is at the yard — select Drop off instead.`;
  return null;
}
```

### Data required

Fetch these fields on the `bins` table to run the check — no joins needed:

```sql
SELECT id, serial_number, customer_id, customer_location_id, location_id FROM bins
```

### Bin location update on trip complete

When a trip is marked complete, bin locations are updated automatically:
- `pickup` bins → `location_id` = trip's `dropoff_id`, `customer_id` and `customer_location_id` cleared
- `dropoff` bins → `customer_location_id` = trip's `customer_location_id`, `location_id` and `customer_id` cleared

The driver app should not update bin locations directly — this is handled by the admin app on complete.

---

## Coding Standards

### Next.js App Router
- Default to Server Components for data fetching
- Use `"use client"` only when using React state or hooks
- Keep Client Components small and leaf-level

### TypeScript
- Do not use `any` for database returns
- Type all component props explicitly

### Tailwind
- Dark mode is disabled — do not use `dark:` variants
- Always set `bg-white text-gray-900` on `<main>` to prevent system dark mode bleed

### Supabase
- Always handle both `data` and `error` from Supabase calls
- RLS is enabled — always test queries in context of the correct user role

### UI Patterns
- Icons: use `lucide-react` components — do not write inline SVGs
  - Edit: `<Pencil size={14} />`, button class `hover:text-blue-600 hover:bg-blue-50`
  - Delete: `<Trash2 size={14} />`, button class `hover:text-red-600 hover:bg-red-50`
  - History/time: `<Clock size={14} />`, button class `hover:text-purple-600 hover:bg-purple-50`
  - All icon buttons: base class `p-1.5 text-gray-400 rounded`
- Nav section icons: `<FolderKanban>` for Projects, `<Truck>` for Trips

---

## Karpathy Behavioral Guardrails

### 1. Think Before Coding
- Highlight ambiguities and ask clarifying questions before writing code
- Never make silent assumptions about intent, architecture, or requirements
- If multiple valid paths exist, present them as trade-offs before starting

### 2. Simplicity First
- Always implement the simplest thing that could work
- Do not add hypothetical abstractions or flexibility that weren't explicitly requested
- Prevent code bloat — avoid speculative future-proofing

### 3. Surgical Changes
- Only modify files or functions directly required for the current task
- Do not perform unrelated refactoring, styling fixes, or housekeeping
- Clean up dead code only if a feature is rewritten or removed

### 4. Goal-Driven Execution
- Break multi-step requests into an explicit written plan first
- Define exact success criteria and verify outcomes step by step
- Do not mark a task complete until the outcome is verified

---
