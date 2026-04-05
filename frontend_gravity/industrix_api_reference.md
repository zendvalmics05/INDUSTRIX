# INDUSTRIX API Reference

*Complete endpoint reference for frontend developers*

**Production Engineering Dept — Jadavpur University | Srijan 2026**

---

## Authentication

All requests use HTTP headers for authentication. There are no sessions, JWTs, or cookies. The frontend stores credentials locally and attaches them as headers on every request.

| Who | Headers Required | Notes |
|-----|-----------------|-------|
| **Team endpoints** | `x-team-id` + `x-team-pin` | `x-team-id` is the integer ID returned at login. `x-team-pin` is the raw PIN string — server hashes it and compares. |
| **Organiser endpoints** | `x-organiser-secret` | The long secret string returned when the game was created. |
| **Public endpoints** | None | `GET /health`, `GET /team/status`, `GET /team/leaderboard` require no auth. |

> **HTTP Error Codes:** `401` = wrong team ID or PIN. `403` = team inactive or wrong organiser secret. `400` = bad request (wrong phase, invalid input). `404` = resource not found. `500` = server error.

---

## Phase Values

The `phase` field returned by `GET /team/status` drives the entire frontend.

| Phase String | Meaning |
|-------------|---------|
| `procurement_open` | Teams submit procurement decisions. Decision forms are active. |
| `production_open` | Teams submit production decisions. Decision forms are active. |
| `sales_open` | Teams submit sales decisions. Decision forms are active. |
| `backroom` | No team submissions. Leaderboard is visible. Organiser records deals. |
| `game_over` | Final leaderboard. All forms locked. |
| `waiting_for_first_cycle` | Game created but first cycle not yet started. Show holding screen. |
| `no_active_game` | No game is running. |

---

## Team Endpoints

*Used by team members during the game*

> **AUTH:** All team endpoints require `x-team-id` (integer) and `x-team-pin` (string) headers, except `GET /team/status` and `GET /team/leaderboard` which are public.

---

### Status & Identity

#### `GET /health`
**Auth:** None (public) | **Phase:** Any

Health check. Returns `{status: 'hello'}`. Use this to verify the server is reachable before loading the app.

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `'hello'` if server is up. |

---

#### `GET /team/status`
**Auth:** None (public) | **Phase:** Any

The primary polling endpoint. Call this every 5–10 seconds. When the phase string changes, trigger a UI update. No auth required — all teams and the organiser can call this freely.

| Field | Type | Description |
|-------|------|-------------|
| `game_name` | string | Name of the active game. |
| `cycle_number` | int | Current cycle number. 0 means no cycle created yet. |
| `phase` | string | Current phase string. See phase table above. |
| `game_active` | bool | False once end-game has been called. |

> ⚠️ Poll this every 5–10 seconds. Back off to 15s if phase hasn't changed for 2 minutes.

---

#### `POST /team/login`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Verify team credentials. The server checks the hashed PIN. On success, returns the team ID and name. The frontend should store both locally (e.g. `localStorage`) and include them as headers on every subsequent request. This is the first call the team makes after entering their credentials.

**Request Headers:**

| Field | Type | Description |
|-------|------|-------------|
| `x-team-id` | header int | Team numeric ID (given to team at event start). |
| `x-team-pin` | header string | Raw PIN string (given to team at event start). |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | int | The team's numeric ID — store this. |
| `team_name` | string | Display name of the team. |
| `message` | string | `'Login successful.'` |

---

#### `GET /team/me`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the team's top-level inventory snapshot. Use this to populate the header/sidebar showing current funds, brand, morale etc. Call this after login and after each phase resolution to refresh the display.

| Field | Type | Description |
|-------|------|-------------|
| `funds` | float | Current funds in CU. Can be negative. |
| `brand_score` | float | Brand score 0–100. |
| `brand_tier` | string | `'poor'` \| `'fair'` \| `'good'` \| `'excellent'` |
| `drone_stock_total` | int | Total assembled drones currently in inventory. |
| `workforce_size` | int | Current headcount. |
| `skill_level` | float | Workforce skill 0–100. Affects output consistency. |
| `morale` | float | Workforce morale 0–100. Below 15 triggers a riot. |
| `automation_level` | string | `'manual'` \| `'semi_auto'` \| `'full_auto'` |
| `has_gov_loan` | bool | True if team has an active government loan. Blocks backroom deals. |

---

### Finances

#### `GET /team/finances`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the team's full financial picture including active loans. Use this to build the finances tab. Shows interest obligations per cycle so teams can plan cashflow.

| Field | Type | Description |
|-------|------|-------------|
| `funds` | float | Current liquid funds (can be negative). |
| `cumulative_profit` | float | Sum of net profit across all cycles. |
| `brand_score` | float | Brand score 0–100. |
| `brand_tier` | string | `'poor'` \| `'fair'` \| `'good'` \| `'excellent'` |
| `has_gov_loan` | bool | True = government loan active (blocks deals). |
| `total_interest_due_per_cycle` | float | Sum of all interest payments due each cycle. |
| `active_loans` | array | List of active loan objects (see below). |
| `active_loans[].interest_per_cycle` | float | Interest amount charged each cycle for this loan. |
| `active_loans[].lender` | string | `'government'` or `'team_N'` where N is the lender's ID. |
| `active_loans[].cycle_id` | int | The cycle ID this payment is due in. |

