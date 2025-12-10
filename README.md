# TerraStride – Location-Based Running & Territory Game

## Overview

TerraStride is a next-generation, location-based running platform that turns real-world cities into a live strategy board. Every run can claim territory, generate in-game coins, and unlock rewards, while a modern backend stack powers real-time tracking, fair events, and transparent payouts.

Runners don’t just log kilometres—they capture tiles, defend neighbourhoods, and participate in flexible events with real stakes.

---

## 🚀 Key Features for Pitching

### 🏃 Strategic Running Game on Real Maps

- **Tile Grid Overlay:** Cities are split into small map tiles that can be explored, claimed, and defended.
- **Territory Capture:** Run through unowned tiles to claim them; move through contested tiles to challenge current owners.
- **Passive Yield:** Owned tiles can generate in-game coins over time, incentivising smart routing and regular activity.

### 🎯 Event & Competition Engine

- **Micro-Events:** Create low-cost, frequent events (daily challenges, weekly leagues, club races).
- **Transparent Results:** Server-side timing and validation to prevent cheating and ensure fair results.
- **Dynamic Rules:** Events can be configured around distance, pace, tile control, or custom scoring systems.

### 💰 On-Chain Rewards & Ownership

- **Backed by Crypto Infrastructure:** Coins and rewards are tracked on-chain for transparency and auditability.
- **Clear Economics:** Deterministic rules for how rewards are created, distributed, and reclaimed.
- **Future-Proof:** Designed to support new reward types (sponsorships, team payouts, shared territories).

### 📱 Runner-Focused Experience

- **Live Map View:** See nearby tiles, ownership, and event routes in real time.
- **Progress & Stats:** Personal records, tiles owned, events completed, earnings, and streaks.
- **Social Layer (Planned):** Teams, clubs, rivalries, and neighbourhood leaderboards.

---

## 🛠️ Technology Stack

> Exact implementations may evolve, but the system is structured as a set of focused services.

### Mobile App (`mobile`)

- **Platform:** Likely React Native / native iOS & Android
- **Core Capabilities:** GPS tracking, live map rendering, event participation UI
- **Offline-Aware:** Local buffering of runs with sync to backend when online

### Backend Services

#### Users & Auth (`users-service`)

- **Responsibility:** Accounts, authentication, profiles, and permissions
- **Features:** OAuth / wallet linking, basic profile data, run history index

#### Events (`events-service`)

- **Responsibility:** Event creation, registration, ticketing, timing, and results
- **Features:** Custom rules, race states (upcoming/live/finished), payouts aggregation

#### Territories (`territories-service`)

- **Responsibility:** Map grid logic and ownership state
- **Features:** Tile indexing, conflict resolution, territory scoring, yield rules

#### Crypto & Rewards (`crypto-service`)

- **Responsibility:** Wallets, balances, and on-chain interactions
- **Features:** Reward minting, transfers between users, settlement with the platform

---

## 🏗️ Architecture Highlights

The platform operates as a modular system of services:

1. **Run Ingestion:**  
   The mobile app streams GPS traces to backend endpoints, which validate routes and transform them into tile interactions.

2. **Territory Engine:**  
   The territories service maps each run to a grid, determines which tiles are entered, and applies capture/defence rules to update ownership and yield.

3. **Event Orchestration:**  
   The events service tracks who is registered, validates completion, computes standings, and triggers reward allocation.

4. **Reward Settlement:**  
   The crypto service converts event results and territory yields into on-chain or ledger updates, ensuring transparent and auditable payouts.

5. **Client Delivery:**  
   The mobile app pulls aggregated views (map state, profile, events) from these services to present a fast, game-like UI.

---

## Use Cases

1. **The Competitive Runner**  
   Trains on the same urban loops but now optimises routes to capture and defend high-yield tiles, turning workouts into territory battles.

2. **The Community Organiser**  
   Spins up recurring neighbourhood races with low fees, automated timing, and transparent payouts—no expensive timing hardware.

3. **The Brand / Sponsor**  
   Backs special tiles or events (e.g., “Own the Stadium Loop”) and funds rewards distributed automatically based on clear performance rules.

4. **The Casual Jogger**  
   Opens the app, joins a simple daily challenge, and gradually accumulates tiles and coins while following regular running routes.

---

## Project Structure

```bash
TerraStride/
├── mobile/                 # Runner-facing mobile app (map, runs, events)
├── services/
│   ├── users-service/      # Auth, accounts, profiles
│   ├── events-service/     # Events, timing, results, payouts logic
│   ├── territories-service/# Territory grid & ownership engine
│   └── crypto-service/     # Wallets, rewards, and on-chain integration
└── infra/                  # IaC, deployment scripts, observability
```
