import { Sector } from './company.model';
import { PlayerRole } from './player.model';

// ── Session state ──

export type SessionStatus = 'lobby' | 'active' | 'paused' | 'round-active' | 'ended';

export interface RoundState {
  roundNumber: number;
  duration: number; // seconds
  startedAt: number;
  endsAt: number;
  isActive: boolean;
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  connectedPlayers: number;
  startedAt: number;
  round?: RoundState;
  simSpeed: number; // 1 = normal, 2 = 2x, etc.
  marketMood: number; // 0 (extreme fear) – 100 (extreme greed)
}

// ── Host actions ──

export type HostAction =
  | { action: 'set-price'; ticker: string; price: number }
  | { action: 'shock-stock'; ticker: string; percent: number }
  | { action: 'shock-sector'; sector: Sector; percent: number }
  | { action: 'bull-run' }
  | { action: 'black-swan' }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'set-speed'; speed: number }
  | { action: 'start-round'; duration: number }
  | { action: 'end-round' }
  | { action: 'reset' }
  | { action: 'kick-player'; playerId: string };

// ── News ──

export type Sentiment = 'bullish' | 'bearish' | 'urgent' | 'neutral';
export type NewsSource = 'system' | 'host' | 'bank' | 'engine';

export interface NewsItem {
  id: string;
  timestamp: number;
  title: string;
  body: string;
  ticker?: string;
  sector?: Sector;
  sentiment: Sentiment;
  source: NewsSource;
  isHostAction: boolean;
}

// ── Alerts ──

export type AlertType = 'take-profit' | 'stop-loss' | 'delta-velocity';
export type AlertStatus = 'active' | 'triggered' | 'cancelled';

export interface Alert {
  id: string;
  ticker: string;
  type: AlertType;
  targetPrice?: number;
  deltaThreshold?: number;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  playerId: string;
}

// ── Duel ──

export interface DuelState {
  id: string;
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
  startedAt: number;
  endsAt: number;
  challengerReturn: number;
  targetReturn: number;
  status: 'pending' | 'active' | 'completed';
  winner?: string;
}
