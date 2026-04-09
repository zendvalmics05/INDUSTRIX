# Industrix Organiser Hub - Operational Guide

Welcome to the **Industrix Organiser Hub** (Gov_OS). This dashboard is the central nervous system of the simulation, allowing you to control time, manage market conditions, and oversee participant performance.

---

## 1. Initial System Setup
If the simulation is uninitialized (e.g., after a database reset), you will be greeted by the **System Initialisation Wizard**. 

- **Step 1: CONFIG**: Set the global parameters.
    - *QR Thresholds*: Define the quality required for Hard, Soft, and Premium sales.
    - *Starting Funds*: Typically set to 100,000 CU.
- **Step 2: TEAMS**: Register the competing entities.
    - Every team needs a unique Name and a PIN (used for their login).
    - You need at least **2 teams** to proceed to the final step.
- **Step 3: START**: Review and launch.
    - This creates the game record and initiates **Cycle 1, Phase 1 (Procurement)**.

---

## 2. The Core Gameplay Loop
The simulation moves through repeating **Cycles**, each consisting of 4 distinct **Phases**. As the Organiser, you control the transition between these phases.

### Phase 1: Procurement
Teams bid for raw materials (Minerals, Chemicals) and Power. 
- **Organiser Action**: Monitor participation. Once all teams have placed bids, click **"Advance Phase"**.

### Phase 2: Production
Teams allocate labor and materials to their component assembly lines.
- **Organiser Action**: Ensure teams are optimizing their throughput. Click **"Advance Phase"** to resolve production.

### Phase 3: Sales
Teams decide how many units to sell to different market factions (Gov, Industrial, NGO, etc.) and at what price.
- **Organiser Action**: This is the "high stakes" phase. Advancing this phase runs the global market matching algorithm.

### Phase 4: Evaluation
System processes financial results, brand updates, and generates performance logs.
- **Organiser Action**: Review the leaderboard. A **"Start New Cycle"** button will appear to move from Phase 4 of Cycle N to Phase 1 of Cycle N+1.

---

## 3. Dashboard Modules

### 🛡️ CYCLE_MGMT
- **Advance Phase Button**: The most important button in the hub. It triggers the backend resolution logic for the current phase.
- **Status Ticker**: Shows the current Cycle and Phase in the top right.
- **Market Settings**: Allows you to adjust the "Market Demand Multiplier" mid-game to simulate economic booms or crashes.

### 📊 TEAM_AUDIT
A real-time overview of all teams:
- **Cash**: Current liquidity.
- **Brand**: Their reputation score and tier (Poor -> Excellent).
- **Stock**: Finished drones ready for sale.
- **Status**: Will show "ELIMINATED" if a team goes bankrupt.

### 🕵️ BACKROOM_DEALS
Manage "unofficial" interactions.
- **Bribes & Sabotage**: Record deals where teams pay the "government" to buff themselves or nerf others.
- **Discovery**: The system automatically rolls for discovery on these deals during the Evaluation phase.

### 💸 ASSET_EXCHANGE
The manual override panel for the Organiser.
- **Government Grants**: Inject cash or materials directly into a team's inventory.
- **Fines**: Deduct funds for rule violations.
- **Inter-Team Transfers**: Facilitate manual trades if your specific game rules allow for them outside the automated system.

---

## 4. Pro Tips for Organisers
- **Pacing**: Most games run 6-8 cycles. Don't advance phases too quickly; give students/players time to discuss strategy.
- **Market Shocks**: If one team is dominating too easily, try lowering the `Market Demand Multiplier` to 0.8 to create a "recession" and test their efficiency.
- **The Secret Key**: Your login secret (`ADMIN_CODE`) is your master key. Keep it secure!

> [!IMPORTANT]
> If the backend ever feels "stuck," check the terminal logs. Most hangs are caused by teams trying to perform actions from the wrong phase. Advancing the phase usually clears the bottleneck.
