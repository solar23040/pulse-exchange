import { Component, signal, computed, inject, ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, LineSeries, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { MarketService } from '../../core/services/market.service';
import { SessionService } from '../../core/services/session.service';
import { OrderSide, OrderType } from '../../core/models';

@Component({
  selector: 'app-trading-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminal-container">
      <!-- Main Left Area: Header + Chart + Tape -->
      <div class="main-panel">
        <!-- Stock Header Bar -->
        <div class="stock-header glass">
          <div class="stock-select-wrapper">
            <select
              [ngModel]="marketService.selectedTicker()"
              (ngModelChange)="onStockChange($event)"
              class="ticker-select"
            >
              @for (stock of marketService.stocksList(); track stock.ticker) {
                <option [value]="stock.ticker">{{ stock.ticker }} — {{ stock.name }}</option>
              }
            </select>
          </div>

          @if (selectedStock(); as stock) {
            <div class="header-metrics">
              <div class="metric">
                <span class="m-label">LAST PRICE</span>
                <span class="m-val price">₹{{ stock.price.toLocaleString('en-IN') }}</span>
              </div>
              <div class="metric">
                <span class="m-label">24H CHANGE</span>
                <span class="m-val" [class.gain]="stock.change >= 0" [class.loss]="stock.change < 0">
                  {{ stock.change >= 0 ? '+' : '' }}{{ stock.changePercent }}%
                </span>
              </div>
              <div class="metric">
                <span class="m-label">24H HIGH</span>
                <span class="m-val">₹{{ stock.high.toLocaleString('en-IN') }}</span>
              </div>
              <div class="metric">
                <span class="m-label">24H LOW</span>
                <span class="m-val">₹{{ stock.low.toLocaleString('en-IN') }}</span>
              </div>
              <div class="metric">
                <span class="m-label">VOLUME</span>
                <span class="m-val">{{ stock.volume.toLocaleString('en-IN') }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Chart Section -->
        <div class="chart-box glass">
          <div class="chart-toolbar">
            <span class="chart-title">Real-Time Tick Chart</span>
            <div class="timeframe-buttons">
              @for (tf of timeframes; track tf) {
                <button
                  class="tf-btn"
                  [class.active]="selectedTimeframe() === tf"
                  (click)="selectedTimeframe.set(tf)"
                >
                  {{ tf }}
                </button>
              }
            </div>
          </div>

          <div class="canvas-wrapper">
            @if (isChartLoading()) {
              <div class="chart-state">
                <span class="spinner"></span>
                <span>Loading live price feed…</span>
              </div>
            } @else if (isChartEmpty()) {
              <div class="chart-state empty">
                <span class="empty-icon">📉</span>
                <span>No price data for {{ marketService.selectedTicker() }} yet.</span>
              </div>
            }
            <div #chartContainer class="lw-chart"></div>
          </div>
        </div>

        <!-- Position & Holdings Summary for Selected Stock -->
        <div class="position-summary glass">
          <div class="summary-title">YOUR POSITION &bull; {{ marketService.selectedTicker() }}</div>
          @if (userPosition(); as pos) {
            <div class="pos-metrics">
              <div class="pm">
                <span>Holdings:</span>
                <strong>{{ pos.quantity }} shares</strong>
              </div>
              <div class="pm">
                <span>Avg Price:</span>
                <strong>₹{{ pos.avgPrice.toLocaleString('en-IN') }}</strong>
              </div>
              <div class="pm">
                <span>Current Value:</span>
                <strong>₹{{ pos.value.toLocaleString('en-IN') }}</strong>
              </div>
              <div class="pm">
                <span>Unrealized P&L:</span>
                <strong [class.gain]="pos.pnl >= 0" [class.loss]="pos.pnl < 0">
                  {{ pos.pnl >= 0 ? '+' : '' }}₹{{ pos.pnl.toLocaleString('en-IN') }} ({{ pos.pnlPercent }}%)
                </strong>
              </div>
            </div>
          } @else {
            <div class="no-pos">No open position in {{ marketService.selectedTicker() }}.</div>
          }
        </div>
      </div>

      <!-- Right Panel: Order Form -->
      <div class="order-panel glass">
        <div class="panel-header">ORDER ENTRY</div>

        <!-- Buy / Sell Side Toggle -->
        <div class="side-selector">
          <button
            class="side-btn buy"
            [class.active]="side() === 'buy'"
            (click)="side.set('buy')"
          >
            BUY
          </button>
          <button
            class="side-btn sell"
            [class.active]="side() === 'sell'"
            (click)="side.set('sell')"
          >
            SELL
          </button>
        </div>

        <!-- Order Type Selector -->
        <div class="type-selector">
          <button
            class="type-btn"
            [class.active]="orderType() === 'market'"
            (click)="orderType.set('market')"
          >
            MARKET
          </button>
          <button
            class="type-btn"
            [class.active]="orderType() === 'limit'"
            (click)="orderType.set('limit')"
          >
            LIMIT
          </button>
          <button
            class="type-btn"
            [class.active]="orderType() === 'stop'"
            (click)="orderType.set('stop')"
          >
            STOP
          </button>
        </div>

        <form (ngSubmit)="onSubmitOrder()" class="order-form">
          <!-- Limit/Stop Price Input -->
          @if (orderType() !== 'market') {
            <div class="form-field">
              <label>Target Price (₹)</label>
              <input
                type="number"
                [ngModel]="limitPrice()"
                (ngModelChange)="limitPrice.set($event)"
                name="limitPrice"
                step="0.05"
                min="1"
                class="field-input"
              />
            </div>
          }

          <!-- Quantity Input -->
          <div class="form-field">
            <label>Quantity (Shares)</label>
            <input
              type="number"
              [ngModel]="quantity()"
              (ngModelChange)="quantity.set($event)"
              name="quantity"
              min="1"
              step="1"
              class="field-input"
            />

            <!-- Quantity Shortcuts -->
            <div class="qty-shortcuts">
              <button type="button" (click)="setQty(10)">10</button>
              <button type="button" (click)="setQty(50)">50</button>
              <button type="button" (click)="setQty(100)">100</button>
              <button type="button" (click)="setQty(500)">500</button>
              <button type="button" (click)="setMaxQty()">MAX</button>
            </div>
          </div>

          <!-- Order Summary Calculation -->
          <div class="order-summary-box">
            <div class="sum-row">
              <span>Execution Price:</span>
              <span>₹{{ executionPrice().toLocaleString('en-IN') }}</span>
            </div>
            <div class="sum-row">
              <span>Estimated Total:</span>
              <strong>₹{{ estimatedCost().toLocaleString('en-IN') }}</strong>
            </div>
            <div class="sum-row">
              <span>Available Cash:</span>
              <span>₹{{ (sessionService.player()?.cash || 0).toLocaleString('en-IN') }}</span>
            </div>
          </div>

          <!-- Submit Order CTA -->
          <button
            type="submit"
            class="submit-order-btn"
            [class.buy-bg]="side() === 'buy'"
            [class.sell-bg]="side() === 'sell'"
            [disabled]="!isValidOrder()"
          >
            EXECUTE {{ side().toUpperCase() }} ORDER
          </button>

          @if (validationHint()) {
            <div class="validation-hint">{{ validationHint() }}</div>
          }
          @if (marketService.orderError(); as err) {
            <div class="order-feedback error" role="alert">
              <span>⚠️ {{ err }}</span>
              <button type="button" (click)="marketService.dismissOrderFeedback()">✕</button>
            </div>
          }
          @if (marketService.orderSuccess(); as msg) {
            <div class="order-feedback success" role="status">
              <span>✅ {{ msg }}</span>
              <button type="button" (click)="marketService.dismissOrderFeedback()">✕</button>
            </div>
          }
        </form>

        <!-- Recent Orders -->
        <div class="orders-history">
          <div class="history-title">RECENT ORDERS ({{ recentOrders().length }})</div>
          @if (recentOrders().length > 0) {
            <div class="history-list">
              @for (order of recentOrders(); track order.id) {
                <div class="history-row">
                  <span class="h-side" [class.buy]="order.side === 'buy'" [class.sell]="order.side === 'sell'">
                    {{ order.side.toUpperCase() }}
                  </span>
                  <span class="h-main">{{ order.quantity }} {{ order.ticker }} @ ₹{{ (order.filledPrice ?? order.price ?? 0).toLocaleString('en-IN') }}</span>
                  <span class="h-status" [class.pending]="order.status === 'pending'">{{ order.status.toUpperCase() }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="history-empty">No orders yet. Your fills and pending orders appear here.</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
      color: #e8ebf2;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .terminal-container {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 20px;
      height: 100%;
      max-width: 1600px;
      margin: 0 auto;
    }

    .main-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
    }

    .stock-header {
      padding: 14px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .ticker-select {
      background: rgba(10, 11, 16, 0.9);
      border: 1px solid rgba(124, 91, 240, 0.4);
      color: #ffffff;
      font-size: 1.1rem;
      font-weight: 800;
      padding: 8px 14px;
      border-radius: 8px;
      outline: none;
      cursor: pointer;
    }

    .header-metrics {
      display: flex;
      gap: 24px;
    }

    .metric {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .m-label {
      font-size: 0.68rem;
      font-weight: 700;
      color: #8b92a8;
      letter-spacing: 0.05em;
    }

    .m-val {
      font-size: 1.05rem;
      font-weight: 800;

      &.price { color: #ffffff; }
      &.gain { color: #22d97f; }
      &.loss { color: #f04864; }
    }

    .chart-box {
      flex: 1;
      min-height: 350px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    .chart-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .chart-title {
      font-size: 0.875rem;
      font-weight: 700;
      color: #c4c9d8;
    }

    .timeframe-buttons {
      display: flex;
      gap: 4px;
    }

    .tf-btn {
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: none;
      color: #8b92a8;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;

      &.active {
        background: #7c5bf0;
        color: #fff;
      }
    }

    .canvas-wrapper {
      flex: 1;
      position: relative;
      width: 100%;
      min-height: 320px;

      .lw-chart {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
    }

    .chart-state {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(10, 11, 16, 0.7);
      color: #8b92a8;
      font-size: 0.85rem;
      font-weight: 600;

      &.empty { flex-direction: column; }
      .empty-icon { font-size: 2rem; }
    }

    .spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-top-color: #7c5bf0;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .position-summary {
      padding: 14px 20px;
      border-radius: 12px;
      background: rgba(17, 19, 26, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .summary-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: #8b92a8;
      margin-bottom: 10px;
      letter-spacing: 0.05em;
    }

    .pos-metrics {
      display: flex;
      gap: 32px;
      font-size: 0.9rem;
    }

    .pm {
      display: flex;
      gap: 6px;

      span { color: #8b92a8; }
      strong.gain { color: #22d97f; }
      strong.loss { color: #f04864; }
    }

    .no-pos {
      font-size: 0.85rem;
      color: #5a6178;
      font-style: italic;
    }

    /* Right Order Panel */
    .order-panel {
      background: rgba(17, 19, 26, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .panel-header {
      font-size: 0.9rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #c4c9d8;
    }

    .side-selector {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: rgba(10, 11, 16, 0.6);
      padding: 4px;
      border-radius: 10px;
    }

    .side-btn {
      padding: 12px;
      border-radius: 8px;
      border: none;
      font-weight: 800;
      font-size: 0.9rem;
      cursor: pointer;
      color: #8b92a8;
      background: transparent;
      transition: all 0.2s ease;

      &.buy.active {
        background: #22d97f;
        color: #0a0b10;
        box-shadow: 0 4px 12px rgba(34, 217, 127, 0.3);
      }

      &.sell.active {
        background: #f04864;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(240, 72, 100, 0.3);
      }
    }

    .type-selector {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      background: rgba(10, 11, 16, 0.6);
      padding: 3px;
      border-radius: 8px;
    }

    .type-btn {
      padding: 6px;
      border-radius: 6px;
      border: none;
      font-size: 0.72rem;
      font-weight: 700;
      color: #8b92a8;
      background: transparent;
      cursor: pointer;

      &.active {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }

    .order-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #8b92a8;
      }
    }

    .field-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(10, 11, 16, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 1rem;
      font-weight: 700;
      outline: none;

      &:focus { border-color: #7c5bf0; }
    }

    .qty-shortcuts {
      display: flex;
      gap: 4px;

      button {
        flex: 1;
        padding: 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: #8b92a8;
        font-size: 0.7rem;
        font-weight: 600;
        cursor: pointer;

        &:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      }
    }

    .order-summary-box {
      background: rgba(10, 11, 16, 0.5);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.8125rem;
    }

    .sum-row {
      display: flex;
      justify-content: space-between;
      color: #8b92a8;

      strong { color: #fff; font-weight: 700; }
    }

    .submit-order-btn {
      width: 100%;
      padding: 14px;
      border-radius: 10px;
      border: none;
      font-size: 0.95rem;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s ease;

      &.buy-bg {
        background: #22d97f;
        color: #0a0b10;
        &:hover:not(:disabled) { background: #1eb96d; }
      }

      &.sell-bg {
        background: #f04864;
        color: #fff;
        &:hover:not(:disabled) { background: #d0354e; }
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .validation-hint {
      font-size: 0.78rem;
      color: #f5a623;
      font-weight: 600;
    }

    .order-feedback {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;

      button {
        background: none;
        border: none;
        cursor: pointer;
        color: inherit;
        font-size: 0.8rem;
      }

      &.error {
        background: rgba(240, 72, 100, 0.12);
        border: 1px solid rgba(240, 72, 100, 0.35);
        color: #ff94a5;
      }

      &.success {
        background: rgba(34, 217, 127, 0.1);
        border: 1px solid rgba(34, 217, 127, 0.3);
        color: #5eeaa0;
      }
    }

    .orders-history {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 12px;
    }

    .history-title {
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #8b92a8;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 180px;
      overflow-y: auto;
    }

    .history-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.76rem;
      background: rgba(10, 11, 16, 0.5);
      border-radius: 6px;
      padding: 6px 8px;
    }

    .h-side {
      font-weight: 800;
      font-size: 0.68rem;
      padding: 2px 6px;
      border-radius: 4px;

      &.buy { background: rgba(34, 217, 127, 0.15); color: #22d97f; }
      &.sell { background: rgba(240, 72, 100, 0.15); color: #f04864; }
    }

    .h-main { color: #c4c9d8; flex: 1; }

    .h-status {
      color: #22d97f;
      font-weight: 700;
      font-size: 0.68rem;

      &.pending { color: #f5a623; }
    }

    .history-empty {
      font-size: 0.78rem;
      color: #5a6178;
      font-style: italic;
    }
  `]
})
export class TradingTerminalComponent implements AfterViewInit, OnDestroy {
  public marketService = inject(MarketService);
  public sessionService = inject(SessionService);

  @ViewChild('chartContainer') chartContainer!: ElementRef<HTMLDivElement>;

  public side = signal<OrderSide>('buy');
  public orderType = signal<OrderType>('market');
  public quantity = signal<number>(10);
  public limitPrice = signal<number>(0);
  public selectedTimeframe = signal<string>('1m');

  public timeframes = ['1m', '5m', '15m', '1h', '1d'];

  private chart: IChartApi | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastChartTicker: string | null = null;

  public selectedStock = computed(() => this.marketService.selectedStock());
  public userPosition = computed(() => this.marketService.userPositionForSelected());
  public recentOrders = computed(() => this.marketService.orders().slice(0, 8));

  public isChartLoading = computed(() => !this.selectedStock());
  public isChartEmpty = computed(() => {
    const stock = this.selectedStock();
    return !!stock && (!stock.sparklineData || stock.sparklineData.length === 0);
  });

  public executionPrice = computed(() => {
    if (this.orderType() !== 'market' && this.limitPrice() > 0) {
      return this.limitPrice();
    }
    return this.selectedStock()?.price || 0;
  });

  public estimatedCost = computed(() => {
    return Math.round(this.executionPrice() * this.quantity());
  });

  public validationHint = computed(() => {
    const qty = this.quantity();
    if (!Number.isInteger(qty) || qty <= 0) return 'Enter a whole quantity of at least 1 share.';
    const stock = this.selectedStock();
    if (!stock) return 'Waiting for the live price feed…';
    if (this.orderType() !== 'market' && this.limitPrice() <= 0) {
      return 'Set a target price above ₹0 for limit / stop orders.';
    }
    if (this.side() === 'buy') {
      const cash = this.sessionService.player()?.cash || 0;
      if (cash < this.estimatedCost()) {
        return `Insufficient balance: needs ₹${this.estimatedCost().toLocaleString('en-IN')}, available ₹${Math.round(cash).toLocaleString('en-IN')}.`;
      }
    } else {
      const pos = this.userPosition();
      if (!pos || pos.quantity < qty) {
        return `You hold ${pos ? pos.quantity : 0} ${stock.ticker}; reduce the sell quantity.`;
      }
    }
    return null;
  });

  constructor() {
    // Refresh the chart whenever the selected asset, its live ticks, or the
    // timeframe window changes. Guarded until ngAfterViewInit creates it.
    effect(() => {
      const stock = this.selectedStock();
      this.selectedTimeframe();
      if (stock) this.updateChart();
    });
  }

  public onStockChange(ticker: string) {
    this.marketService.selectStock(ticker);
    const stock = this.marketService.selectedStock();
    if (stock) {
      this.limitPrice.set(stock.price);
    }
  }

  ngAfterViewInit() {
    const el = this.chartContainer.nativeElement;
    this.chart = createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: '#8b92a8' },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true },
      width: el.clientWidth,
      height: el.clientHeight || 320
    });
    this.lineSeries = this.chart.addSeries(LineSeries, { lineWidth: 2, priceLineVisible: true });
    this.updateChart(true);

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.chart) return;
      const w = el.clientWidth;
      const h = el.clientHeight || 320;
      if (w > 0 && h > 0) this.chart.applyOptions({ width: w, height: h });
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.lineSeries = null;
    }
  }

  public setQty(val: number) {
    this.quantity.set(val);
  }

  public setMaxQty() {
    const stock = this.selectedStock();
    if (!stock) return;

    if (this.side() === 'buy') {
      const cash = this.sessionService.player()?.cash || 0;
      const max = Math.floor(cash / stock.price);
      this.quantity.set(Math.max(1, max));
    } else {
      const pos = this.userPosition();
      this.quantity.set(pos ? pos.quantity : 0);
    }
  }

  public isValidOrder(): boolean {
    if (this.quantity() <= 0) return false;
    const stock = this.selectedStock();
    if (!stock) return false;

    if (this.side() === 'buy') {
      const cash = this.sessionService.player()?.cash || 0;
      return cash >= this.estimatedCost();
    } else {
      const pos = this.userPosition();
      return !!pos && pos.quantity >= this.quantity();
    }
  }

  public onSubmitOrder() {
    const stock = this.selectedStock();
    if (!stock) {
      this.marketService.placeOrder(this.marketService.selectedTicker(), this.side(), this.orderType(), this.quantity());
      return;
    }
    this.marketService.placeOrder(
      stock.ticker,
      this.side(),
      this.orderType(),
      this.quantity(),
      this.orderType() !== 'market' ? this.limitPrice() : undefined
    );
  }

  private timeframeWindow(): number {
    switch (this.selectedTimeframe()) {
      case '1m': return 12;
      case '5m': return 24;
      case '15m': return 40;
      default: return 60;
    }
  }

  private updateChart(fit = false) {
    if (!this.chart || !this.lineSeries) return;
    const stock = this.selectedStock();
    if (!stock || !stock.sparklineData || stock.sparklineData.length === 0) return;

    const data = stock.sparklineData.slice(-this.timeframeWindow());
    const nowSec = Math.floor(Date.now() / 1000);
    const start = nowSec - (data.length - 1) * 5;
    this.lineSeries.setData(
      data.map((value, i) => ({ time: (start + i * 5) as UTCTimestamp, value: Math.round(value * 100) / 100 }))
    );
    const color = stock.change >= 0 ? '#22d97f' : '#f04864';
    this.lineSeries.applyOptions({ color, lineWidth: 2 });

    if (fit || this.lastChartTicker !== stock.ticker) {
      this.lastChartTicker = stock.ticker;
      this.chart.timeScale().fitContent();
    }
  }
}