---

### Inventory & Factory

#### `GET /team/inventory/components`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the complete factory picture for the team: all six component slots with their raw stock, finished stock, R&D levels, and every machine owned. This is the primary data source for the production decision screen and the inventory dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `drone_stock_total` | int | Total assembled drones in stock. |
| `components` | array | Array of 6 component slot objects (see below). |
| `components[].component` | string | Component name: `airframe` \| `propulsion` \| `avionics` \| `fire_suppression` \| `sensing_safety` \| `battery` |
| `components[].raw_stock_total` | int | Total usable raw material units in stock for this component. |
| `components[].fin_stock_total` | int | Total finished components in stock (produced but not yet assembled into drones). |
| `components[].rnd_quality` | int | Current R&D quality level (0–5). Each level adds +3 to output grade. |
| `components[].rnd_consistency` | int | Current R&D consistency level (0–5). Each level reduces sigma by 2. |
| `components[].rnd_yield` | int | Current R&D yield level (0–5). Each level reduces raw material consumed by 4%. |
| `components[].total_throughput` | int | Sum of throughput of all active machines for this component (units/cycle). |
| `components[].machine_count` | int | Number of active machines for this component. |
| `components[].machines` | array | All machines (including inactive) — see machine object below. |
| `machines[].id` | int | Unique machine ID. |
| `machines[].tier` | string | `'basic'` \| `'standard'` \| `'industrial'` \| `'precision'` |
| `machines[].condition` | float | Machine condition 0–100. Below 40 = degraded. At 0 = destroyed. |
| `machines[].is_active` | bool | False = machine is destroyed. Still appears for audit trail. |
| `machines[].throughput` | int | Units per cycle this machine can produce (0 if inactive). |
| `machines[].base_grade` | int | The output quality grade this tier produces at 100 condition. |
| `machines[].purchased_cycle` | int? | Cycle number when this machine was purchased. |
| `machines[].source` | string | `'seed'` \| `'bought'` \| `'auction'` |

---

#### `GET /team/inventory/machines/{component}`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns detailed machine info for one specific component. Also includes any R&D investments currently in transit (not yet arrived). Use this for the per-component drill-down view in the production screen.

**Path Parameter:** `component` — one of: `airframe` \| `propulsion` \| `avionics` \| `fire_suppression` \| `sensing_safety` \| `battery`

| Field | Type | Description |
|-------|------|-------------|
| `component` | string | The component name. |
| `raw_stock_total` | int | Total raw material in stock. |
| `fin_stock_total` | int | Total finished components in stock. |
| `rnd_quality` | int | Current quality R&D level. |
| `rnd_consistency` | int | Current consistency R&D level. |
| `rnd_yield` | int | Current yield R&D level. |
| `total_throughput` | int | Total throughput of all active machines. |
| `machines` | array | Machine objects — same fields as `/inventory/components`. |
| `rnd_in_progress` | array | R&D investments currently in transit (not yet arrived). |
| `rnd_in_progress[].focus` | string | `'quality'` \| `'consistency'` \| `'yield'` |
| `rnd_in_progress[].levels` | int | Levels arriving. |
| `rnd_in_progress[].arrives_cycle` | int | Cycle ID when this R&D will arrive. |

---

#### `GET /team/market`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns all active market factions and their parameters. Teams use this to decide how to price their drones. Factions buy the cheapest eligible drones first, with brand score as a tiebreaker. A team below a faction's `brand_min` cannot sell to that faction at all.

| Field | Type | Description |
|-------|------|-------------|
| `factions` | array | List of active buyer factions. |
| `factions[].id` | int | Faction ID. |
| `factions[].name` | string | Display name (e.g. `'Government Procurement'`). |
| `factions[].tier_preference` | string | Which quality tier they want: `premium` \| `standard` \| `substandard` \| `reject` |
| `factions[].price_ceiling` | float | Max CU/unit they will pay. They never exceed this. |
| `factions[].volume` | int | How many units they want this cycle (before demand multiplier). |
| `factions[].flexibility` | float | 0–1. How much of remaining appetite they carry to the next tier down if preferred tier is exhausted. |
| `factions[].brand_min` | float | Minimum brand score required. 0 = no requirement. |

---

### Procurement

*Active during `procurement_open` phase. Teams decide what to order, from which supplier, and how to ship it.*

#### `GET /team/procurement/sources`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the catalogue of all active raw material suppliers for this game. Each entry covers one component from one supplier. Multiple suppliers may exist per component — teams choose based on quality vs cost vs distance trade-offs. Fetch this once at procurement screen load and cache for the session.

| Field | Type | Description |
|-------|------|-------------|
| `[].id` | int | Source ID — used as `source_id` in procurement decisions. |
| `[].component` | string | Which component this supplier provides. |
| `[].name` | string | Supplier display name. |
| `[].distance` | int | Distance in km from factory. Determines transport cost. |
| `[].quality_mean` | float | Average quality grade of material from this supplier (1–100). |
| `[].quality_sigma` | float | Consistency — lower sigma = more predictable quality. |
| `[].base_cost_per_unit` | float | Material cost per unit before transport is added. |
| `[].min_order` | int | Minimum units per order. |
| `[].max_order` | int | Maximum units per order. |

---

