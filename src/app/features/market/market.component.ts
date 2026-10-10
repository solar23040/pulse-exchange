import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarketService, EnrichedCompany } from '../../core/services/market.service';
import { SECTOR_LABELS, Sector } from '../../core/models';

@Component({
  selector: 'app-market-watch',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="market-container">
      <!-- Top Bar: Search & Sector Filters -->
      <div class="filter-bar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search stock ticker, company name..."
            [(ngModel)]="searchQuery"
            class="search-input"
          />
        </div>

        <div class="sector-pills">
          <button
            class="sector-pill"
            [class.active]="selectedSector() === 'ALL'"
            (click)="selectedSector.set('ALL')"
          >
            All (24)
          </button>
          @for (sec of sectorKeys; track sec) {
            <button
              class="sector-pill"
              [class.active]="selectedSector() === sec"
              (click)="selectedSector.set(sec)"
            >
              {{ sectorLabels[sec] }}
            </button>
          }
        </div>

        <div class="view-toggle">
          <button
            class="toggle-btn"
            [class.active]="viewMode() === 'grid'"
            (click)="viewMode.set('grid')"
            title="Grid View"
          >
            ▦
          </button>
          <button
            class="toggle-btn"
            [class.active]="viewMode() === 'table'"
            (click)="viewMode.set('table')"
            title="Table View"
          >
            ☰
          </button>
        </div>
      </div>

      <!-- Market Stats Strip -->
      <div class="market-stats">
        <div class="stat-card">
          <span class="stat-label">PX-24 INDEX</span>
          <span class="stat-val" [class.gain]="marketService.px24Index() >= 100" [class.loss]="marketService.px24Index() < 100">
            {{ marketService.px24Index().toFixed(2) }}
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">MARKET MOOD</span>
          <span class="stat-val neutral">
            {{ marketService.marketMood() }} / 100
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">TOP GAINER</span>
          <span class="stat-val gain">
            {{ marketService.topGainers()[0]?.ticker }} +{{ marketService.topGainers()[0]?.changePercent }}%
          </span>
        </div>
        <div class="stat-card">
          <span class="stat-label">TOP LOSER</span>
          <span class="stat-val loss">
            {{ marketService.topLosers()[0]?.ticker }} {{ marketService.topLosers()[0]?.changePercent }}%
          </span>
        </div>
      </div>

      <!-- Main Content Grid / Table -->
      @if (viewMode() === 'grid') {
        <div class="stocks-grid">
          @for (stock of filteredStocks(); track stock.ticker) {
            <div class="stock-card glass" (click)="onSelectStock(stock.ticker)">
              <div class="card-header">
                <div class="ticker-badge">
                  <span class="ticker">{{ stock.ticker }}</span>
                  <span class="sector-badge">{{ stock.sector }}</span>
                </div>
                <div class="price-block">
                  <div class="price">₹{{ stock.price.toLocaleString('en-IN') }}</div>
                  <div class="change-pill" [class.gain]="stock.change >= 0" [class.loss]="stock.change < 0">
                    {{ stock.change >= 0 ? '+' : '' }}{{ stock.changePercent }}%
                  </div>
                </div>
              </div>

              <div class="company-name">{{ stock.name }}</div>

              <!-- Sparkline SVG -->
              <div class="sparkline-container">
                <svg class="sparkline-svg" viewBox="0 0 100 30" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    [attr.stroke]="stock.change >= 0 ? '#22d97f' : '#f04864'"
                    stroke-width="2"
                    [attr.points]="getSparklinePoints(stock.sparklineData)"
                  />
                </svg>
              </div>

              <div class="card-footer">
                <div class="volume">Vol: {{ (stock.volume / 1000).toFixed(1) }}k</div>
                <div class="actions">
                  <button class="action-btn trade" (click)="onTrade($event, stock.ticker)">TRADE</button>
                  <button class="action-btn track" (click)="onTrack($event, stock.ticker)">ALERT</button>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="table-container glass">
          <table class="stocks-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company Name</th>
                <th>Sector</th>
                <th>Price (₹)</th>
                <th>24h Change</th>
                <th>Volume</th>
                <th>High</th>
                <th>Low</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (stock of filteredStocks(); track stock.ticker) {
                <tr (click)="onSelectStock(stock.ticker)">
                  <td class="ticker-col">{{ stock.ticker }}</td>
                  <td class="name-col">{{ stock.name }}</td>
                  <td><span class="sector-badge">{{ stock.sector }}</span></td>
                  <td class="price-col">₹{{ stock.price.toLocaleString('en-IN') }}</td>
                  <td class="change-col" [class.gain]="stock.change >= 0" [class.loss]="stock.change < 0">
                    {{ stock.change >= 0 ? '+' : '' }}{{ stock.changePercent }}%
                  </td>
                  <td>{{ stock.volume.toLocaleString('en-IN') }}</td>
                  <td>₹{{ stock.high.toLocaleString('en-IN') }}</td>
                  <td>₹{{ stock.low.toLocaleString('en-IN') }}</td>
                  <td>
                    <button class="action-btn trade sm" (click)="onTrade($event, stock.ticker)">Trade</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
      overflow-y: auto;
      color: #e8ebf2;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .market-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      width: 300px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.85rem;
      opacity: 0.6;
    }

    .search-input {
      width: 100%;
      padding: 10px 12px 10px 36px;
      border-radius: 10px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 0.875rem;
      outline: none;

      &:focus {
        border-color: #7c5bf0;
      }
    }

    .sector-pills {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
    }

    .sector-pill {
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #8b92a8;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;

      &:hover { background: rgba(255, 255, 255, 0.08); }

      &.active {
        background: #7c5bf0;
        border-color: #7c5bf0;
        color: #ffffff;
      }
    }

    .view-toggle {
      display: flex;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 2px;
    }

    .toggle-btn {
      padding: 6px 12px;
      background: transparent;
      border: none;
      color: #8b92a8;
      cursor: pointer;
      border-radius: 6px;
      font-size: 0.9rem;

      &.active {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }

    .market-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: rgba(17, 19, 26, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #8b92a8;
    }

    .stat-val {
      font-size: 1.15rem;
      font-weight: 800;

      &.gain { color: #22d97f; }
      &.loss { color: #f04864; }
      &.neutral { color: #38bdf8; }
    }

    .stocks-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .stock-card {
      background: rgba(17, 19, 26, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.2s ease;

      &:hover {
        border-color: rgba(124, 91, 240, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .ticker {
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .sector-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      color: #8b92a8;
      margin-left: 6px;
    }

    .price-block {
      text-align: right;
    }

    .price {
      font-size: 1.15rem;
      font-weight: 800;
    }

    .change-pill {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      margin-top: 2px;

      &.gain { background: rgba(34, 217, 127, 0.15); color: #22d97f; }
      &.loss { background: rgba(240, 72, 100, 0.15); color: #f04864; }
    }

    .company-name {
      font-size: 0.85rem;
      color: #c4c9d8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sparkline-container {
      height: 36px;
      width: 100%;
    }

    .sparkline-svg {
      width: 100%;
      height: 100%;
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .volume {
      font-size: 0.75rem;
      color: #5a6178;
    }

    .actions {
      display: flex;
      gap: 6px;
    }

    .action-btn {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;

      &.trade {
        background: #7c5bf0;
        color: #fff;
        &:hover { background: #6344d0; }
      }

      &.track {
        background: rgba(255, 255, 255, 0.08);
        color: #c4c9d8;
        &:hover { background: rgba(255, 255, 255, 0.15); }
      }

      &.sm { padding: 4px 8px; font-size: 0.7rem; }
    }

    .table-container {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .stocks-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;

      th {
        padding: 12px 16px;
        background: rgba(10, 11, 16, 0.9);
        color: #8b92a8;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      tr:hover td {
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
      }

      .ticker-col { font-weight: 800; color: #fff; }
      .name-col { color: #c4c9d8; }
      .price-col { font-weight: 700; }
      .change-col {
        font-weight: 700;
        &.gain { color: #22d97f; }
        &.loss { color: #f04864; }
      }
    }
  `]
})
export class MarketWatchComponent {
  public marketService = inject(MarketService);
  private router = inject(Router);

  public searchQuery = signal('');
  public selectedSector = signal<string>('ALL');
  public viewMode = signal<'grid' | 'table'>('grid');

  public sectorKeys: Sector[] = ['TECH', 'PHARMA', 'BANK', 'ENERGY', 'CONSUMER', 'INFRA'];
  public sectorLabels = SECTOR_LABELS;

  public filteredStocks = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const sector = this.selectedSector();
    const all = this.marketService.stocksList();

    return all.filter(s => {
      const matchesSearch = !query || s.ticker.toLowerCase().includes(query) || s.name.toLowerCase().includes(query);
      const matchesSector = sector === 'ALL' || s.sector === sector;
      return matchesSearch && matchesSector;
    });
  });

  public onSelectStock(ticker: string) {
    this.marketService.selectStock(ticker);
  }

  public onTrade(event: Event, ticker: string) {
    event.stopPropagation();
    this.marketService.selectStock(ticker);
    this.router.navigate(['/terminal']);
  }

  public onTrack(event: Event, ticker: string) {
    event.stopPropagation();
    this.marketService.selectStock(ticker);
    this.router.navigate(['/tracking']);
  }

  public getSparklinePoints(data: number[]): string {
    if (!data || data.length === 0) return '0,15 100,15';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    return data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = 30 - ((val - min) / range) * 26 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
