# 🏭 INDUSTRIX
![Python](https://img.shields.io/badge/python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/fastapi-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/typescript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)

**A real-time multiplayer industrial simulation engine** where teams manage a complete drone manufacturing empire — procurement, production, sales, and covert backroom deals — all competing simultaneously.
*Built for Jadavpur University · Department of Production Engineering*
---
## 🎯 What is Industrix?
Imagine running a drone factory. You pick suppliers, manage workers, calibrate machines, price your products, and sell into a market with 16 competing buyer factions — all while your competitors are secretly bribing officials to sabotage your supply chain.
**14+ teams** compete simultaneously across timed game cycles. An organiser controls the game clock, advances phases, and injects market shocks in real time. Teams are ranked on a composite leaderboard weighing profitability, market share, brand reputation, and operational efficiency.
> 🎮 **Designed for live events** — an organiser dashboard controls the entire game lifecycle in real time.
---
## 🔄 Game Phases
Each cycle has **four timed phases** (5 min each), controlled by the organiser:
```
PROCUREMENT ──▶ PRODUCTION ──▶ SALES ──▶ BACKROOM ──▶ (next cycle)
```
---
### 📦 Phase 1 — Procurement
Choose suppliers for **6 drone components** from a catalog of **60 sources**. Each source has unique quality distributions and pricing. Then select a transport mode:
| Mode | Base Cost | Quality Risk | Damage Chance |
|------|-----------|--------------|---------------|
| ✈️ Air | ₹25,000 | None | 0% |
| 🚂 Rail | ₹2,200 | Low | 7% |
| 🚛 Road | ₹400 | Medium | 14% |
| 🚢 Water | ₹7,500 | High | 18% |
**Components:** Airframe · Propulsion · Avionics · Fire Suppression · Sensing/Safety · Battery
---
### ⚙️ Phase 2 — Production
Manage your factory floor — hire workers, set wage levels, choose maintenance strategy, and invest in automation & R&D. Worker **morale** and **skill** directly affect output quality.
| Machine Tier | Throughput | Cost | Starting Grade |
|--------------|-----------|------|----------------|
| Basic | 200 units | ₹15K | 40 |
| Standard | 400 units | ₹35K | 60 |
| Industrial | 700 units | ₹80K | 75 |
| Precision | 1,000 units | ₹180K | 90 |
---
### 💰 Phase 3 — Sales
Assemble drones and sell into a market of **16 buyer factions** — from *Elite Research Hubs* (premium only, brand min 75) to *Hazardous Waste Patrol* (will buy anything).
| Drone Tier | Grade Range | Price Range |
|------------|------------|-------------|
| 🥇 Premium | 80 – 100 | ₹4,800 – ₹9,800 |
| 🥈 Standard | 50 – 79 | ₹3,000 – ₹4,500 |
| 🥉 Substandard | 25 – 49 | ₹1,400 – ₹2,400 |
| ❌ Reject | 0 – 24 | ₹200 (scrap) |
---
### 🤝 Phase 4 — Backroom
Execute covert deals across **22 deal types**:
- 🔴 **Sabotage** — Disrupt rivals' supply chains, destroy machines, trigger labour strikes, manipulate market access
- 🟢 **Advantage** — Priority supply, subsidised inputs, demand boosts, audit immunity, tax evasion
> ⚠️ Every deal has a **discovery probability** that compounds with repeated use. Getting caught = **2.5× fines** + severe brand damage.
---
## 🛠️ Tech Stack
**Backend** — Python 3.10+ · FastAPI · SQLAlchemy 2.0 · PostgreSQL 16 · Pydantic v2 · Alembic · SciPy · Uvicorn
**Frontend** — React 19 · TypeScript 5.9 · Vite 8 · Zustand · Tailwind CSS 3 · Framer Motion · Axios
**Infra** — Docker Compose (PostgreSQL + Redis)
---
## 🏗️ Architecture
```
┌───────────────────────────────────────────────────┐
│           industrix_frontend/                      │
│   React 19 · TypeScript · Zustand · Tailwind CSS  │
│                                                    │
│   Login | Procurement | Production | Sales         │
│   Events | Inventory | Market | Results            │
└─────────────────────┬─────────────────────────────┘
                      │ Axios
                      │ Headers: x-team-id, x-team-pin
                      ▼
┌───────────────────────────────────────────────────┐
│                 backend/                           │
│     FastAPI · SQLAlchemy 2.0 · Pydantic v2        │
│                                                    │
│  Team Routes         |  Organiser Routes           │
│  /team/login         |  /organiser/cycle/*         │
│  /team/procurement   |  /organiser/deals/*         │
│  /team/production    |  /organiser/teams/*         │
│  /team/sales         |  /organiser/auction/*       │
│  /team/events        |  /organiser/market/*        │
│                                                    │
│  Services --> Models --> PostgreSQL 16 (Docker)    │
└───────────────────────────────────────────────────┘
```
---
## 🚀 Getting Started
### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- Docker
### 1. Database
```bash
docker compose up -d
```
This starts PostgreSQL on port `5434` and Redis on port `6379`.
### 2. Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate        # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```
Create `backend/.env`:
```
DATABASE_URL=postgresql://postgres:secret@localhost:5434/industrix
SECRET_KEY=your-secret-key-here
```
Seed and run:
```bash
python reset.py          # Wipe and create tables
python seed_game.py      # Seed 60 sources + market factions
python seed_teams.py     # Seed 14 teams with PINs
uvicorn main:app --reload
```
- Backend: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
### 3. Frontend
```bash
cd industrix_frontend
npm install
npm run dev
```
- Frontend: `http://localhost:5180`
---
## 📁 Project Structure
```
INDUSTRIX/
├── backend/
│   ├── core/                  # Config, auth, database
│   │   ├── config.py          # Every tunable game constant
│   │   ├── auth.py            # Header-based auth
│   │   └── database.py        # SQLAlchemy engine
│   ├── models/                # ORM models
│   │   ├── game.py            # Game, Cycle, Team, PhaseLog
│   │   ├── procurement.py     # Source, Inventory, Machine
│   │   ├── production.py      # Production decisions
│   │   ├── sales.py           # Sales decisions
│   │   ├── deals.py           # Backroom deals
│   │   └── market.py          # Market factions
│   ├── routers/
│   │   ├── team/              # Player-facing endpoints
│   │   └── organiser/         # Admin endpoints
│   ├── schemas/               # Pydantic schemas
│   ├── services/              # Business logic
│   ├── seed_data/             # JSON seed files
│   └── main.py                # App entrypoint
│
├── industrix_frontend/
│   └── src/
│       ├── api/               # Axios client + wrappers
│       ├── pages/             # All game screens
│       ├── components/        # Layout, modals, timer
│       ├── store/             # Zustand state
│       └── types/             # TypeScript interfaces
│
└── docker-compose.yml
```
---
## 📡 API Reference
> Interactive docs at `/docs` when backend is running.
### Team Endpoints
Auth via headers: `x-team-id` + `x-team-pin`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/team/login` | Authenticate |
| GET | `/team/status` | Current phase *(no auth)* |
| GET | `/team/me` | Inventory snapshot |
| GET | `/team/procurement` | Procurement decisions |
| PATCH | `/team/procurement` | Update procurement |
| GET | `/team/procurement/sources` | Supplier catalog |
| GET | `/team/production` | Production state |
| PATCH | `/team/production` | Update production |
| GET | `/team/sales` | Sales state |
| PATCH | `/team/sales` | Update sales |
| GET | `/team/events/notifications` | Notifications |
| GET | `/team/leaderboard` | Rankings |
| GET | `/team/finances` | Financial overview |
| GET | `/team/briefing` | Cycle briefing |
### Organiser Endpoints
Auth via header: `x-organiser-secret`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/organiser/cycle/create` | Start new cycle |
| POST | `/organiser/cycle/advance` | Advance phase |
| POST | `/organiser/deals/propose` | Create backroom deal |
| POST | `/organiser/deals/resolve` | Resolve deals |
| GET | `/organiser/teams/summary` | All teams overview |
---
## ⚙️ Scoring
Teams are ranked on a **weighted composite score**:
| Metric | Weight | What it measures |
|--------|--------|-----------------|
| Net Margin | 30% | Revenue to profit efficiency |
| Enterprise Value | 25% | Total accumulated wealth |
| Market Share | 20% | Slice of total units sold |
| Brand Score | 15% | Reputation (quality + scandals) |
| Operational Efficiency | 10% | Units produced per currency spent |
---
## 🤝 Contributing
1. Fork the repo
2. Create your feature branch — `git checkout -b feature/amazing-feature`
3. Commit your changes — `git commit -m 'Add amazing feature'`
4. Push to the branch — `git push origin feature/amazing-feature`
5. Open a Pull Request
---
**Jadavpur University · Department of Production Engineering**
`[ PROCURE ] → [ PRODUCE ] → [ SELL ] → [ DEAL ] → [ REPEAT ]`