#### `GET /team/procurement/transports`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the transport mode parameters used to calculate shipping cost and quality effects. Use this to show teams the trade-offs between modes (cost vs damage risk vs quality impact). Fetch once at startup.

| Field | Type | Description |
|-------|------|-------------|
| `air / rail / road / water` | object | One object per mode containing: |
| `.base_cost` | int | Fixed booking fee per shipment regardless of quantity. |
| `.var_cost` | int | Variable cost per unit per km. |
| `.sigma_add` | float | Added to supplier's quality sigma (increases variance). |
| `.mean_reduce` | float | Subtracted from supplier's quality mean (reduces average grade). |
| `.p_damage` | float | Probability of partial damage event (0–1). |
| `.vulnerability` | float | Multiplier applied to sabotage loss fraction. 0 = immune to sabotage. |

> ⚠️ **Transport cost formula:** `total = base_cost + (var_cost × distance_km × quantity) + (quantity × base_cost_per_unit)`

---

#### `GET /team/procurement`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the team's current procurement decisions (last saved state). Use this to pre-populate the procurement form — teams should see their last cycle's choices as starting values, not blank inputs.

| Field | Type | Description |
|-------|------|-------------|
| `decisions` | object | Map of component name → decision object. |
| `decisions.airframe` | object | (and all other components) — contains: |
| `.source_id` | int | ID of the selected supplier. |
| `.quantity` | int | Units ordered. |
| `.transport` | string | `'air'` \| `'rail'` \| `'road'` \| `'water'` |

---

#### `PATCH /team/procurement`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** `procurement_open` only

Submit or update procurement decisions. PATCH semantics — only send the components you want to change. Unspecified components carry forward from last cycle automatically. Can be called multiple times — each call overwrites the specified components.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `decisions` | object | Map of component name → decision. Only include components you're changing. |
| `decisions.{comp}` | object | Replace `{comp}` with: `airframe` \| `propulsion` \| `avionics` \| `fire_suppression` \| `sensing_safety` \| `battery` |
| `.source_id` | int **req** | ID of the chosen supplier (from `/sources`). |
| `.quantity` | int **req** | Units to order. Range: 0–10,000. Set to 0 to skip this component. |
| `.transport` | string | `'air'` \| `'rail'` \| `'road'` \| `'water'`. Default: `'road'` |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `ok` | bool | True on success. |
| `message` | string | `'Procurement decisions updated.'` |

> ⚠️ Only callable during `procurement_open`. Returns 400 during any other phase.

---

#### `GET /team/procurement/summary`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** `production_open`, `sales_open`, `backroom`, `game_over`

Returns what happened during the most recent procurement resolution. Available after procurement closes. Shows units ordered vs received, costs, and any transport events (damage, sabotage). Use this for the post-resolution summary screen.

| Field | Type | Description |
|-------|------|-------------|
| `cycle_number` | int | Which cycle this summary is for. |
| `total_cost` | float | Total procurement spend this cycle. |
| `per_component` | object | Per-component breakdown. |
| `per_component.{comp}.units_ordered` | int | How many units were ordered. |
| `per_component.{comp}.units_received` | int | How many actually arrived (after damage/loss). |
| `per_component.{comp}.cost` | float | Total cost for this component. |
| `per_component.{comp}.event` | string | `'none'` \| `'partial_damage'` \| `'sabotaged'` |
| `per_component.{comp}.source` | string | Supplier name. |
| `per_component.{comp}.transport` | string | Transport mode used. |
| `per_component.{comp}.distance_km` | float | Distance shipped. |

> ⚠️ Returns 404 if procurement hasn't resolved yet (still in `procurement_open`).

---

### Production

*Active during `production_open` phase. Teams decide how many raw materials to process, how to maintain machines, and whether to invest in R&D or buy new machines.*

#### `GET /team/production`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the team's current production decisions. Pre-populate the production form with these values. Decisions carry forward from the previous cycle by default.

| Field | Type | Description |
|-------|------|-------------|
| `decisions.wage_level` | string | `'below_market'` \| `'market'` \| `'above_market'` |
| `decisions.target_headcount` | int | Desired workforce size. |
| `decisions.upgrade_automation` | string? | `'semi_auto'` \| `'full_auto'` if upgrading, else null. |
| `decisions.{component}` | object | Per-component decisions (one per component): |
| `.maintenance` | string | `'none'` \| `'basic'` \| `'full'` \| `'overhaul'` |
| `.units_to_produce` | int? | Raw units to convert. Null = use max throughput. |
| `.rnd_invest` | object? | Null or `{focus: 'quality'|'consistency'|'yield', levels: 1–5}` |
| `.buy_machine` | object? | Null or `{tier: 'basic'|'standard'|'industrial'|'precision'}` |

---

#### `PATCH /team/production`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** `production_open` only

