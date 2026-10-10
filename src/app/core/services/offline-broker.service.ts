import { Injectable, signal, inject, NgZone } from '@angular/core';
import { SessionService } from './session.service';
import {
  COMPANY_LIST,
  SECTOR_INDEX_NAMES,
  MarketTick,
  SectorIndex,
  Order,
  Portfolio,
} from '../models';
import { generateUuid } from '../utils';

export interface OfflineTickState {
  ticks: MarketTick[];
  indices: SectorIndex[];
  px24: number;
  mood: number;
}

interface SimStock {
  ticker: string;
  sector: string;
  price: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
  volume: number;
  sparklineData: number[];
  beta: number;
  volatility: string;
  basePrice: number;
}

const PRICES_KEY = 'pulse_prices_v1';
const holdingsKey = (pid: string) => `pulse_holdings_${pid}`;
const ordersKey = (pid: string) => `pulse_orders_${pid}`;
const equityKey = (pid: string) => `pulse_equity_${pid}`;

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — simulation continues in memory.
  }
}

/**
 * Local fallback exchange engine. Mirrors server/market-engine.js,
 * server/order-engine.js and server/player-manager.js so trading, the live
 * price feed and the chart keep working when no WebSocket server is
 * reachable (e.g. `ng serve` on :4200 while the backend defaults to the
 * same port). All state persists to localStorage per player id.
 */
@Injectable({ providedIn: 'root' })
export class OfflineBrokerService {
  private sessionService = inject(SessionService);
  private zone = inject(NgZone);

  public readonly isRunning = signal(false);
  public readonly state = signal<OfflineTickState | null>(null);
  public readonly portfolio = signal<Portfolio | null>(null);
  public readonly orders = signal<Order[]>([]);

