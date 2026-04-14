<div align="center">
# 🏭 INDUSTRIX
### *A Real-Time Multiplayer Industrial Simulation Game*
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
---
*Compete. Produce. Dominate.*
**Industrix** is a competitive, multi-team factory simulation where players manage an end-to-end drone manufacturing empire — from raw material procurement through production, quality control, and market sales — while navigating backroom deals, sabotage, and shifting market dynamics.
Built for **Jadavpur University · Department of Production Engineering**
</div>
---
## 📋 Table of Contents
- [Overview](#-overview)
- [Game Phases](#-game-phases)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Game Mechanics](#-game-mechanics)
- [Contributing](#-contributing)
---
## 🎯 Overview
Industrix simulates a competitive industrial economy where **14+ teams** simultaneously manage drone manufacturing operations across timed game cycles. Each cycle is divided into four phases, and every decision — from supplier selection to wage policy to backroom bribes — affects your bottom line.
Teams are ranked on a **composite leaderboard** weighing net margin, enterprise value, market share, brand score, and operational efficiency.
> **🎮 Designed for live events** — an organiser controls the game clock, advances phases, and can inject market shocks, audits, and events in real time.
---
## 🔄 Game Phases
Each cycle consists of four timed phases, controlled by the organiser:
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ PROCUREMENT │ ──▶│ PRODUCTION  │ ──▶│    SALES     │ ──▶│  BACKROOM   │
│   5 min     │    │   5 min     │    │   5 min      │    │   5 min     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
  Source parts       Set wages         Set prices          Make deals
  Pick transport     Maintain gear     Assemble drones     Sabotage rivals
  Manage budget      Automate line     Sell to factions    Buy intel
```
| Phase | What You Do |
|:------|:------------|
| **Procurement** | Select suppliers for 6 drone components (airframe, propulsion, avionics, fire suppression, sensing/safety, battery). Choose transport modes (air/water/rail/road) balancing cost vs. quality risk. |
| **Production** | Set wage levels, hire/fire workers, choose maintenance strategy, invest in automation upgrades, and run R&D programs. Machine condition and worker morale directly affect output quality. |
| **Sales** | Assemble finished drones from components, decide how to handle each quality tier (premium → scrap), and set prices for 16 market factions with varying budgets and brand requirements. |
| **Backroom** | Execute covert deals — sabotage competitors' supply chains, bribe officials, poach workers, or invest in your own advantages. But beware: every deal has a discovery probability. |
---
## ✨ Key Features
<table>
<tr>
<td width="50%">
### 🏗️ Deep Economic Simulation
- 60 unique component suppliers with distinct quality/cost profiles
- 4 transport modes with risk/reward tradeoffs
- 4 machine tiers with degradation mechanics
- 16 market factions with independent purchasing AI
- Brand score system affecting market access
</td>
<td width="50%">
### ⚔️ Competitive Multiplayer
- 14+ simultaneous teams
- Real-time phase synchronization
- Composite leaderboard with 5 weighted metrics
- Backroom deals and corporate espionage
- Discovery mechanics with fines and brand damage
</td>
</tr>
<tr>
<td width="50%">
### 🎛️ Organiser Dashboard
- Full game lifecycle management
- Phase advancement and timer control
- Inject market events, audits, and shocks
- Manage auctions and deal resolution
- Real-time team monitoring
</td>
<td width="50%">
### 🎨 Modern UI
- Dark-themed industrial aesthetic
- Animated phase transitions (Framer Motion)
- Real-time status polling
- Phase-aware navigation with countdown timers
- Dynamic cost projections and quality distributions
</td>
</tr>
</table>
---
## 🛠️ Tech Stack
### Backend
| Technology | Purpose |
|:-----------|:--------|
| **FastAPI** | Async REST API framework |
| **SQLAlchemy 2.0** | ORM with PostgreSQL |
| **PostgreSQL 16** | Primary database |
| **Pydantic v2** | Request/response validation |
| **Alembic** | Database migrations |
| **SciPy** | Quality distribution calculations |
### Frontend
| Technology | Purpose |
|:-----------|:--------|
| **React 19** | UI framework |
| **TypeScript** | Type-safe frontend |
| **Vite 8** | Build tooling & dev server |
| **Zustand** | Lightweight state management |
| **Tailwind CSS 3** | Utility-first styling |
| **Framer Motion** | Page transitions & animations |
| **Axios** | HTTP client |
### Infrastructure
| Technology | Purpose |
|:-----------|:--------|
| **Docker Compose** | PostgreSQL + Redis containers |
| **Uvicorn** | ASGI server |
---
## 🏛️ Architecture
```
┌──────────────────────────────────────────────────────────┐
│                    INDUSTRIX FRONTEND                     │
│  React 19 + TypeScript + Zustand + Tailwind              │
│  ┌──────┐ ┌──────────┐ ┌──────┐ ┌────────┐ ┌─────────┐  │
│  │Login │ │Procure   │ │Prod  │ │ Sales  │ │Backroom │  │
│  │      │ │ment      │ │uction│ │        │ │& Events │  │
│  └──────┘ └──────────┘ └──────┘ └────────┘ └─────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │Inventory │ │ Market   │ │ Results  │ │ Briefing  │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘   │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP (Axios)
                       │ Headers: x-team-id, x-team-pin
                       ▼
┌──────────────────────────────────────────────────────────┐
│                    INDUSTRIX BACKEND                      │
│  FastAPI + SQLAlchemy + Pydantic                         │
│                                                          │
│  ┌─────────────────────┐  ┌────────────────────────────┐ │
│  │   Team Routers      │  │   Organiser Routers        │ │
│  │  /team/login        │  │  /organiser/cycle/*        │ │
│  │  /team/procurement  │  │  /organiser/deals/*        │ │
│  │  /team/production   │  │  /organiser/teams/*        │ │
│  │  /team/sales        │  │  /organiser/auction/*      │ │
│  │  /team/events       │  │  /organiser/market/*       │ │
│  └─────────┬───────────┘  └──────────┬─────────────────┘ │
│            │     Services Layer      │                   │
│            └──────────┬──────────────┘                   │
│                       ▼                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Models: Game, Cycle, Team, Inventory, Source,     │  │
│  │  Machine, Transaction, Deal, MarketFaction, ...    │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │
                    │   (Docker)    │
                    └───────────────┘
```
---
## 🚀 Getting Started
### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **Docker** (for PostgreSQL)
### 1. Clone the Repository
```bash
git clone https://github.com/your-username/INDUSTRIX.git
cd INDUSTRIX
```
### 2. Start the Database
```bash
docker compose up -d
```
This spins up PostgreSQL on port `5434` and Redis on port `6379`.
### 3. Backend Setup
```bash
cd backend
# Create virtual environment
python -m venv venv
# Activate (Windows)
.\venv\Scripts\Activate
# Activate (macOS/Linux)
source venv/bin/activate
# Install dependencies
pip install -r requirements.txt
```
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql://postgres:secret@localhost:5434/industrix
SECRET_KEY=your-secret-key-here
```
### 4. Seed the Database
```bash
# Reset and create fresh tables
python reset.py
# Seed game data (sources, market factions, etc.)
python seed_game.py
# Seed teams with PINs
python seed_teams.py
```
### 5. Start the Backend
```bash
uvicorn main:app --reload
```
Backend runs at **http://localhost:8000** · Swagger docs at **http://localhost:8000/docs**
### 6. Frontend Setup
```bash
cd industrix_frontend
# Install dependencies
npm install
# Start dev server
npm run dev
```
Frontend runs at **http://localhost:5180**
---
## 📁 Project Structure
```
INDUSTRIX/
├── backend/
│   ├── core/               # Config, auth, database setup
│   │   ├── config.py       # All tunable game constants
│   │   ├── auth.py         # Team & organiser auth (header-based)
│   │   └── database.py     # SQLAlchemy engine & session
│   ├── models/             # SQLAlchemy ORM models
│   │   ├── game.py         # Game, Cycle, Team, CyclePhaseLog
│   │   ├── procurement.py  # Source, Inventory, Transaction, Machine
│   │   ├── production.py   # Production memory & decisions
│   │   ├── sales.py        # Sales memory & pricing
│   │   ├── deals.py        # Backroom deal records
│   │   └── market.py       # Market factions
│   ├── routers/
│   │   ├── team/           # Player-facing API endpoints
│   │   └── organiser/      # Admin API (cycle, deals, teams, auction)
│   ├── schemas/            # Pydantic request/response models
│   ├── services/           # Business logic layer
│   ├── seed_data/          # JSON data for game seeding
│   ├── main.py             # FastAPI app entrypoint
│   └── requirements.txt
│
├── industrix_frontend/
│   ├── src/
│   │   ├── api/            # Axios client & API wrappers
│   │   ├── components/     # Shared UI (layout, modals, timers)
│   │   ├── pages/          # Route pages (Login, Procurement, etc.)
│   │   ├── store/          # Zustand state management
│   │   └── types/          # TypeScript interfaces
│   ├── vite.config.ts
│   └── package.json
│
└── docker-compose.yml      # PostgreSQL + Redis
```
---
## 📡 API Reference
Full interactive API docs available at `/docs` when the backend is running.
### Team Endpoints (auth: `x-team-id` + `x-team-pin` headers)
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/team/login` | Authenticate with team ID and PIN |
| `GET` | `/team/status` | Current game phase (public, no auth) |
| `GET` | `/team/me` | Team inventory snapshot |
| `GET` | `/team/procurement` | Current procurement decisions |
| `PATCH` | `/team/procurement` | Update procurement choices |
| `GET` | `/team/production` | Production state & decisions |
| `PATCH` | `/team/production` | Update production choices |
| `GET` | `/team/sales` | Sales state & pricing |
| `PATCH` | `/team/sales` | Update sales decisions |
| `GET` | `/team/events/notifications` | Team notifications |
| `GET` | `/team/leaderboard` | Composite rankings |
### Organiser Endpoints (auth: `x-organiser-secret` header)
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/organiser/cycle/create` | Start a new game cycle |
| `POST` | `/organiser/cycle/advance` | Advance to next phase |
| `POST` | `/organiser/deals/propose` | Create a backroom deal |
| `POST` | `/organiser/deals/resolve` | Resolve pending deals |
| `GET` | `/organiser/teams/summary` | All teams overview |
---
## ⚙️ Game Mechanics
### Quality System
Every drone component flows through a quality pipeline:
```
Source Quality (μ, σ)  →  Transport Risk  →  Machine Processing  →  Assembly
                           damage?              condition?           final
                           degradation?         skill level?         grade
```
Final drone grades are bucketed into tiers:
| Tier | Grade Range | Typical Price |
|:-----|:------------|:--------------|
| **Premium** | 80–100 | ₹4,800 – ₹9,800 |
| **Standard** | 50–79 | ₹3,000 – ₹4,500 |
| **Substandard** | 25–49 | ₹1,400 – ₹2,400 |
| **Reject** | 0–24 | ₹200 (scrap) |
### Transport Modes
| Mode | Cost | Quality Risk | Damage Prob. |
|:-----|:-----|:-------------|:-------------|
| ✈️ **Air** | Very High | None | 0% |
| 🚢 **Water** | Low | High | 18% |
| 🚂 **Rail** | Moderate | Low | 7% |
| 🚛 **Road** | Medium | Medium | 14% |
### Backroom Deals
22 deal types across 4 categories:
- 🔴 **Red (Sabotage)** — Supply disruption, machine sabotage, labour strikes, market manipulation
- 🟢 **Green (Advantage)** — Priority supply, subsidies, demand boosts, audit immunity
- Each deal has a **discovery probability** that compounds with repeated use
- Getting caught incurs **2.5× fines** and brand damage
### Leaderboard Formula
| Metric | Weight |
|:-------|:-------|
| Net Margin | 30% |
| Enterprise Value | 25% |
| Market Share | 20% |
| Brand Score | 15% |
| Operational Efficiency | 10% |
---
## 🤝 Contributing
This project was built for an academic event at **Jadavpur University, Department of Production Engineering**.
1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
---
<div align="center">
**Built with ☕ and late nights at Jadavpur University**
*Department of Production Engineering*
---
`[ PROCUREMENT ] → [ PRODUCTION ] → [ SALES ] → [ BACKROOM ] → [ REPEAT ]`
</div>