Submit or update production decisions. PATCH semantics — send only what changed. Team-wide labour decisions (wage, headcount, automation) are top-level fields. Per-component decisions are nested under `component_decisions`. Can be called multiple times.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `wage_level` | string? | `'below_market'` \| `'market'` \| `'above_market'`. Omit to keep current. |
| `target_headcount` | int? | 0–500 workers. Omit to keep current. |
| `upgrade_automation` | string? | `'semi_auto'` \| `'full_auto'`. One-time cost deducted at resolution. |
| `component_decisions` | object | Map of component name → per-component decision. Only include what changed. |
| `.maintenance` | string | `'none'` \| `'basic'` \| `'full'` \| `'overhaul'`. Applies to ALL machines of this component. |
| `.units_to_produce` | int? | How many raw units to convert. 0 = produce nothing. Null = max throughput. Server clamps to available throughput. |
| `.rnd_invest` | object? | `{focus: 'quality'|'consistency'|'yield', levels: 1–5}`. Cost: 10,000 CU/level, arrives in 2 cycles. |
| `.buy_machine` | object? | `{tier: 'basic'|'standard'|'industrial'|'precision'}`. Cost deducted immediately at resolution. Adds one machine. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `ok` | bool | True on success. |
| `message` | string | `'Production decisions updated.'` |

> ⚠️ Only callable during `production_open`. The `buy_machine` field purchases exactly ONE machine. To buy multiple machines, submit multiple PATCH requests.

---

#### `GET /team/production/summary`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** `sales_open`, `backroom`, `game_over`

Returns what happened during the most recent production resolution. Shows per-component output, machine conditions after degradation, labour events, and costs deducted.

| Field | Type | Description |
|-------|------|-------------|
| `cycle_number` | int | Which cycle. |
| `wage_total` | float | Total wages paid this cycle. |
| `maint_total` | float | Total maintenance costs paid. |
| `current_funds` | float | Funds remaining after production costs. |
| `forced_strike` | bool | True if a labour strike event fired. |
| `riot` | bool | True if morale dropped below riot threshold. |
| `components.{comp}.units_produced` | int | Components successfully manufactured. |
| `components.{comp}.total_throughput` | int | Max throughput available from all active machines. |
| `components.{comp}.requested` | int | Units actually requested by the team. |
| `components.{comp}.machines_active` | int | How many machines were active. |
| `components.{comp}.effective_grade` | float | Blended output quality mean this cycle. |
| `components.{comp}.sigma` | float | Output quality spread (standard deviation). |
| `components.{comp}.rm_consumed` | int | Raw material units consumed. |
| `components.{comp}.fin_stock_total` | int | Total finished stock after this cycle's production. |

---

### Sales

*Active during `sales_open` phase. Teams first decide how many drones to assemble, then how to handle each quality tier.*

#### `GET /team/sales`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** Any

Returns the team's current sales decisions. Pre-populate the sales form. The decisions object contains both `units_to_assemble` (top-level) and per-tier selling decisions.

| Field | Type | Description |
|-------|------|-------------|
| `decisions.units_to_assemble` | int? | Drones to assemble. Null = assemble maximum possible. |
| `decisions.reject` | object | Action for reject-grade drones. |
| `decisions.substandard` | object | Action for substandard-grade drones. |
| `decisions.standard` | object | Action for standard-grade drones. |
| `decisions.premium` | object | Action for premium-grade drones. |
| `.action` | string | `'sell_market'` \| `'sell_premium'` \| `'sell_discounted'` \| `'hold'` \| `'scrap'` \| `'black_market'` |
| `.price_override` | float? | Custom price per unit. Null = use default. |

---

#### `PATCH /team/sales`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** `sales_open` only

Submit or update sales decisions. `units_to_assemble` controls assembly (how many drones to build this cycle). The decisions map controls what happens to each quality tier. Partial updates supported — unspecified tiers keep last cycle's decision.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `units_to_assemble` | int? | How many drones to assemble from finished component stock. Null = assemble everything possible. Server clamps to the minimum finished stock across all 6 components. |
| `decisions` | object | Map of quality tier → selling decision. Only include tiers you're changing. |
| `reject` | object | Valid actions for reject tier: `'scrap'`, `'black_market'` |
| `substandard` | object | Valid actions: `'sell_discounted'`, `'sell_market'`, `'hold'`, `'scrap'` |
| `standard` | object | Valid actions: `'sell_market'`, `'hold'`, `'scrap'`, `'sell_discounted'` |
| `premium` | object | Valid actions: `'sell_premium'`, `'sell_market'`, `'hold'`, `'scrap'`, `'sell_discounted'` |
| `.action` | string | The action to take for this tier. |
| `.price_override` | float? | Optional custom price. Only valid for sell actions. Null = default price. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `ok` | bool | True on success. |
| `message` | string | `'Sales decisions updated.'` |

> ⚠️ `sell_premium` action is only meaningful for the premium tier — it uses the premium price (4,800 CU) instead of the standard price (3,000 CU). For all other tiers it behaves like `sell_market`.

---

#### `GET /team/sales/summary`
**Auth:** `x-team-id` + `x-team-pin` | **Phase:** `backroom`, `game_over`

Returns what happened during the most recent sales resolution. The richest summary endpoint — shows assembly, sales by tier, faction purchases, black market events, and brand changes.

