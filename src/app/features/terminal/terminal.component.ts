import { Component, signal, computed, inject, ChangeDetectionStrategy, ElementRef, ViewChild, AfterViewInit, EffectRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
              (ngModelChange)="marketService.selectStock($event)"
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
            <canvas #chartCanvas></canvas>
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
                [(ngModel)]="limitPrice"
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
              [(ngModel)]="quantity"
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
        </form>
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
      height: 100%;

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
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
  `]
})
export class TradingTerminalComponent implements AfterViewInit {
  public marketService = inject(MarketService);
  public sessionService = inject(SessionService);

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  public side = signal<OrderSide>('buy');
  public orderType = signal<OrderType>('market');
  public quantity = signal<number>(10);
  public limitPrice = signal<number>(0);
  public selectedTimeframe = signal<string>('1m');

  public timeframes = ['1m', '5m', '15m', '1h', '1d'];

  public selectedStock = computed(() => this.marketService.selectedStock());
  public userPosition = computed(() => this.marketService.userPositionForSelected());

  public executionPrice = computed(() => {
    if (this.orderType() !== 'market' && this.limitPrice() > 0) {
      return this.limitPrice();
    }
    return this.selectedStock()?.price || 0;
  });

  public estimatedCost = computed(() => {
    return Math.round(this.executionPrice() * this.quantity());
  });

  constructor() {
    effect(() => {
      const stock = this.selectedStock();
      if (stock) {
        this.limitPrice.set(stock.price);
        this.drawChart();
      }
    });
  }

  ngAfterViewInit() {
    this.drawChart();
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
    if (!this.isValidOrder()) return;
    const stock = this.selectedStock();
    if (!stock) return;

    this.marketService.placeOrder(
      stock.ticker,
      this.side(),
      this.orderType(),
      this.quantity(),
      this.orderType() !== 'market' ? this.limitPrice() : undefined
    );
  }

  private drawChart() {
    if (!this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    const stock = this.selectedStock();
    if (!stock || !stock.sparklineData || stock.sparklineData.length === 0) return;

    const data = stock.sparklineData;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let i = 1; i <= 4; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Chart Gradient Fill
    const isGain = stock.change >= 0;
    const strokeColor = isGain ? '#22d97f' : '#f04864';
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, isGain ? 'rgba(34, 217, 127, 0.25)' : 'rgba(240, 72, 100, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    const points: { x: number; y: number }[] = [];

    data.forEach((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 40) - 20;
      points.push({ x, y });
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Fill Area
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw Line
    ctx.beginPath();
    points.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}
