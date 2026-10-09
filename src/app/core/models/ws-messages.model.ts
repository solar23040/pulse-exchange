import { MarketTick, SectorIndex } from './company.model';
import { Order, Portfolio, LeaderboardEntry, Player, PlayerRole } from './player.model';
import { SessionState, RoundState, NewsItem, Alert, HostAction, Sentiment, DuelState } from './session.model';

// ═══════════════════════════════════════════════
//  Client → Server messages
// ═══════════════════════════════════════════════

export type ClientMessage =
  | { type: 'JOIN'; payload: { name: string; role: PlayerRole; firm?: string } }
  | { type: 'ORDER'; payload: { ticker: string; side: 'buy' | 'sell'; orderType: 'market' | 'limit' | 'stop'; quantity: number; price?: number } }
  | { type: 'CANCEL_ORDER'; payload: { orderId: string } }
  | { type: 'ALERT_CREATE'; payload: { ticker: string; alertType: 'take-profit' | 'stop-loss' | 'delta-velocity'; targetPrice?: number; deltaThreshold?: number } }
  | { type: 'ALERT_CANCEL'; payload: { alertId: string } }
  | { type: 'DUEL_CHALLENGE'; payload: { targetId: string } }
  | { type: 'DUEL_RESPOND'; payload: { duelId: string; accept: boolean } }
  | { type: 'HOST_ACTION'; payload: HostAction & { password: string } }
  | { type: 'BROADCAST'; payload: { title: string; body: string; ticker?: string; sector?: string; sentiment: Sentiment } }
  | { type: 'PING' };

// ═══════════════════════════════════════════════
//  Server → Client messages
// ═══════════════════════════════════════════════

export type ServerMessage =
  | { type: 'WELCOME'; payload: { playerId: string; session: SessionState; portfolio: Portfolio } }
  | { type: 'TICK'; payload: { ticks: MarketTick[]; indices: SectorIndex[]; px24: number; mood: number } }
  | { type: 'ORDER_FILL'; payload: Order }
  | { type: 'ORDER_REJECTED'; payload: { orderId: string; reason: string } }
  | { type: 'PORTFOLIO_UPDATE'; payload: Portfolio }
  | { type: 'LEADERBOARD'; payload: LeaderboardEntry[] }
  | { type: 'NEWS'; payload: NewsItem }
  | { type: 'ALERT_TRIGGERED'; payload: Alert }
  | { type: 'SESSION_STATE'; payload: SessionState }
  | { type: 'HOST_EVENT'; payload: { action: string; detail: string } }
  | { type: 'ROUND_UPDATE'; payload: RoundState }
  | { type: 'ROUND_END'; payload: { rankings: LeaderboardEntry[]; winner: LeaderboardEntry } }
  | { type: 'PLAYER_LIST'; payload: Player[] }
  | { type: 'DUEL_UPDATE'; payload: DuelState }
  | { type: 'PONG'; payload: { serverTime: number } }
  | { type: 'ERROR'; payload: { message: string } };