| Field | Type | Description |
|-------|------|-------------|
| `cycle_number` | int | Which cycle. |
| `drones_assembled` | int | Drones assembled this cycle. |
| `max_possible` | int | Maximum that could have been assembled given component stocks. |
| `units_sold` | int | Total drones sold to market this cycle. |
| `units_held` | int | Drones held over to next cycle inventory. |
| `units_scrapped` | int | Drones scrapped this cycle. |
| `gov_purchase_rev` | float | Revenue from guaranteed government purchase deals (0 if none). |
| `black_mkt_units` | int | Units sent to black market. |
| `black_mkt_found` | bool | True if the black market activity was discovered. |
| `black_mkt_fine` | float | Fine applied if discovered (0 otherwise). |
| `total_revenue` | float | Net revenue this cycle after holding costs and fines. |
| `holding_cost` | float | Cost of unsold drones held in inventory. |
| `fin_adjustment` | float | Net change from financial events (loan interest, fines, tax refunds). |
| `brand_score` | float | Brand score after this cycle's updates. |
| `closing_funds` | float | Funds at end of sales resolution. |
| `tier_sold` | object | Map of tier → units sold: `{premium: N, standard: N, substandard: N}` |

> ⚠️ Returns 404 if sales haven't resolved yet.

---

### Leaderboard

#### `GET /team/leaderboard`
**Auth:** None (public) | **Phase:** `backroom`, `game_over` only

Returns the current cycle's leaderboard. Available only during `backroom` and `game_over` phases — this is the reveal moment at the end of each cycle. Returns 403 during any other phase. No auth required — all team devices and the projector screen can display this simultaneously.

| Field | Type | Description |
|-------|------|-------------|
| `cycle_number` | int | Which cycle this leaderboard is for. |
| `is_final` | bool | True if game is over and this is the final ranking. |
| `rows` | array | Teams ranked by composite score, highest first. |
| `rows[].rank` | int | Position (tied teams get the same rank). |
| `rows[].team_name` | string | Team display name. |
| `rows[].composite_score` | float | Composite leaderboard score. |
| `rows[].closing_funds` | float | Current funds. |
| `rows[].cumulative_profit` | float | Total net profit across all cycles. |
| `rows[].brand_score` | float | Brand score at time of calculation. |
| `rows[].quality_avg` | float | Weighted average grade of drones in stock. |
| `rows[].inventory_penalty` | float | Number of unsold drones (higher = bigger penalty). |

> ⚠️ **Composite score** = 30% cumulative profit + 25% closing funds + 20% brand + 15% quality − 10% inventory penalty (each normalised to 0–1 scale).

---

## Organiser Endpoints

*Used exclusively by the game organisers*

> **AUTH:** All organiser endpoints require the `x-organiser-secret` header. This secret is set to a fixed value in the backend config (`ADMIN_CODE`). There is no per-game secret in this version — the same value is used throughout.

---

### Game & Cycle Control

#### `POST /organiser/game/create`
**Auth:** `x-bootstrap-secret` header | **Phase:** Before any game exists

One-time call to create the game. Must be called before anything else. The bootstrap secret is the `ADMIN_CODE` from the backend config. Returns the game record.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Game name to display. |
| `qr_hard` | float | Reject threshold. Default: 30. Drones below this are reject grade. |
| `qr_soft` | float | Substandard ceiling. Default: 50. |
| `qr_premium` | float | Premium floor. Default: 75. |
| `market_demand_multiplier` | float | Global demand multiplier. Default: 1.0. |
| `starting_funds` | float | Starting funds per team. Default: 100,000 CU. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Game ID. |
| `name` | string | Game name. |
| `qr_hard/soft/premium` | float | Configured thresholds. |
| `is_active` | bool | True. |

---

#### `POST /organiser/teams/add`
**Auth:** `x-organiser-secret` | **Phase:** Before game starts

Add a team to the game. Seeds all rows: Inventory, ComponentSlot ×6, Machine ×6 (one Standard each), MemoryProcurement, MemoryProduction, MemorySales.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Team display name. |
| `pin` | string | Raw PIN (4–50 chars). Stored as SHA-256 hash. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Team ID — give this to the team along with their PIN. |
| `name` | string | Team name. |
| `is_active` | bool | True. |

---

#### `POST /organiser/cycle/create`
**Auth:** `x-organiser-secret` | **Phase:** `backroom` or before first cycle

Create the first cycle (or manually create the next one instead of using `/next`). Sets phase to `procurement_open`. Also generates Event rows for any pending deals.

| Field | Type | Description |
|-------|------|-------------|
| `ok` | bool | True. Message includes cycle number. |

---

#### `POST /organiser/cycle/advance`
**Auth:** `x-organiser-secret` | **Phase:** Any open phase

**MOST USED ENDPOINT.** Closes the current phase, runs the simulation for that phase, and advances to the next. `procurement_open` → `production_open` → `sales_open` → `backroom`. Irreversible.

| Field | Type | Description |
|-------|------|-------------|
| `previous_phase` | string | Always `'resolved'`. |
| `current_phase` | string | The new phase after advancing. |
| `cycle_number` | int | Current cycle number. |

> ⚠️ This is irreversible. Once called, that phase's decisions are locked and the simulation runs.

---

#### `POST /organiser/cycle/next`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

From backroom: roll discovery on all pending deals, close the current cycle, create the next cycle. The game continues.

| Field | Type | Description |
|-------|------|-------------|
| `ok` | bool | True. Message includes new cycle number. |

---

#### `POST /organiser/cycle/end-game`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

End the game. Rolls discovery, sets phase to `game_over`, deactivates the game. The leaderboard becomes final.

| Field | Type | Description |
|-------|------|-------------|
| `ok` | bool | True. |

---

