import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MarketService } from '../../core/services/market.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="portfolio-container">
      <!-- Executive Summary Cards -->
      <div class="summary-cards">
        <div class="card glass">
          <span class="card-label">TOTAL PORTFOLIO VALUE</span>
          <span class="card-value">
            ₹{{ (portfolio()?.totalValue || 0).toLocaleString('en-IN') }}
          </span>
          <span class="card-sub">Cash + Position Valuation</span>
        </div>

        <div class="card glass">
          <span class="card-label">CASH BALANCE</span>
          <span class="card-value neutral">
            ₹{{ (portfolio()?.cash || 0).toLocaleString('en-IN') }}
          </span>
          <span class="card-sub">Available Buying Power</span>
        </div>

        <div class="card glass">
          <span class="card-label">UNREALIZED P&L</span>
          <span class="card-value" [class.gain]="(portfolio()?.unrealizedPnl || 0) >= 0" [class.loss]="(portfolio()?.unrealizedPnl || 0) < 0">
            {{ (portfolio()?.unrealizedPnl || 0) >= 0 ? '+' : '' }}₹{{ (portfolio()?.unrealizedPnl || 0).toLocaleString('en-IN') }}
          </span>
          <span class="card-sub">Open Positions P&L</span>
        </div>

        <div class="card glass">
          <span class="card-label">TOTAL RETURN %</span>
          <span class="card-value" [class.gain]="returnPercent() >= 0" [class.loss]="returnPercent() < 0">
            {{ returnPercent() >= 0 ? '+' : '' }}{{ returnPercent().toFixed(2) }}%
          </span>
          <span class="card-sub">Vs Initial Capital</span>
        </div>
      </div>

      <!-- Sector Allocation Section -->
      @if (sectorAllocations().length > 0) {
        <div class="sector-section glass">
          <div class="section-title">SECTOR ALLOCATION BREAKDOWN</div>
          <div class="sector-bars">
            @for (item of sectorAllocations(); track item.sector) {
              <div class="sector-bar-item">
                <div class="s-info">
                  <span>{{ item.sector }}</span>
                  <strong>{{ item.percent.toFixed(1) }}%</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" [style.width.%]="item.percent"></div>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Open Positions Table -->
      <div class="positions-section glass">
        <div class="section-title">OPEN POSITIONS ({{ positions().length }})</div>

        @if (positions().length > 0) {
          <div class="table-wrapper">
            <table class="positions-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Quantity</th>
                  <th>Avg Price</th>
                  <th>Current Price</th>
                  <th>Position Value</th>
                  <th>Unrealized P&L</th>
                  <th>Allocation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (pos of positions(); track pos.ticker) {
                  <tr>
                    <td class="ticker-cell">
                      <span class="t-name">{{ pos.ticker }}</span>
                    </td>
                    <td>{{ pos.quantity }}</td>
                    <td>₹{{ pos.avgPrice.toLocaleString('en-IN') }}</td>
                    <td>₹{{ pos.currentPrice.toLocaleString('en-IN') }}</td>
                    <td class="value-cell">₹{{ pos.value.toLocaleString('en-IN') }}</td>
                    <td class="pnl-cell" [class.gain]="pos.pnl >= 0" [class.loss]="pos.pnl < 0">
                      {{ pos.pnl >= 0 ? '+' : '' }}₹{{ pos.pnl.toLocaleString('en-IN') }}
                      <span class="pnl-pct">({{ pos.pnlPercent }}%)</span>
                    </td>
                    <td>
                      <div class="alloc-bar">
                        <div class="alloc-fill" [style.width.%]="pos.allocation"></div>
                        <span class="alloc-lbl">{{ pos.allocation }}%</span>
                      </div>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-trade" (click)="onTrade(pos.ticker)">Trade</button>
                      <button class="btn-close" (click)="onClosePosition(pos)">Close</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-positions">
            <div class="empty-icon">💼</div>
            <div class="empty-text">No active stock positions. Visit Market Watch to execute your first trade.</div>
            <button class="btn-explore" (click)="onExploreMarket()">Go to Market Watch &rarr;</button>
          </div>
        }
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
      overflow-y: auto;
    }

    .portfolio-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .card {
      padding: 18px 22px;
      border-radius: 14px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .card-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #8b92a8;
    }

    .card-value {
      font-size: 1.5rem;
      font-weight: 800;

      &.gain { color: #22d97f; }
      &.loss { color: #f04864; }
      &.neutral { color: #38bdf8; }
    }

    .card-sub {
      font-size: 0.75rem;
      color: #5a6178;
    }

    .sector-section, .positions-section {
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 20px;
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #c4c9d8;
      margin-bottom: 16px;
    }

    .sector-bars {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }

    .sector-bar-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .s-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.78rem;
      color: #8b92a8;

      strong { color: #fff; }
    }

    .progress-track {
      height: 6px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.06);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #7c5bf0, #0ea5e9);
      border-radius: 9999px;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .positions-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;

      th {
        padding: 12px;
        background: rgba(10, 11, 16, 0.9);
        color: #8b92a8;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      td {
        padding: 14px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      tr:hover td {
        background: rgba(255, 255, 255, 0.03);
      }

      .ticker-cell { font-weight: 800; color: #fff; }
      .value-cell { font-weight: 700; }
      .pnl-cell {
        font-weight: 700;
        &.gain { color: #22d97f; }
        &.loss { color: #f04864; }
      }

      .pnl-pct { font-size: 0.75rem; margin-left: 4px; }
    }

    .alloc-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .alloc-fill {
      height: 6px;
      background: #7c5bf0;
      border-radius: 9999px;
      min-width: 4px;
    }

    .alloc-lbl {
      font-size: 0.75rem;
      color: #8b92a8;
    }

    .actions-cell {
      display: flex;
      gap: 6px;
    }

    .btn-trade, .btn-close {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
    }

    .btn-trade {
      background: #7c5bf0;
      color: #fff;
    }

    .btn-close {
      background: rgba(240, 72, 100, 0.15);
      color: #f04864;
    }

    .empty-positions {
      text-align: center;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .empty-icon { font-size: 3rem; }

    .empty-text {
      color: #8b92a8;
      font-size: 0.95rem;
    }

    .btn-explore {
      padding: 10px 20px;
      border-radius: 10px;
      background: #7c5bf0;
      color: #fff;
      border: none;
      font-weight: 700;
      cursor: pointer;
      margin-top: 8px;
    }
  `]
})
export class PortfolioComponent {
  public marketService = inject(MarketService);
  public sessionService = inject(SessionService);
  private router = inject(Router);

  public portfolio = computed(() => this.marketService.portfolio());
  public positions = computed(() => this.portfolio()?.positions || []);

  public returnPercent = computed(() => {
    const player = this.sessionService.player();
    if (!player || !player.initialCash) return 0;
    const totalVal = this.portfolio()?.totalValue || player.initialCash;
    return ((totalVal - player.initialCash) / player.initialCash) * 100;
  });

  public sectorAllocations = computed(() => {
    const posList = this.positions();
    const map = new Map<string, number>();

    for (const pos of posList) {
      const stock = this.marketService.stocksMap().get(pos.ticker);
      const sector = stock ? stock.sector : 'OTHER';
      const existing = map.get(sector) || 0;
      map.set(sector, existing + pos.value);
    }

    const totalVal = this.portfolio()?.totalValue || 1;
    return Array.from(map.entries()).map(([sector, val]) => ({
      sector,
      percent: (val / totalVal) * 100
    }));
  });

  public onTrade(ticker: string) {
    this.marketService.selectStock(ticker);
    this.router.navigate(['/terminal']);
  }

  public onClosePosition(pos: any) {
    this.marketService.placeOrder(pos.ticker, 'sell', 'market', pos.quantity);
  }

  public onExploreMarket() {
    this.router.navigate(['/market']);
  }
}
