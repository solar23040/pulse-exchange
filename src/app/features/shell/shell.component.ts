import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MarketService } from '../../core/services/market.service';
import { SessionService } from '../../core/services/session.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AudioService } from '../../core/services/audio.service';

@Component({
  selector: 'app-workstation-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell-layout">
      <!-- Top Indices Scrolling Strip -->
      <div class="top-indices-strip">
        <div class="index-item master">
          <span class="idx-name">PX-24 INDEX</span>
          <span class="idx-val" [class.gain]="marketService.px24Index() >= 100" [class.loss]="marketService.px24Index() < 100">
            {{ marketService.px24Index().toFixed(2) }}
          </span>
        </div>

        @for (idx of marketService.sectorIndices(); track idx.sector) {
          <div class="index-item">
            <span class="idx-name">{{ idx.name }}</span>
            <span class="idx-val" [class.gain]="idx.change >= 0" [class.loss]="idx.change < 0">
              {{ idx.value.toFixed(1) }} ({{ idx.change >= 0 ? '+' : '' }}{{ idx.changePercent }}%)
            </span>
          </div>
        }

        <div class="top-right-bar">
          <!-- Audio Toggle Button -->
          <button class="icon-btn" (click)="audioService.toggle()" [title]="audioService.enabled() ? 'Mute Audio' : 'Unmute Audio'">
            {{ audioService.enabled() ? '🔔' : '🔕' }}
          </button>

          <!-- Connection Status Pulse -->
          <div class="connection-status" [ngClass]="wsService.connectionStatus()">
            <span class="pulse-dot"></span>
            <span class="status-lbl">{{ wsService.connectionStatus().toUpperCase() }}</span>
          </div>

          <!-- Trader Profile Summary -->
          @if (sessionService.player(); as player) {
            <div class="trader-pill">
              <span class="role-badge" [class.bank]="player.role === 'bank'">
                {{ player.role === 'bank' ? 'INSTITUTION' : 'RETAIL' }}
              </span>
              <span class="trader-name">{{ player.name }}</span>
              <div class="trader-balance">
                <span class="cash-lbl">VAL:</span>
                <span class="cash-val">₹{{ (marketService.portfolio()?.totalValue || player.cash).toLocaleString('en-IN') }}</span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Main Shell Body: Left Nav Rail + Router Content -->
      <div class="shell-body">
        <!-- Left Navigation Rail -->
        <nav class="nav-rail">
          <div class="rail-logo" title="PULSE EXCHANGE">
            <span class="logo-symbol">⚡</span>
          </div>

          <div class="rail-links">
            <a routerLink="/market" routerLinkActive="active" class="rail-link" title="Market Watch">
              <span class="link-icon">📊</span>
              <span class="link-label">Market</span>
            </a>

            <a routerLink="/terminal" routerLinkActive="active" class="rail-link" title="Trading Terminal">
              <span class="link-icon">📈</span>
              <span class="link-label">Terminal</span>
            </a>

            <a routerLink="/portfolio" routerLinkActive="active" class="rail-link" title="Portfolio">
              <span class="link-icon">💼</span>
              <span class="link-label">Portfolio</span>
            </a>

            <a routerLink="/leaderboard" routerLinkActive="active" class="rail-link" title="Leaderboard">
              <span class="link-icon">🏆</span>
              <span class="link-label">Ranks</span>
            </a>

            <a routerLink="/tracking" routerLinkActive="active" class="rail-link" title="Alerts & Tracking">
              <span class="link-icon">🔔</span>
              <span class="link-label">Alerts</span>
            </a>

            <a routerLink="/news" routerLinkActive="active" class="rail-link" title="News Wire">
              <span class="link-icon">📡</span>
              <span class="link-label">News</span>
            </a>

            <a routerLink="/host" routerLinkActive="active" class="rail-link host-link" title="Host Console">
              <span class="link-icon">🛡️</span>
              <span class="link-label">Host</span>
            </a>
          </div>

          <button class="logout-btn" (click)="onLogout()" title="Exit Trading Floor">
            🚪
          </button>
        </nav>

        <!-- Main View Router Content -->
        <main class="main-viewport">
          <router-outlet />
        </main>
      </div>

      <!-- Bottom Status Bar -->
      <footer class="status-bar">
        <div class="sb-item">
          <span class="sb-lbl">MARKET STATUS:</span>
          <span class="sb-val" [class.paused]="marketService.sessionState()?.status === 'paused'">
            {{ (marketService.sessionState()?.status || 'ACTIVE').toUpperCase() }}
          </span>
        </div>

        <div class="sb-item">
          <span class="sb-lbl">SIM SPEED:</span>
          <span class="sb-val">{{ marketService.sessionState()?.simSpeed || 1 }}x</span>
        </div>

        <div class="sb-item">
          <span class="sb-lbl">MARKET MOOD:</span>
          <span class="sb-val mood">
            {{ marketService.marketMood() >= 60 ? 'GREED 🚀' : marketService.marketMood() <= 40 ? 'FEAR 🔻' : 'NEUTRAL ⚖️' }}
            ({{ marketService.marketMood() }}/100)
          </span>
        </div>

        <div class="sb-item right">
          <span class="sb-lbl">TRADERS ON FLOOR:</span>
          <span class="sb-val">{{ marketService.sessionState()?.connectedPlayers || 1 }} Active</span>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #0a0b10;
      color: #e8ebf2;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .shell-layout {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }

    .top-indices-strip {
      height: 44px;
      background: rgba(17, 19, 26, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 20px;
      overflow-x: auto;
      white-space: nowrap;
      font-size: 0.78rem;
    }

    .index-item {
      display: flex;
      align-items: center;
      gap: 6px;

      &.master {
        padding-right: 16px;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        font-weight: 800;
      }
    }

    .idx-name { color: #8b92a8; font-weight: 700; }
    .idx-val {
      font-weight: 800;
      &.gain { color: #22d97f; }
      &.loss { color: #f04864; }
    }

    .top-right-bar {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .icon-btn {
      background: transparent;
      border: none;
      font-size: 1rem;
      cursor: pointer;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.7rem;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.04);

      &.connected { color: #22d97f; .pulse-dot { background: #22d97f; } }
      &.connecting { color: #f5a623; .pulse-dot { background: #f5a623; } }
      &.offline { color: #38bdf8; .pulse-dot { background: #38bdf8; } }
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .trader-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(124, 91, 240, 0.12);
      border: 1px solid rgba(124, 91, 240, 0.3);
      padding: 4px 10px;
      border-radius: 8px;
    }

    .role-badge {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: #7c5bf0;
      color: #fff;

      &.bank { background: #c084fc; color: #0a0b10; }
    }

    .trader-name { font-weight: 700; color: #fff; }

    .trader-balance {
      font-size: 0.75rem;
      .cash-lbl { color: #8b92a8; margin-right: 4px; }
      .cash-val { font-weight: 800; color: #22d97f; }
    }

    .shell-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .nav-rail {
      width: 70px;
      background: rgba(17, 19, 26, 0.95);
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0;
      gap: 24px;
    }

    .rail-logo {
      font-size: 1.6rem;
      color: #7c5bf0;
    }

    .rail-links {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }

    .rail-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #8b92a8;
      text-decoration: none;
      padding: 8px 0;
      transition: all 0.2s ease;

      &:hover { color: #fff; }

      &.active {
        color: #7c5bf0;
        background: rgba(124, 91, 240, 0.12);
        border-left: 3px solid #7c5bf0;
      }
    }

    .link-icon { font-size: 1.25rem; }
    .link-label { font-size: 0.68rem; font-weight: 700; }

    .logout-btn {
      margin-top: auto;
      background: transparent;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      opacity: 0.6;
      &:hover { opacity: 1; }
    }

    .main-viewport {
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    .status-bar {
      height: 28px;
      background: rgba(10, 11, 16, 0.95);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 24px;
      font-size: 0.7rem;
      color: #8b92a8;
    }

    .sb-item {
      display: flex;
      gap: 6px;
      align-items: center;

      &.right { margin-left: auto; }
    }

    .sb-lbl { font-weight: 700; color: #5a6178; }
    .sb-val {
      font-weight: 800;
      color: #22d97f;
      &.paused { color: #f5a623; }
      &.mood { color: #38bdf8; }
    }
  `]
})
export class WorkstationShellComponent {
  public marketService = inject(MarketService);
  public sessionService = inject(SessionService);
  public wsService = inject(WebSocketService);
  public audioService = inject(AudioService);

  public onLogout() {
    this.sessionService.logout();
    window.location.reload();
  }
}