#### `GET /organiser/cycle/status`
**Auth:** `x-organiser-secret` | **Phase:** Any

Returns the current cycle state for the organiser dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `cycle_number` | int | Current cycle number. |
| `phase` | string | Current phase. |
| `qr_hard/soft/premium` | float | Active quality thresholds this cycle. |
| `demand_mult` | float | Active market demand multiplier. |

---

#### `PATCH /organiser/cycle/game/settings`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Update game-level parameters during backroom. Takes effect in the NEXT cycle.

| Field | Type | Description |
|-------|------|-------------|
| `qr_hard` | float? | New reject threshold. |
| `qr_soft` | float? | New substandard ceiling. |
| `qr_premium` | float? | New premium floor. |
| `market_demand_multiplier` | float? | New global demand multiplier. |

**Response:** `{ ok: true }`

---

#### `PATCH /organiser/cycle/force-phase`
**Auth:** `x-organiser-secret` | **Phase:** Any

Emergency only. Forces the phase to a specific value without running any resolution. Query param: `phase_value`. Use only if a phase got stuck — does NOT replay or undo resolution.

| Field | Type | Description |
|-------|------|-------------|
| `phase_value` | query param | One of the phase string values. |

**Response:** `{ ok: true }`

> ⚠️ Emergency use only. Does not run any resolution logic.

---

### Team Management (Organiser)

#### `GET /organiser/teams`
**Auth:** `x-organiser-secret` | **Phase:** Any

List all teams with summary financials. Use for the organiser's team overview dashboard.

| Field | Type | Description |
|-------|------|-------------|
| `[].id` | int | Team ID. |
| `[].name` | string | Team name. |
| `[].is_active` | bool | False = bankrupt/disqualified. |
| `[].funds` | float | Current funds. |
| `[].brand_score` | float | Brand score. |
| `[].brand_tier` | string | Brand tier. |
| `[].has_gov_loan` | bool | Active gov loan. |
| `[].drone_stock` | int | Total assembled drones in stock. |
| `[].fin_stock_total` | int | Total finished components in stock (all components combined). |
| `[].active_machines` | int | Total active machines across all components. |
| `[].cumul_profit` | float | Cumulative profit. |

---

#### `GET /organiser/teams/{team_id}/inventory`
**Auth:** `x-organiser-secret` | **Phase:** Any

Full inventory detail for one team. Shows everything the organiser needs to assess a team's situation — funds, brand, labour, and per-component slot data with all machines.

**Path Parameter:** `team_id` — int

| Field | Type | Description |
|-------|------|-------------|
| `team.id/name/is_active` | ... | Team identity. |
| `inventory.funds` | float | Current funds. |
| `inventory.brand_score/tier` | ... | Brand state. |
| `inventory.drone_stock_total` | int | Assembled drones in stock. |
| `inventory.workforce_size` | int | Headcount. |
| `inventory.skill_level` | float | Skill 0–100. |
| `inventory.morale` | float | Morale 0–100. |
| `inventory.automation_level` | string | `manual` \| `semi_auto` \| `full_auto` |
| `inventory.has_gov_loan` | bool | Gov loan active. |
| `inventory.cumulative_profit` | float | Total profit. |
| `components` | array | Per-component slots — same structure as `/team/inventory/components`. |

---

#### `POST /organiser/teams/{team_id}/reset-pin`
**Auth:** `x-organiser-secret` | **Phase:** Any

Reset a team's PIN. Use if a team forgets their PIN during the event. Query param: `new_pin`.

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | path param int | Team ID. |
| `new_pin` | query string | New plain-text PIN. Server hashes it. |

**Response:** `{ ok: true }`

---

### Deals & Events (Organiser)

*All deal endpoints are only accessible during the `backroom` phase. Deals are negotiated offline — the organiser records the agreed terms here.*

#### `POST /organiser/deals/gov`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Record a government deal negotiated offline. Bribe is deducted from buyer's funds immediately. Event rows are generated for the next cycle automatically.

| Field | Type | Description |
|-------|------|-------------|
| `buyer_team_id` | int | Team paying the bribe. |
| `deal_type` | string | One of 23 deal types (see `GovDealType` enum). RED = offensive, GREEN = self-buff. |
| `bribe_amount` | float | Must meet the minimum floor for the deal type. Larger bribes scale the effect. |
| `target_team_id` | int? | Required for RED (offensive) deals. Null for GREEN self-buffs. |
| `override_params` | object? | Override specific effect payload values (e.g. units and price for `gov_purchase`). |
| `notes` | string? | Organiser notes for audit trail. |

**Response:** Full `GovDeal` object including `discovery_probability` and `effect_payload`.

---

#### `POST /organiser/deals/inter-team`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Record a loan between two teams. Principal transferred immediately. Interest events pre-generated for existing future cycles.

| Field | Type | Description |
|-------|------|-------------|
| `borrower_team_id` | int | Team receiving the loan. |
| `lender_team_id` | int | Team providing the loan. |
| `principal` | float | Amount transferred from lender to borrower. |
| `interest_rate` | float | Per-cycle rate: 0.02–0.12 (2%–12%). |
| `duration_cycles` | int | Number of cycles interest is charged. |
| `notes` | string? | Optional. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `events_created` | int | Number of interest Event rows created. |
| `amount_per_cycle` | float | Interest charged each cycle. |
| `total_interest` | float | Total interest over full duration. |

