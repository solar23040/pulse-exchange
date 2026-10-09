// ── Player roles & types ──

export type PlayerRole = 'retail' | 'bank' | 'host';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  firm?: string; // only for 'bank' role
  cash: number;
  portfolioValue: number;
  totalValue: number;
  returnPercent: number;
  rank: number;
  joinedAt: number;
  initialCash: number;
}

// ── Positions ──

export interface Position {
  ticker: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
  allocation: number; // percentage of total portfolio
  side: 'long' | 'short';
}

// ── Orders ──

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';

export interface Order {
  id: string;
  ticker: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number; // limit/stop price
  filledPrice?: number;
  status: OrderStatus;
  timestamp: number;
  playerId: string;
  filledAt?: number;
}

// ── Portfolio ──

export interface EquityPoint {
  time: number;
  value: number;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  totalValue: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  peakValue: number;
  drawdown: number;
  equityCurve: EquityPoint[];
  deltaExposure: number;
  gammaExposure: number;
}

// ── Leaderboard ──

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  role: PlayerRole;
  firm?: string;
  totalReturn: number;
  rank: number;
  previousRank: number;
  totalValue: number;
}

// ── Initial cash by role ──

export const INITIAL_CASH: Record<PlayerRole, number> = {
  retail: 1_000_000, // ₹10,00,000
  bank: 100_000_000, // ₹10,00,00,000
  host: 0,
};
