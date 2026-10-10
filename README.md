# PULSE EXCHANGE — Real-Time Multiplayer Stock Market Simulation

**PULSE EXCHANGE** is a high-performance, real-time stock market trading simulator built with Angular 22+, RxJS, Signals, Node.js, and WebSockets. Designed for classrooms, workshops, and trading competitions, it enables dozens of concurrent traders to compete on a live fictional stock market.

---

## 🚀 Key Features

- **24 Fictional Stocks Across 6 Sectors**: Technology, Pharma & Healthcare, Banks & Financials, Energy & Renewables, Consumer & Media, Industrials & Infrastructure.
- **Real-Time Market Engine**: Correlated price ticks every 500ms with market sentiment drift, sector trends, and volatility dynamics.
- **Dual Floor Access Roles**:
  - **Retail Trader**: ₹10,00,000 starting cash
  - **Bank / VIP Institution**: ₹10,00,00,000 capital pool
- **Order Execution**: Immediate Market Order fills + Limit & Stop orders evaluated live during tick cycles.
- **7 Workstation Views**:
  1. **Market Watch**: Interactive grid/list view with live price changes, sparklines, and sector filters.
  2. **Trading Terminal**: Real-time tick canvas chart, timeframe controls, order entry form, and holdings calculator.
  3. **Portfolio**: Real-time portfolio valuation, cash balance, P&L (₹ and %), and sector allocation progress breakdown.
  4. **Leaderboard**: Ranked live by return %, tabbed by Retail vs Bank, pinned user highlight, rank change indicators, and celebratory confetti for rank #1.
  5. **Alerts & Tracking**: Take-profit & Stop-loss threshold triggers with real-time sound synthesized via Web Audio API.
  6. **News Wire**: Reverse-chronological feed of market events, trade executions, host actions, and sentiment tags.
  7. **Host Console**: Password-protected market master panel with price setting, shock triggers (+20%/-20%), bull runs, black swans, simulation speed (1x–10x), and floor broadcasts.
- **Offline Fallback**: Automatic `BroadcastChannel` local simulation fallback when the WebSocket server is unreachable.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: Angular 22+ (Standalone Components, Signals, `@for` / `@if` syntax, `OnPush` change detection)
- **State Management**: Angular Signals & RxJS
- **Styling**: SCSS with design token system (`_tokens.scss`), dark glassmorphism aesthetic
- **Audio**: Web Audio API real-time sound synthesizer (no external audio files)

### Backend (`/server`)
- **Runtime**: Node.js + Express + WebSocket (`ws`)
- **State**: In-memory authoritative market engine, player manager, order engine, and news generator
- **Port**: `4200`
- **Default Host Password**: `pulseadmin`

---

## 📋 Getting Started

### Prerequisites
- Node.js 18+ or 20+
- npm 9+

### 1. Run the Backend WebSocket Server

```bash
# From project root
node server/index.js
```

Or with auto-reload:
```bash
npm run dev --prefix server
```

The backend starts on `http://localhost:4200` (WebSocket endpoint: `ws://localhost:4200`).

### 2. Run the Angular Frontend App

```bash
# From project root
npm start
```

Navigate to `http://localhost:4200` in your web browser.

---

## 🛡️ Host Console Password
The host console password defaults to:
```
pulseadmin
```
You can customize it by setting `HOST_PASSWORD` in `/server/.env`.

---

## 🧪 Running Unit Tests

Run the server unit tests:
```bash
node --test server/test.js
```

Run Angular frontend unit tests:
```bash
npm test
```

---

## 📌 Disclaimer
PULSE EXCHANGE is a simulation software created purely for educational and entertainment purposes. All stock tickers, company names, and market scenarios are fictional. No real brokerage APIs, real stocks, or monetary transactions are involved.