---

#### `POST /organiser/deals/gov-loan`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Issue a government loan. Principal credited immediately. Interest rate fixed at 15%/cycle. Marks the team as `has_gov_loan = True` (blocks deals) and applies a brand hit.

| Field | Type | Description |
|-------|------|-------------|
| `borrower_team_id` | int | Team receiving the loan. |
| `principal` | float | Amount credited to team. |
| `duration_cycles` | int | Cycles of interest. |

**Response:** Same structure as inter-team loan response (`LoanCreatedOut`).

---

#### `POST /organiser/deals/global-event`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Inject a global market event. Affects all teams via game-level parameter changes. One Event row is pre-generated per cycle for the duration.

| Field | Type | Description |
|-------|------|-------------|
| `duration_cycles` | int | How many consecutive cycles this fires. |
| `payload` | object | Effect parameters. Keys: `market_demand_multiplier_delta`, `qr_hard_delta`, `qr_soft_delta`, `qr_premium_delta`. Include only what you want to change. |
| `notes` | string? | Shown in event audit log. |

**Response:** Array of `EventOut` objects — one per cycle generated.

---

#### `GET /organiser/deals`
**Auth:** `x-organiser-secret` | **Phase:** Any

List all GovDeals negotiated in the current cycle.

---

#### `GET /organiser/deals/{deal_id}`
**Auth:** `x-organiser-secret` | **Phase:** Any

Get one GovDeal by ID.

---

#### `DELETE /organiser/deals/{deal_id}`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Cancel a PENDING deal. Nullifies its Event rows. No refund.

**Response:** `{ ok: true }`

> ⚠️ No refund is issued.

---

#### `POST /organiser/deals/discover`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Manually trigger discovery rolls for all PENDING deals. Normally happens automatically at `/next` or `/end-game`.

| Field | Type | Description |
|-------|------|-------------|
| `discovered` | int | Count of discovered deals. |
| `safe` | int | Count of safe deals. |

---

#### `GET /organiser/events/current`
**Auth:** `x-organiser-secret` | **Phase:** Any

List all Event rows for the current cycle. Optional query params: `phase`, `status`, `team_id` for filtering. Use as the organiser's audit view — shows exactly what will fire each phase.

---

#### `GET /organiser/events/history`
**Auth:** `x-organiser-secret` | **Phase:** Any

Full event history across all cycles. Optional filters: `team_id`, `event_type`. Capped at 500 results.

---

### Auction (Organiser)

*Auction runs verbally during backroom phase. Organiser records the result by calling one of these endpoints to transfer the asset to the winner and deduct the bid.*

#### `GET /organiser/auction/preview/{team_id}`
**Auth:** `x-organiser-secret` | **Phase:** Any

Show what a team currently has before deciding what to auction to them — component stocks, machines, and current funds.

| Field | Type | Description |
|-------|------|-------------|
| `team.id/name` | ... | Identity. |
| `funds` | float | Current funds. |
| `components` | array | Per-component: `raw_stock_total`, `fin_stock_total`, R&D levels, machines with condition. |

---

#### `POST /organiser/auction/raw-material`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Transfer a batch of raw material to the auction winner. Injects a quality array directly into the team's `raw_stock` for one component. Deducts the winning bid.

| Field | Type | Description |
|-------|------|-------------|
| `winner_team_id` | int | Team ID of the winner. |
| `component` | string | Which component slot to inject into. |
| `quality_array` | int[101] | 101-element array. Index 0 = scrap, 1–100 = grade counts. Total units = sum of indices 1–100. |
| `deduct_funds` | float | Winning bid amount to deduct from team's funds. |
| `notes` | string? | Optional. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `team_name` | string | Winner's name. |
| `units_received` | int | Total units injected. |
| `funds_deducted` | float | Amount deducted. |
| `funds_remaining` | float | Winner's funds after deduction. |

---

#### `POST /organiser/auction/component`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Transfer finished components to the auction winner. Goes directly into `finished_stock` — ready for assembly in the next sales phase without going through production.

| Field | Type | Description |
|-------|------|-------------|
| `winner_team_id` | int | Team ID. |
| `component` | string | Component name. |
| `quality_array` | int[101] | Quality distribution of the components. |
| `deduct_funds` | float | Winning bid. |
| `notes` | string? | Optional. |

**Response:** Same shape as raw-material transfer response (`TransferResult`).

---

#### `POST /organiser/auction/machine`
**Auth:** `x-organiser-secret` | **Phase:** `backroom`

Add a machine directly to the winner's factory. The machine is immediately active and counts toward throughput from the very next production phase.

| Field | Type | Description |
|-------|------|-------------|
| `winner_team_id` | int | Team ID. |
| `component` | string | Which component this machine will process. |
| `tier` | string | `'basic'` \| `'standard'` \| `'industrial'` \| `'precision'` |
| `starting_condition` | float | Starting condition 1–100. Default 100 (new). Can be lower for used machines. |
| `deduct_funds` | float | Winning bid. |
| `notes` | string? | Optional. |

**Response:**

| Field | Type | Description |
|-------|------|-------------|
| `machine_id` | int | ID of the new Machine row. |
| `funds_deducted` | float | Amount deducted. |
| `funds_remaining` | float | Remaining funds. |