  private stocks = new Map<string, SimStock>();
  private sectorTrends: Record<string, number> = {};
  private marketMood = 50;
  private holdings = new Map<string, { ticker: string; quantity: number; avgPrice: number }>();
  private pending: Order[] = [];
  private equityCurve: { time: number; value: number }[] = [];
  private playerId: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  public start(): void {
    const player = this.sessionService.player();
    if (!player || this.isRunning()) return;
    this.playerId = player.id;

    this.sectorTrends = { TECH: 0, PHARMA: 0, BANK: 0, ENERGY: 0, CONSUMER: 0, INFRA: 0 };
    this.seedStocks();
    this.loadPlayerState(player.id, player.initialCash);
    this.rebuildPortfolio();

    this.isRunning.set(true);
    this.emitTick();

    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => this.zone.run(() => this.emitTick()), 1200);
    });
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isRunning.set(false);
  }

  public currentPrice(ticker: string): number {
    return this.stocks.get(ticker)?.price ?? 0;
  }

  public executeOrder(
    ticker: string,
    side: 'buy' | 'sell',
    orderType: 'market' | 'limit' | 'stop',
    quantity: number,
    price?: number
  ): { order: Order } | { error: string } {
    const player = this.sessionService.player();
    if (!player || !this.playerId || player.id !== this.playerId) {
      return { error: 'Join the trading floor before placing orders.' };
    }
    const stock = this.stocks.get(ticker);
    if (!stock) return { error: `Unknown ticker: ${ticker}.` };
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: 'Quantity must be a positive whole number.' };
    }

    if (orderType === 'market') {
      return this.fillMarketOrder(player.cash, ticker, side, quantity, stock.price, 'market', stock.price);
    }

    if (price === undefined || price <= 0) {
      return { error: `${orderType.toUpperCase()} orders need a target price above ₹0.` };
    }
    if (side === 'buy' && player.cash < price * quantity) {
      return {
        error: `Insufficient balance. Needs ₹${Math.round(price * quantity).toLocaleString('en-IN')}, available ₹${Math.round(player.cash).toLocaleString('en-IN')}.`,
      };
    }
    if (side === 'sell') {
      const holding = this.holdings.get(ticker);
      const avail = holding ? holding.quantity : 0;
      if (avail < quantity) {
        return { error: `Insufficient shares. You hold ${avail} ${ticker}, tried to sell ${quantity}.` };
      }
    }

    const order: Order = {
      id: generateUuid(),
      ticker,
      side,
      type: orderType,
      quantity,
      price,
      status: 'pending',
      timestamp: Date.now(),
      playerId: player.id,
    };
    this.pending.push(order);
    this.syncOrders();
    return { order };
  }

  private fillMarketOrder(
    cash: number,
    ticker: string,
    side: 'buy' | 'sell',
    quantity: number,
    executionPrice: number,
    type: Order['type'],
    limitPrice?: number
  ): { order: Order } | { error: string } {
    const player = this.sessionService.player();
    if (!player) return { error: 'Join the trading floor before placing orders.' };
    const total = executionPrice * quantity;

    if (side === 'buy') {
      if (cash < total) {
        return {
          error: `Insufficient balance. Needs ₹${Math.round(total).toLocaleString('en-IN')}, available ₹${Math.round(cash).toLocaleString('en-IN')}.`,
        };
      }
      const holding = this.holdings.get(ticker);
      if (holding) {
        const totalQty = holding.quantity + quantity;
        holding.avgPrice = Math.round(((holding.quantity * holding.avgPrice + total) / totalQty) * 100) / 100;
        holding.quantity = totalQty;
      } else {
        this.holdings.set(ticker, { ticker, quantity, avgPrice: executionPrice });
      }
      this.sessionService.updatePlayer({ cash: Math.round((cash - total) * 100) / 100 });
    } else {
      const holding = this.holdings.get(ticker);
      const avail = holding ? holding.quantity : 0;
      if (avail < quantity) {
        return { error: `Insufficient shares. You hold ${avail} ${ticker}, tried to sell ${quantity}.` };
      }
      const remaining = holding!.quantity - quantity;
      if (remaining <= 0) this.holdings.delete(ticker);
      else holding!.quantity = remaining;
      this.sessionService.updatePlayer({ cash: Math.round((cash + total) * 100) / 100 });
    }

    const order: Order = {
      id: generateUuid(),
      ticker,
      side,
      type,
      quantity,
      price: limitPrice ?? executionPrice,
      filledPrice: executionPrice,
      status: 'filled',
      timestamp: Date.now(),
      playerId: player.id,
      filledAt: Date.now(),
    };
    this.persistHoldings();
    this.syncOrders(order);
    this.rebuildPortfolio();
    return { order };
  }

  private emitTick(): void {
    if (!this.playerId) return;
    const ticks: MarketTick[] = [];
    let totalVal = 0;
    let baseVal = 0;

    this.marketMood = Math.max(10, Math.min(90, this.marketMood + (Math.random() - 0.5) * 2));
    for (const sector of Object.keys(this.sectorTrends)) {
      this.sectorTrends[sector] = Math.max(-0.05, Math.min(0.05, this.sectorTrends[sector] + (Math.random() - 0.5) * 0.002));
    }
    const marketDrift = (Math.random() - 0.49) * 0.003 * (this.marketMood / 50);

    for (const stock of this.stocks.values()) {
      const volMult =
        stock.volatility === 'very-high' ? 2.2 : stock.volatility === 'high' ? 1.6 : stock.volatility === 'medium' ? 1.0 : 0.6;
      const noise = (Math.random() - 0.495) * 0.006 * stock.beta * volMult;
      const totalReturn = marketDrift + (this.sectorTrends[stock.sector] || 0) + noise;
      const next = Math.max(1, Math.round((stock.price + stock.price * totalReturn) * 100) / 100);
      stock.price = next;
      stock.high = Math.max(stock.high, next);
      stock.low = Math.min(stock.low, next);
      stock.change = Math.round((next - stock.open) * 100) / 100;
      stock.changePercent = Math.round((stock.change / stock.open) * 10000) / 100;
      stock.volume += Math.floor(Math.random() * 500 * volMult) + 10;
      stock.sparklineData.push(next);
      if (stock.sparklineData.length > 60) stock.sparklineData.shift();

      ticks.push({
        ticker: stock.ticker,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        volume: stock.volume,
        high: stock.high,
        low: stock.low,
        open: stock.open,
        sparklineData: [...stock.sparklineData],
      });
      totalVal += next;
      baseVal += stock.basePrice;
    }

    const indices = this.buildIndices();
    const px24 = Math.round((totalVal / baseVal) * 10000) / 100;
    this.state.set({ ticks, indices, px24, mood: Math.round(this.marketMood) });

    this.persistPrices();
    this.fillPendingOrders();
    this.rebuildPortfolio();
  }

  private fillPendingOrders(): void {
    if (this.pending.length === 0) return;
    const player = this.sessionService.player();
    if (!player) return;
    const remaining: Order[] = [];
    let filledAny = false;

    for (const order of this.pending) {
      const stock = this.stocks.get(order.ticker);
      if (!stock) continue;
      let trigger = false;
      if (order.type === 'limit') {
        trigger =
          (order.side === 'buy' && stock.price <= (order.price ?? 0)) ||
          (order.side === 'sell' && stock.price >= (order.price ?? 0));
      } else if (order.type === 'stop') {
        trigger =
          (order.side === 'buy' && stock.price >= (order.price ?? 0)) ||
          (order.side === 'sell' && stock.price <= (order.price ?? 0));
      }
      if (!trigger) {
        remaining.push(order);
        continue;
      }
      const cash = this.sessionService.player()?.cash ?? 0;
      const result = this.fillMarketOrder(cash, order.ticker, order.side, order.quantity, stock.price, order.type, order.price);
      if ('order' in result) {
        filledAny = true;
      } else {
        const rejected: Order = { ...order, status: 'rejected' };
        this.syncOrders(rejected);
      }
    }

    this.pending = remaining;
    if (filledAny) this.syncOrders();
  }

  private seedStocks(): void {
    const saved = loadJson<Record<string, number[]>>(PRICES_KEY);
    this.stocks.clear();
    for (const company of COMPANY_LIST) {
      const prior = saved?.[company.ticker];
      let spark: number[];
      if (prior && prior.length >= 5) {
        spark = prior.slice(-60);
      } else {
        spark = [];
        let p = company.basePrice;
        for (let i = 0; i < 20; i++) {
          p = Math.max(1, Math.round((p + (Math.random() - 0.49) * 0.01 * p) * 100) / 100);
          spark.push(p);
        }
      }
      const price = spark[spark.length - 1];
      const open = spark[0];
      this.stocks.set(company.ticker, {
        ticker: company.ticker,
        sector: company.sector,
        price,
        open,
        high: Math.max(...spark),
        low: Math.min(...spark),
        change: Math.round((price - open) * 100) / 100,
        changePercent: Math.round(((price - open) / open) * 10000) / 100,
        volume: Math.floor(Math.random() * 50000) + 10000,
        sparklineData: spark,
        beta: company.beta,
        volatility: company.volatility,
        basePrice: company.basePrice,
      });
    }
  }

  private loadPlayerState(playerId: string, initialCash: number): void {
    this.holdings.clear();
    const savedHoldings = loadJson<Record<string, { quantity: number; avgPrice: number }>>(holdingsKey(playerId));
    if (savedHoldings) {
      for (const [ticker, h] of Object.entries(savedHoldings)) {
        if (h.quantity > 0) this.holdings.set(ticker, { ticker, quantity: h.quantity, avgPrice: h.avgPrice });
      }
    }
    const savedOrders = loadJson<Order[]>(ordersKey(playerId));
    this.pending = (savedOrders ?? []).filter((o) => o.status === 'pending');
    this.orders.set(savedOrders ?? []);
    this.equityCurve = loadJson<{ time: number; value: number }[]>(equityKey(playerId)) ?? [
      { time: Math.floor(Date.now() / 1000), value: initialCash },
    ];
  }

  private rebuildPortfolio(): void {
    const player = this.sessionService.player();
    if (!player || !this.playerId) return;

    let positionValue = 0;
    let unrealized = 0;
    const positions = [];
    for (const h of this.holdings.values()) {
      const current = this.stocks.get(h.ticker)?.price ?? h.avgPrice;
      const value = h.quantity * current;
      const cost = h.quantity * h.avgPrice;
      const pnl = value - cost;
      positionValue += value;
      unrealized += pnl;
      positions.push({
        ticker: h.ticker,
        quantity: h.quantity,
        avgPrice: h.avgPrice,
        currentPrice: current,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: cost > 0 ? Math.round((pnl / cost) * 10000) / 100 : 0,
        value: Math.round(value * 100) / 100,
        allocation: 0,
        side: 'long' as const,
      });
    }

    const totalValue = player.cash + positionValue;
    for (const pos of positions) {
      pos.allocation = totalValue > 0 ? Math.round((pos.value / totalValue) * 10000) / 100 : 0;
    }
    this.equityCurve.push({ time: Math.floor(Date.now() / 1000), value: Math.round(totalValue * 100) / 100 });
    if (this.equityCurve.length > 200) this.equityCurve.shift();
    saveJson(equityKey(this.playerId), this.equityCurve);

    const totalPnl = totalValue - player.initialCash;
    this.portfolio.set({
      cash: Math.round(player.cash * 100) / 100,
      positions,
      totalValue: Math.round(totalValue * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      realizedPnl: 0,
      unrealizedPnl: Math.round(unrealized * 100) / 100,
      peakValue: Math.max(...this.equityCurve.map((c) => c.value), totalValue),
      drawdown: 0,
      equityCurve: [...this.equityCurve],
      deltaExposure: 1.0,
      gammaExposure: 0,
    });
    this.sessionService.updatePlayer({
      portfolioValue: Math.round(positionValue * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
    });
  }

  private buildIndices(): SectorIndex[] {
    const sums: Record<string, number> = {};
    const bases: Record<string, number> = {};
    for (const stock of this.stocks.values()) {
      sums[stock.sector] = (sums[stock.sector] ?? 0) + stock.price;
      bases[stock.sector] = (bases[stock.sector] ?? 0) + stock.open;
    }
    return Object.keys(SECTOR_INDEX_NAMES).map((sector) => {
      const current = sums[sector] || 1;
      const base = bases[sector] || 1;
      const change = current - base;
      return {
        sector: sector as SectorIndex['sector'],
        name: SECTOR_INDEX_NAMES[sector as keyof typeof SECTOR_INDEX_NAMES],
        value: Math.round(current * 10) / 10,
        change: Math.round(change * 10) / 10,
        changePercent: Math.round((change / base) * 10000) / 100,
      };
    });
  }

  private persistPrices(): void {
    const out: Record<string, number[]> = {};
    for (const [ticker, stock] of this.stocks) out[ticker] = stock.sparklineData.slice(-60);
    saveJson(PRICES_KEY, out);
  }

  private persistHoldings(): void {
    if (!this.playerId) return;
    const out: Record<string, { quantity: number; avgPrice: number }> = {};
    for (const [ticker, h] of this.holdings) out[ticker] = { quantity: h.quantity, avgPrice: h.avgPrice };
    saveJson(holdingsKey(this.playerId), out);
  }

  private syncOrders(filled?: Order): void {
    if (!this.playerId) return;
    const filledList = this.orders().filter((o) => o.status !== 'pending');
    const all = [...this.pending.map((o) => ({ ...o })), ...(filled ? [filled] : []), ...filledList].slice(0, 100);
    this.orders.set(all);
    saveJson(ordersKey(this.playerId), all);
  }
}
