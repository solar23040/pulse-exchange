import { Injectable, signal, computed, inject, DestroyRef, effect, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from './websocket.service';
import { SessionService } from './session.service';
import { AudioService } from './audio.service';
import { OfflineBrokerService } from './offline-broker.service';
import { COMPANY_LIST, Company, MarketTick, SectorIndex, LeaderboardEntry, NewsItem, Alert, Order, Portfolio, SessionState, PlayerRole, ServerMessage } from '../models';
import { generateUuid } from '../utils';

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
  private broker = inject(OfflineBrokerService);
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
  public orders = signal<Order[]>([]);
  public orderError = signal<string | null>(null);
  public orderSuccess = signal<string | null>(null);

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
    this.wireOfflineBroker();
  }

  /**
   * When no live server is reachable the WebSocket layer falls back to
   * offline mode and never emits TICK / PORTFOLIO_UPDATE. Mirror the local
   * broker feed into the same signals the server path uses.
   */
  private wireOfflineBroker() {
    effect(() => {
      const player = this.sessionService.player();
      const offline = this.wsService.isOfflineMode() || !this.wsService.isConnected();
      if (player && offline && !this.broker.isRunning()) {
        this.broker.start();
      }
    });

    effect(() => {
      const tick = this.broker.state();
      if (!tick || this.wsService.isConnected()) return;
      // untracked: this effect writes stocksMap, so reading it tracked would loop.
      const currentMap = new Map(untracked(() => this.stocksMap()));
      for (const t of tick.ticks) {
        const existing = currentMap.get(t.ticker);
        if (existing) {
          currentMap.set(t.ticker, {
            ...existing,
            price: t.price,
            change: t.change,
            changePercent: t.changePercent,
            volume: t.volume,
            high: t.high,
            low: t.low,
            open: t.open,
            sparklineData: t.sparklineData
          });
        }
      }
      this.stocksMap.set(currentMap);
      this.sectorIndices.set(tick.indices);
      this.px24Index.set(tick.px24);
      this.marketMood.set(tick.mood);
    });

    effect(() => {
      if (this.wsService.isConnected()) return;
      const portfolio = this.broker.portfolio();
      if (portfolio) this.portfolio.set(portfolio);
    });

    effect(() => {
      if (this.wsService.isConnected()) return;
      this.orders.set(this.broker.orders());
    });
  }

  private initCompanyMap() {
    const map = new Map<string, EnrichedCompany>();
    for (const c of COMPANY_LIST) {
      // Seed a short random-walk history so the chart has shape before the
      // first live tick arrives (mirrors the server engine seed).
      const spark: number[] = [];
      let p = c.basePrice;
      for (let i = 0; i < 20; i++) {
        p = Math.max(1, Math.round((p + (Math.random() - 0.49) * 0.01 * p) * 100) / 100);
        spark.push(p);
      }
      const price = spark[spark.length - 1];
      map.set(c.ticker, {
        ...c,
        price,
        change: 0,
        changePercent: 0,
        volume: 10000,
        high: Math.max(...spark),
        low: Math.min(...spark),
        open: spark[0],
        sparklineData: spark
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
        this.orders.update(list => [msg.payload, ...list].slice(0, 100));
        this.orderSuccess.set(
          `${msg.payload.side.toUpperCase()} ${msg.payload.quantity} ${msg.payload.ticker} @ ₹${Number(msg.payload.filledPrice ?? msg.payload.price ?? 0).toLocaleString('en-IN')}`
        );
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
        this.orderError.set(msg.payload.reason || 'Order rejected by the exchange.');
        break;
      }

      case 'ERROR': {
        this.audioService.playError();
        this.orderError.set(msg.payload.message || 'Exchange error.');
        break;
      }
    }
  }

  public selectStock(ticker: string) {
    this.selectedTicker.set(ticker);
  }

  public placeOrder(ticker: string, side: 'buy' | 'sell', orderType: 'market' | 'limit' | 'stop', quantity: number, price?: number) {
    this.orderError.set(null);
    this.orderSuccess.set(null);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      this.orderError.set('Quantity must be a positive whole number.');
      this.audioService.playError();
      return;
    }
    if (orderType !== 'market' && (price === undefined || price <= 0)) {
      this.orderError.set(`${orderType.toUpperCase()} orders need a target price above ₹0.`);
      this.audioService.playError();
      return;
    }

    // Live server path.
    if (this.wsService.isConnected()) {
      this.wsService.send({
        type: 'ORDER',
        payload: { ticker, side, orderType, quantity, price }
      });
      return;
    }

    // Offline path: execute against the local broker engine.
    if (!this.broker.isRunning()) this.broker.start();
    const result = this.broker.executeOrder(ticker, side, orderType, quantity, price);
    if ('error' in result) {
      this.orderError.set(result.error);
      this.audioService.playError();
      return;
    }
    const order = result.order;
    this.orders.set(this.broker.orders());
    const filledPrice = order.filledPrice ?? order.price ?? this.broker.currentPrice(ticker);
    if (order.status === 'filled') {
      this.audioService.playOrderFill();
      this.orderSuccess.set(
        `${order.side.toUpperCase()} ${order.quantity} ${order.ticker} @ ₹${Number(filledPrice).toLocaleString('en-IN')}`
      );
    } else {
      this.orderSuccess.set(
        `${order.type.toUpperCase()} ${order.side.toUpperCase()} ${order.quantity} ${order.ticker} queued @ ₹${Number(order.price ?? 0).toLocaleString('en-IN')}`
      );
    }
  }

  public dismissOrderFeedback(): void {
    this.orderError.set(null);
    this.orderSuccess.set(null);
  }

  public createAlert(ticker: string, alertType: 'take-profit' | 'stop-loss' | 'delta-velocity', targetPrice?: number, deltaThreshold?: number) {
    const alertId = generateUuid();
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
