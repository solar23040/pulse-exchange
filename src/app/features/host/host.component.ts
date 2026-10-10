import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketService } from '../../core/services/market.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { Sector, SECTOR_LABELS } from '../../core/models';

@Component({
  selector: 'app-host-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="host-container">
      @if (!isAuthenticated()) {
        <!-- Password Auth Modal -->
        <div class="auth-modal glass-strong">
          <div class="auth-header">
            <span class="host-badge">🛡️ HOST ACCESS CONTROL</span>
            <h3>Enter Host Password</h3>
            <p>Authorized access only for session orchestrators.</p>
          </div>

          <form (ngSubmit)="onAuthHost()" class="auth-form">
            <input
              type="password"
              [(ngModel)]="hostPassword"
              name="hostPassword"
              placeholder="Enter host password..."
              required
              class="form-input"
            />
            <button type="submit" class="auth-btn">VERIFY ACCESS &rarr;</button>
          </form>
        </div>
      } @else {
        <!-- Host Dashboard Controls -->
        <div class="dashboard-grid">
          <!-- Market Controls & Macro Triggers -->
          <div class="control-card glass">
            <h3 class="card-title">⚡ MACRO MARKET TRIGGERS</h3>

            <div class="macro-buttons">
              <button class="macro-btn bull" (click)="onBullRun()">
                🚀 TRIGGER BULL RUN (+8%)
              </button>
              <button class="macro-btn swan" (click)="onBlackSwan()">
                📉 TRIGGER BLACK SWAN (-15%)
              </button>
            </div>

            <div class="toggle-group">
              <button
                class="state-btn"
                [class.active]="marketService.sessionState()?.status === 'paused'"
                (click)="onTogglePause()"
              >
                {{ marketService.sessionState()?.status === 'paused' ? '▶ RESUME TRADING' : '⏸ PAUSE TRADING' }}
              </button>
              <button class="reset-btn" (click)="onResetSession()">
                🔄 RESET MARKET SESSION
              </button>
            </div>

            <div class="speed-selector">
              <label>SIMULATION SPEED:</label>
              <div class="speed-btns">
                @for (s of [1, 2, 5, 10]; track s) {
                  <button
                    class="spd-btn"
                    [class.active]="(marketService.sessionState()?.simSpeed || 1) === s"
                    (click)="onSetSpeed(s)"
                  >
                    {{ s }}x
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Stock Price Manipulation & Shock -->
          <div class="control-card glass">
            <h3 class="card-title">🎯 STOCK PRICE SHOCK & SET</h3>

            <div class="control-form">
              <div class="form-group">
                <label>Target Stock Ticker</label>
                <select [(ngModel)]="shockTicker" name="shockTicker" class="form-select">
                  @for (stock of marketService.stocksList(); track stock.ticker) {
                    <option [value]="stock.ticker">{{ stock.ticker }} — Current ₹{{ stock.price }}</option>
                  }
                </select>
              </div>

              <div class="btn-row">
                <button class="shock-btn plus" (click)="onShockStock(20)">+20% Shock</button>
                <button class="shock-btn minus" (click)="onShockStock(-20)">-20% Shock</button>
              </div>

              <div class="set-price-row">
                <input
                  type="number"
                  [(ngModel)]="manualPrice"
                  name="manualPrice"
                  placeholder="Set exact price ₹"
                  class="form-input"
                />
                <button class="set-btn" (click)="onSetExactPrice()">Set Price</button>
              </div>
            </div>
          </div>

          <!-- Sector Shock Controls -->
          <div class="control-card glass">
            <h3 class="card-title">🏭 SECTOR WIDE SHOCK</h3>

            <div class="control-form">
              <div class="form-group">
                <label>Select Sector</label>
                <select [(ngModel)]="shockSector" name="shockSector" class="form-select">
                  @for (sec of sectors; track sec) {
                    <option [value]="sec">{{ sectorLabels[sec] }} ({{ sec }})</option>
                  }
                </select>
              </div>

              <div class="btn-row">
                <button class="shock-btn plus" (click)="onShockSector(15)">+15% Sector Pump</button>
                <button class="shock-btn minus" (click)="onShockSector(-15)">-15% Sector Dump</button>
              </div>
            </div>
          </div>

          <!-- Broadcast Host Announcement -->
          <div class="control-card glass full-width">
            <h3 class="card-title">📢 BROADCAST FLOOR ANNOUNCEMENT</h3>

            <form (ngSubmit)="onBroadcastNews()" class="broadcast-form">
              <div class="form-row">
                <input
                  type="text"
                  [(ngModel)]="newsTitle"
                  name="newsTitle"
                  placeholder="Announcement Title..."
                  required
                  class="form-input"
                />
                <select [(ngModel)]="newsSentiment" name="newsSentiment" class="form-select">
                  <option value="bullish">Bullish 🚀</option>
                  <option value="bearish">Bearish 🔻</option>
                  <option value="urgent">Urgent ⚡</option>
                  <option value="neutral">Neutral 📢</option>
                </select>
              </div>

              <textarea
                [(ngModel)]="newsBody"
                name="newsBody"
                placeholder="Write announcement body message..."
                required
                rows="2"
                class="form-input text-area"
              ></textarea>

              <button type="submit" class="broadcast-btn">BROADCAST TO ALL TRADERS &rarr;</button>
            </form>
          </div>
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
      color: #e8ebf2;
      font-family: 'Inter', system-ui, sans-serif;
      overflow-y: auto;
    }

    .host-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      max-width: 1400px;
      margin: 0 auto;
    }

    .auth-modal {
      width: 100%;
      max-width: 400px;
      padding: 32px;
      border-radius: 16px;
      background: rgba(17, 19, 26, 0.9);
      border: 1px solid rgba(124, 91, 240, 0.3);
      text-align: center;

      .host-badge {
        font-size: 0.75rem;
        font-weight: 800;
        color: #7c5bf0;
        letter-spacing: 0.1em;
      }

      h3 { margin: 8px 0 4px 0; font-size: 1.4rem; }
      p { font-size: 0.85rem; color: #8b92a8; margin: 0 0 20px 0; }
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-input {
      padding: 12px;
      border-radius: 10px;
      background: rgba(10, 11, 16, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 0.95rem;
      outline: none;

      &:focus { border-color: #7c5bf0; }
    }

    .auth-btn {
      padding: 14px;
      border-radius: 10px;
      background: #7c5bf0;
      color: #fff;
      border: none;
      font-weight: 800;
      cursor: pointer;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      width: 100%;
    }

    .control-card {
      padding: 24px;
      border-radius: 14px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 16px;

      &.full-width { grid-column: 1 / -1; }
    }

    .card-title {
      font-size: 0.9rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #c4c9d8;
      margin: 0;
    }

    .macro-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .macro-btn {
      padding: 14px;
      border-radius: 10px;
      border: none;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;

      &.bull { background: rgba(34, 217, 127, 0.15); color: #22d97f; border: 1px solid #22d97f; }
      &.swan { background: rgba(240, 72, 100, 0.15); color: #f04864; border: 1px solid #f04864; }
    }

    .toggle-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .state-btn, .reset-btn {
      padding: 10px;
      border-radius: 8px;
      border: none;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
    }

    .state-btn { background: rgba(245, 166, 35, 0.15); color: #f5a623; }
    .reset-btn { background: rgba(255, 255, 255, 0.08); color: #c4c9d8; }

    .speed-selector {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 700;
      color: #8b92a8;
    }

    .speed-btns {
      display: flex;
      gap: 4px;
    }

    .spd-btn {
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: none;
      color: #8b92a8;
      cursor: pointer;

      &.active { background: #7c5bf0; color: #fff; }
    }

    .control-form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label { font-size: 0.78rem; font-weight: 700; color: #8b92a8; }
    }

    .form-select {
      padding: 10px;
      border-radius: 8px;
      background: rgba(10, 11, 16, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 0.9rem;
      outline: none;
    }

    .btn-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .shock-btn {
      padding: 10px;
      border-radius: 8px;
      border: none;
      font-weight: 800;
      font-size: 0.8rem;
      cursor: pointer;

      &.plus { background: #22d97f; color: #0a0b10; }
      &.minus { background: #f04864; color: #fff; }
    }

    .set-price-row {
      display: grid;
      grid-template-columns: 1fr 100px;
      gap: 8px;
    }

    .set-btn {
      padding: 10px;
      border-radius: 8px;
      background: #7c5bf0;
      color: #fff;
      border: none;
      font-weight: 700;
      cursor: pointer;
    }

    .broadcast-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 160px;
      gap: 12px;
    }

    .text-area { resize: vertical; }

    .broadcast-btn {
      padding: 12px;
      border-radius: 10px;
      background: #7c5bf0;
      color: #fff;
      border: none;
      font-weight: 800;
      cursor: pointer;
      align-self: flex-end;
    }
  `]
})
export class HostConsoleComponent {
  public marketService = inject(MarketService);
  public wsService = inject(WebSocketService);

  public hostPassword = signal('pulseadmin');
  public isAuthenticated = signal(true); // Default true for local demo mode

  public shockTicker = signal('NXON');
  public manualPrice = signal<number>(4500);
  public shockSector = signal<Sector>('TECH');

  public newsTitle = signal('');
  public newsBody = signal('');
  public newsSentiment = signal<'bullish' | 'bearish' | 'urgent' | 'neutral'>('bullish');

  public sectors: Sector[] = ['TECH', 'PHARMA', 'BANK', 'ENERGY', 'CONSUMER', 'INFRA'];
  public sectorLabels = SECTOR_LABELS;

  public onAuthHost() {
    if (this.hostPassword().trim()) {
      this.isAuthenticated.set(true);
    }
  }

  public onBullRun() {
    this.marketService.sendHostAction({ action: 'bull-run' }, this.hostPassword());
  }

  public onBlackSwan() {
    this.marketService.sendHostAction({ action: 'black-swan' }, this.hostPassword());
  }

  public onTogglePause() {
    const isPaused = this.marketService.sessionState()?.status === 'paused';
    this.marketService.sendHostAction({ action: isPaused ? 'resume' : 'pause' }, this.hostPassword());
  }

  public onResetSession() {
    this.marketService.sendHostAction({ action: 'reset' }, this.hostPassword());
  }

  public onSetSpeed(speed: number) {
    this.marketService.sendHostAction({ action: 'set-speed', speed }, this.hostPassword());
  }

  public onShockStock(percent: number) {
    this.marketService.sendHostAction({ action: 'shock-stock', ticker: this.shockTicker(), percent }, this.hostPassword());
  }

  public onSetExactPrice() {
    if (this.manualPrice() <= 0) return;
    this.marketService.sendHostAction({ action: 'set-price', ticker: this.shockTicker(), price: this.manualPrice() }, this.hostPassword());
  }

  public onShockSector(percent: number) {
    this.marketService.sendHostAction({ action: 'shock-sector', sector: this.shockSector(), percent }, this.hostPassword());
  }

  public onBroadcastNews() {
    if (!this.newsTitle().trim() || !this.newsBody().trim()) return;

    this.wsService.send({
      type: 'BROADCAST',
      payload: {
        title: this.newsTitle().trim(),
        body: this.newsBody().trim(),
        sentiment: this.newsSentiment()
      }
    });

    this.newsTitle.set('');
    this.newsBody.set('');
  }
}
