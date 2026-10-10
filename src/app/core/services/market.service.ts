import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from './websocket.service';
import { SessionService } from './session.service';
import { AudioService } from './audio.service';
import { COMPANY_LIST, Company, MarketTick, SectorIndex, LeaderboardEntry, NewsItem, Alert, Portfolio, SessionState, PlayerRole, ServerMessage } from '../models';

export interface EnrichedCompany extends Company {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  sparklineData: number[];
}

@Injectable({
  providedIn: 'root'
})
export class MarketService {
  private wsService = inject(WebSocketService);
  private sessionService = inject(SessionService);
  private audioService = inject(AudioService);
  private destroyRef = inject(DestroyRef);

  // State Signals
  public stocksMap = signal<Map<string, EnrichedCompany>>(new Map());
  public sectorIndices = signal<SectorIndex[]>([]);
  public px24Index = signal<number>(100.0);
  public marketMood = signal<number>(50);
  public selectedTicker = signal<string>('NXON');

  public leaderboard = signal<LeaderboardEntry[]>([]);
  public newsFeed = signal<NewsItem[]>([]);
  public activeAlerts = signal<Alert[]>([]);
  public portfolio = signal<Portfolio | null>(null);
  public sessionState = signal<SessionState | null>(null);

  // Computed signals
  public stocksList = computed(() => Array.from(this.stocksMap().values()));

  public selectedStock = computed(() => {
    const ticker = this.selectedTicker();
    return this.stocksMap().get(ticker) || this.stocksList()[0] || null;
  });

  public userPositionForSelected = computed(() => {
    const p = this.portfolio();
    const ticker = this.selectedTicker();
    if (!p) return null;
    return p.positions.find(pos => pos.ticker === ticker) || null;
  });

  public topGainers = computed(() => {
    return [...this.stocksList()].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  });

  public topLosers = computed(() => {
    return [...this.stocksList()].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
  });

  constructor() {
    this.initCompanyMap();
    this.listenToWebSocket();
  }

  private initCompanyMap() {
    const map = new Map<string, EnrichedCompany>();
    for (const c of COMPANY_LIST) {
      map.set(c.ticker, {
        ...c,
        price: c.basePrice,
        change: 0,
        changePercent: 0,
        volume: 10000,
        high: c.basePrice,
        low: c.basePrice,
        open: c.basePrice,
        sparklineData: [c.basePrice, c.basePrice]
      });
    }
    this.stocksMap.set(map);
  }

  private listenToWebSocket() {
    this.wsService.messages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: ServerMessage) => {
        this.handleServerMessage(msg);
      });
  }

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'WELCOME': {
        this.sessionState.set(msg.payload.session);
        this.portfolio.set(msg.payload.portfolio);
        break;
      }

      case 'TICK': {
        const currentMap = new Map(this.stocksMap());
        for (const tick of msg.payload.ticks) {
          const existing = currentMap.get(tick.ticker);
          if (existing) {
            currentMap.set(tick.ticker, {
              ...existing,
              price: tick.price,
              change: tick.change,
              changePercent: tick.changePercent,
              volume: tick.volume,
              high: tick.high,
              low: tick.low,
              open: tick.open,
              sparklineData: tick.sparklineData
            });
          }
        }
        this.stocksMap.set(currentMap);
        this.sectorIndices.set(msg.payload.indices);
        this.px24Index.set(msg.payload.px24);
        this.marketMood.set(msg.payload.mood);
        break;
      }

      case 'PORTFOLIO_UPDATE': {
        this.portfolio.set(msg.payload);
        const player = this.sessionService.player();
        if (player) {
          this.sessionService.updatePlayer({
            cash: msg.payload.cash,
            portfolioValue: msg.payload.totalValue - msg.payload.cash,
            totalValue: msg.payload.totalValue
          });
        }
        break;
      }

      case 'LEADERBOARD': {
        this.leaderboard.set(msg.payload);
        break;
      }

      case 'NEWS': {
        this.newsFeed.update(feed => [msg.payload, ...feed.slice(0, 49)]);
        break;
      }

      case 'ORDER_FILL': {
        this.audioService.playOrderFill();
        break;
      }

      case 'ALERT_TRIGGERED': {
        this.audioService.playAlert();
        this.activeAlerts.update(alerts =>
          alerts.map(a => a.id === msg.payload.id ? { ...a, status: 'triggered' as const } : a)
        );
        break;
      }

      case 'SESSION_STATE': {
        this.sessionState.set(msg.payload);
        break;
      }

      case 'ORDER_REJECTED': {
        this.audioService.playError();
        break;
      }
    }
  }

  public selectStock(ticker: string) {
    this.selectedTicker.set(ticker);
  }

  public placeOrder(ticker: string, side: 'buy' | 'sell', orderType: 'market' | 'limit' | 'stop', quantity: number, price?: number) {
    this.wsService.send({
      type: 'ORDER',
      payload: { ticker, side, orderType, quantity, price }
    });
  }

  public createAlert(ticker: string, alertType: 'take-profit' | 'stop-loss' | 'delta-velocity', targetPrice?: number, deltaThreshold?: number) {
    const alertId = crypto.randomUUID();
    const newAlert: Alert = {
      id: alertId,
      ticker,
      type: alertType,
      targetPrice,
      deltaThreshold,
      status: 'active',
      createdAt: Date.now(),
      playerId: this.sessionService.player()?.id || ''
    };
    this.activeAlerts.update(alerts => [newAlert, ...alerts]);

    this.wsService.send({
      type: 'ALERT_CREATE',
      payload: { ticker, alertType, targetPrice, deltaThreshold }
    });
  }

  public cancelAlert(alertId: string) {
    this.activeAlerts.update(alerts => alerts.filter(a => a.id !== alertId));
    this.wsService.send({
      type: 'ALERT_CANCEL',
      payload: { alertId }
    });
  }

  public sendHostAction(actionObj: any, password: string) {
    this.wsService.send({
      type: 'HOST_ACTION',
      payload: { ...actionObj, password }
    });
  }
}
