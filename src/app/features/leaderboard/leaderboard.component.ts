import { Component, signal, computed, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import confetti from 'canvas-confetti';
import { MarketService } from '../../core/services/market.service';
import { SessionService } from '../../core/services/session.service';
import { LeaderboardEntry } from '../../core/models';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="leaderboard-container">
      <!-- Header Bar & Tabs -->
      <div class="header-bar glass">
        <div class="title-block">
          <span class="trophy">🏆</span>
          <div>
            <h2 class="title">Exchange Leaderboard</h2>
            <p class="subtitle">Live player performance ranked by total return %</p>
          </div>
        </div>

        <div class="filter-tabs">
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'all'"
            (click)="activeTab.set('all')"
          >
            All Traders
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'retail'"
            (click)="activeTab.set('retail')"
          >
            Retail Traders
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'bank'"
            (click)="activeTab.set('bank')"
          >
            Bank / VIP
          </button>
        </div>
      </div>

      <!-- Pinned User Card -->
      @if (myEntry(); as me) {
        <div class="my-card glass-strong">
          <div class="rank-badge" [class.rank-1]="me.rank === 1">#{{ me.rank }}</div>
          <div class="user-details">
            <div class="u-name">{{ me.name }} <span class="you-tag">(YOU)</span></div>
            <div class="u-role">{{ me.role.toUpperCase() }} {{ me.firm ? '&bull; ' + me.firm : '' }}</div>
          </div>
          <div class="user-metrics">
            <div class="m">
              <span class="lbl">TOTAL VALUE</span>
              <span class="val">₹{{ me.totalValue.toLocaleString('en-IN') }}</span>
            </div>
            <div class="m">
              <span class="lbl">TOTAL RETURN</span>
              <span class="val" [class.gain]="me.totalReturn >= 0" [class.loss]="me.totalReturn < 0">
                {{ me.totalReturn >= 0 ? '+' : '' }}{{ me.totalReturn.toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      }

      <!-- Main Rankings Table -->
      <div class="table-container glass">
        <table class="rank-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Trader / Institution</th>
              <th>Role</th>
              <th>Total Portfolio Value</th>
              <th>Return %</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of filteredLeaderboard(); track entry.playerId) {
              <tr [class.is-me]="entry.playerId === sessionService.player()?.id">
                <td class="rank-cell">
                  <span class="r-num" [class.top1]="entry.rank === 1" [class.top2]="entry.rank === 2" [class.top3]="entry.rank === 3">
                    #{{ entry.rank }}
                  </span>
                  @if (entry.rank < entry.previousRank) {
                    <span class="rank-change up">▲ {{ entry.previousRank - entry.rank }}</span>
                  } @else if (entry.rank > entry.previousRank) {
                    <span class="rank-change down">▼ {{ entry.rank - entry.previousRank }}</span>
                  }
                </td>
                <td class="name-cell">
                  <div class="n-main">{{ entry.name }}</div>
                  @if (entry.firm) {
                    <div class="n-firm">{{ entry.firm }}</div>
                  }
                </td>
                <td>
                  <span class="role-pill" [class.bank]="entry.role === 'bank'">
                    {{ entry.role.toUpperCase() }}
                  </span>
                </td>
                <td class="val-cell">₹{{ entry.totalValue.toLocaleString('en-IN') }}</td>
                <td class="return-cell" [class.gain]="entry.totalReturn >= 0" [class.loss]="entry.totalReturn < 0">
                  {{ entry.totalReturn >= 0 ? '+' : '' }}{{ entry.totalReturn.toFixed(2) }}%
                </td>
              </tr>
            }
          </tbody>
        </table>
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

    .leaderboard-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header-bar {
      padding: 20px 24px;
      border-radius: 14px;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .title-block {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .trophy { font-size: 2.2rem; }

    .title {
      font-size: 1.4rem;
      font-weight: 800;
      margin: 0 0 2px 0;
    }

    .subtitle {
      font-size: 0.85rem;
      color: #8b92a8;
      margin: 0;
    }

    .filter-tabs {
      display: flex;
      gap: 6px;
      background: rgba(10, 11, 16, 0.6);
      padding: 4px;
      border-radius: 10px;
    }

    .tab-btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #8b92a8;
      font-size: 0.8125rem;
      font-weight: 700;
      cursor: pointer;

      &.active {
        background: #7c5bf0;
        color: #fff;
      }
    }

    .my-card {
      padding: 16px 24px;
      border-radius: 14px;
      background: rgba(124, 91, 240, 0.15);
      border: 1px solid rgba(124, 91, 240, 0.4);
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .rank-badge {
      font-size: 1.75rem;
      font-weight: 900;
      color: #7c5bf0;
      min-width: 60px;

      &.rank-1 { color: #f5a623; }
    }

    .user-details {
      flex: 1;
    }

    .u-name {
      font-size: 1.15rem;
      font-weight: 800;
    }

    .you-tag {
      font-size: 0.75rem;
      color: #7c5bf0;
      font-weight: 700;
    }

    .u-role {
      font-size: 0.75rem;
      color: #8b92a8;
    }

    .user-metrics {
      display: flex;
      gap: 32px;
    }

    .m {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .lbl {
      font-size: 0.68rem;
      font-weight: 700;
      color: #8b92a8;
    }

    .val {
      font-size: 1.2rem;
      font-weight: 800;

      &.gain { color: #22d97f; }
      &.loss { color: #f04864; }
    }

    .table-container {
      border-radius: 14px;
      overflow: hidden;
      background: rgba(17, 19, 26, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .rank-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;

      th {
        padding: 14px 18px;
        background: rgba(10, 11, 16, 0.9);
        color: #8b92a8;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      td {
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      tr.is-me {
        background: rgba(124, 91, 240, 0.1);
      }

      .rank-cell {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .r-num {
        font-weight: 800;
        font-size: 1rem;

        &.top1 { color: #f5a623; }
        &.top2 { color: #c4c9d8; }
        &.top3 { color: #cd7f32; }
      }

      .rank-change {
        font-size: 0.7rem;
        font-weight: 700;
        &.up { color: #22d97f; }
        &.down { color: #f04864; }
      }

      .name-cell {
        font-weight: 700;
        .n-firm { font-size: 0.75rem; color: #8b92a8; font-weight: 400; }
      }

      .role-pill {
        font-size: 0.7rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.06);
        color: #8b92a8;

        &.bank {
          background: rgba(192, 132, 252, 0.15);
          color: #c084fc;
        }
      }

      .val-cell { font-weight: 700; }

      .return-cell {
        font-weight: 800;
        &.gain { color: #22d97f; }
        &.loss { color: #f04864; }
      }
    }
  `]
})
export class LeaderboardComponent {
  public marketService = inject(MarketService);
  public sessionService = inject(SessionService);

  public activeTab = signal<'all' | 'retail' | 'bank'>('all');

  public filteredLeaderboard = computed(() => {
    const tab = this.activeTab();
    const list = this.marketService.leaderboard();
    if (tab === 'all') return list;
    return list.filter(e => e.role === tab);
  });

  public myEntry = computed(() => {
    const myId = this.sessionService.player()?.id;
    if (!myId) return null;
    return this.marketService.leaderboard().find(e => e.playerId === myId) || null;
  });

  constructor() {
    effect(() => {
      const me = this.myEntry();
      if (me && me.rank === 1) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });
  }
}
