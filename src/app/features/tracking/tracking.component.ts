import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketService } from '../../core/services/market.service';
import { AlertType } from '../../core/models';

@Component({
  selector: 'app-alerts-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tracking-container">
      <!-- Create Alert Form Panel -->
      <div class="form-panel glass">
        <h3 class="panel-title">⚡ CREATE PRICE ALERT</h3>
        <p class="panel-subtitle">Get instant notifications and audio cues when a stock hits your threshold.</p>

        <form (ngSubmit)="onCreateAlert()" class="alert-form">
          <div class="form-row">
            <div class="form-group">
              <label>Select Stock</label>
              <select
                [ngModel]="selectedTicker()"
                (ngModelChange)="selectedTicker.set($event)"
                name="selectedTicker"
                class="form-select"
              >
                @for (stock of marketService.stocksList(); track stock.ticker) {
                  <option [value]="stock.ticker">{{ stock.ticker }} — ₹{{ stock.price }}</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label>Alert Type</label>
              <div class="type-toggle">
                <button
                  type="button"
                  class="t-btn tp"
                  [class.active]="alertType() === 'take-profit'"
                  (click)="alertType.set('take-profit')"
                >
                  TAKE-PROFIT
                </button>
                <button
                  type="button"
                  class="t-btn sl"
                  [class.active]="alertType() === 'stop-loss'"
                  (click)="alertType.set('stop-loss')"
                >
                  STOP-LOSS
                </button>
              </div>
            </div>

            <div class="form-group">
              <label>Target Price (₹)</label>
              <input
                type="number"
                [(ngModel)]="targetPrice"
                name="targetPrice"
                step="0.1"
                min="1"
                required
                class="form-input"
              />
            </div>
          </div>

          <button type="submit" class="create-btn" [disabled]="!targetPrice() || targetPrice() <= 0">
            + SET ALERT TRIGGER
          </button>
        </form>
      </div>

      <!-- Active Alerts List -->
      <div class="list-panel glass">
        <h3 class="panel-title">ACTIVE PRICE WATCHLIST & ALERTS ({{ alerts().length }})</h3>

        @if (alerts().length > 0) {
          <div class="alerts-grid">
            @for (alert of alerts(); track alert.id) {
              <div class="alert-card" [class.triggered]="alert.status === 'triggered'">
                <div class="card-top">
                  <span class="ticker">{{ alert.ticker }}</span>
                  <span class="type-badge" [class.tp]="alert.type === 'take-profit'" [class.sl]="alert.type === 'stop-loss'">
                    {{ alert.type === 'take-profit' ? 'TAKE PROFIT' : 'STOP LOSS' }}
                  </span>
                </div>

                <div class="card-mid">
                  <div class="price-info">
                    <span class="lbl">Target Price:</span>
                    <strong class="val">₹{{ alert.targetPrice }}</strong>
                  </div>
                  <div class="price-info">
                    <span class="lbl">Current Price:</span>
                    <span class="val">₹{{ getStockPrice(alert.ticker) }}</span>
                  </div>
                </div>

                <div class="card-bot">
                  <span class="status-lbl" [class.trig]="alert.status === 'triggered'">
                    STATUS: {{ alert.status.toUpperCase() }}
                  </span>
                  @if (alert.status === 'active') {
                    <button class="btn-cancel" (click)="onCancelAlert(alert.id)">Cancel</button>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-alerts">
            <div class="empty-icon">🔔</div>
            <div class="empty-text">No active price alerts set. Use the form above to track key breakouts.</div>
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

    .tracking-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .form-panel, .list-panel {
      padding: 24px;
      border-radius: 14px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .panel-title {
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      margin: 0 0 4px 0;
    }

    .panel-subtitle {
      font-size: 0.82rem;
      color: #8b92a8;
      margin: 0 0 20px 0;
    }

    .alert-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #8b92a8;
      }
    }

    .form-select, .form-input {
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(10, 11, 16, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 0.95rem;
      outline: none;

      &:focus { border-color: #7c5bf0; }
    }

    .type-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      background: rgba(10, 11, 16, 0.6);
      padding: 4px;
      border-radius: 8px;
    }

    .t-btn {
      padding: 8px;
      border-radius: 6px;
      border: none;
      font-size: 0.72rem;
      font-weight: 800;
      cursor: pointer;
      color: #8b92a8;
      background: transparent;

      &.tp.active { background: #22d97f; color: #0a0b10; }
      &.sl.active { background: #f04864; color: #fff; }
    }

    .create-btn {
      padding: 12px;
      border-radius: 8px;
      background: #7c5bf0;
      color: #fff;
      border: none;
      font-weight: 800;
      font-size: 0.9rem;
      cursor: pointer;
      align-self: flex-start;

      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }

    .alerts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .alert-card {
      background: rgba(10, 11, 16, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      &.triggered {
        border-color: #f5a623;
        background: rgba(245, 166, 35, 0.1);
      }
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticker { font-size: 1.1rem; font-weight: 800; }

    .type-badge {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;

      &.tp { background: rgba(34, 217, 127, 0.15); color: #22d97f; }
      &.sl { background: rgba(240, 72, 100, 0.15); color: #f04864; }
    }

    .card-mid {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
    }

    .price-info {
      display: flex;
      flex-direction: column;
      .lbl { font-size: 0.7rem; color: #8b92a8; }
      .val { font-weight: 700; }
    }

    .card-bot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }

    .status-lbl {
      font-size: 0.72rem;
      font-weight: 700;
      color: #8b92a8;
      &.trig { color: #f5a623; }
    }

    .btn-cancel {
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(240, 72, 100, 0.15);
      color: #f04864;
      border: none;
      font-size: 0.7rem;
      font-weight: 700;
      cursor: pointer;
    }

    .empty-alerts {
      text-align: center;
      padding: 40px 20px;
      color: #8b92a8;
      .empty-icon { font-size: 2.5rem; margin-bottom: 8px; }
    }
  `]
})
export class TrackingComponent {
  public marketService = inject(MarketService);

  public selectedTicker = signal<string>('NXON');
  public alertType = signal<AlertType>('take-profit');
  public targetPrice = signal<number>(4500);

  public alerts = computed(() => this.marketService.activeAlerts());

  public getStockPrice(ticker: string): number {
    const stock = this.marketService.stocksMap().get(ticker);
    return stock ? stock.price : 0;
  }

  public onCreateAlert() {
    if (!this.targetPrice() || this.targetPrice() <= 0) return;
    this.marketService.createAlert(
      this.selectedTicker(),
      this.alertType(),
      this.targetPrice()
    );
  }

  public onCancelAlert(alertId: string) {
    this.marketService.cancelAlert(alertId);
  }
}