---

### Market Factions (Organiser)

#### `GET /organiser/market/factions`
**Auth:** `x-organiser-secret` | **Phase:** Any

List all market factions for this game.

**Response:** Array of `FactionOut` objects — `id`, `name`, `tier_preference`, `price_ceiling`, `volume`, `flexibility`, `brand_min`, `is_active`

---

#### `POST /organiser/market/factions`
**Auth:** `x-organiser-secret` | **Phase:** Any

Create a new faction. See `FactionCreate` schema for request body fields.

---

#### `PATCH /organiser/market/factions/{id}`
**Auth:** `x-organiser-secret` | **Phase:** Any

Update a faction. All fields optional — send only what changes. Takes effect at the next sales resolution.

**Response:** `{ ok: true }`

> ⚠️ Changes take effect immediately — they will apply the next time sales resolves.

---

#### `DELETE /organiser/market/factions/{id}`
**Auth:** `x-organiser-secret` | **Phase:** Any

Disable a faction (sets `is_active = false`). They no longer buy drones.

**Response:** `{ ok: true }`

---

#### `POST /organiser/market/factions/reset`
**Auth:** `x-organiser-secret` | **Phase:** Any

Reset all factions to the six default factions defined in game config. Deletes all current factions and recreates defaults.

**Response:** `{ ok: true }`

> ⚠️ Destructive — deletes all current factions before recreating defaults.

---

## Quick Reference — All Endpoints

### Team-facing (auth: `x-team-id` + `x-team-pin`)

| Method | Path | Phase | Purpose |
|--------|------|-------|---------|
| GET | `/health` | Any | Health check |
| GET | `/team/status` | Any (public) | **POLL THIS** — phase detection |
| POST | `/team/login` | Any | Verify credentials |
| GET | `/team/me` | Any | Own inventory snapshot |
| GET | `/team/finances` | Any | Funds, profit, active loans |
| GET | `/team/inventory/components` | Any | All 6 slots, stocks, machines |
| GET | `/team/inventory/machines/{comp}` | Any | Machines for one component + R&D in transit |
| GET | `/team/market` | Any | Active buyer factions |
| GET | `/team/procurement/sources` | Any | Supplier catalogue |
| GET | `/team/procurement/transports` | Any | Transport mode parameters |
| GET | `/team/procurement` | Any | Current procurement decisions |
| PATCH | `/team/procurement` | `procurement_open` | Submit procurement decisions |
| GET | `/team/procurement/summary` | After procurement | Results of last procurement |
| GET | `/team/production` | Any | Current production decisions |
| PATCH | `/team/production` | `production_open` | Submit production decisions |
| GET | `/team/production/summary` | After production | Results of last production |
| GET | `/team/sales` | Any | Current sales decisions |
| PATCH | `/team/sales` | `sales_open` | Submit sales decisions (incl. assembly) |
| GET | `/team/sales/summary` | `backroom`+ | Results of last sales + assembly |
| GET | `/team/leaderboard` | `backroom`, `game_over` | Rankings (public) |

### Organiser-facing (auth: `x-organiser-secret`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organiser/game/create` | Bootstrap: create the game (uses `x-bootstrap-secret`) |
| POST | `/organiser/teams/add` | Add a team |
| GET | `/organiser/teams` | List teams with financial summary |
| GET | `/organiser/teams/{id}/inventory` | Full detail for one team |
| POST | `/organiser/teams/{id}/reset-pin` | Reset a team's PIN |
| POST | `/organiser/cycle/create` | Create first or next cycle |
| POST | `/organiser/cycle/advance` | **ADVANCE PHASE + run resolution** |
| POST | `/organiser/cycle/next` | End backroom, start next cycle |
| POST | `/organiser/cycle/end-game` | End the game |
| GET | `/organiser/cycle/status` | Current cycle state |
| PATCH | `/organiser/cycle/game/settings` | Update QR thresholds / demand multiplier |
| PATCH | `/organiser/cycle/force-phase` | EMERGENCY: force phase change |
| POST | `/organiser/deals/gov` | Record a government deal |
| POST | `/organiser/deals/inter-team` | Record inter-team loan |
| POST | `/organiser/deals/gov-loan` | Issue government loan |
| POST | `/organiser/deals/global-event` | Inject global market event |
| GET | `/organiser/deals` | List deals this cycle |
| GET | `/organiser/deals/{id}` | Get one deal |
| DELETE | `/organiser/deals/{id}` | Cancel a pending deal |
| POST | `/organiser/deals/discover` | Trigger discovery rolls now |
| GET | `/organiser/events/current` | All events this cycle (audit) |
| GET | `/organiser/events/history` | Full event history |
| GET | `/organiser/auction/preview/{team_id}` | Team's factory state before auction |
| POST | `/organiser/auction/raw-material` | Transfer raw material to winner |
| POST | `/organiser/auction/component` | Transfer finished components to winner |
| POST | `/organiser/auction/machine` | Add machine to winner's factory |
| GET | `/organiser/market/factions` | List buyer factions |
| POST | `/organiser/market/factions` | Create a new faction |
| PATCH | `/organiser/market/factions/{id}` | Update a faction |
| DELETE | `/organiser/market/factions/{id}` | Disable a faction |
| POST | `/organiser/market/factions/reset` | Reset to default factions |