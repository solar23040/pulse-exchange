import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketService } from '../../core/services/market.service';
import { Sentiment, NewsItem } from '../../core/models';

@Component({
  selector: 'app-news-wire',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="news-container">
      <!-- Header & Filter Bar -->
      <div class="header-bar glass">
        <div class="title-block">
          <span class="pulse-icon">📡</span>
          <div>
            <h2 class="title">Exchange News Wire</h2>
            <p class="subtitle">Real-time market intelligence, trade executions & host broadcasts</p>
          </div>
        </div>

        <div class="search-box">
          <input
            type="text"
            placeholder="Search headline or ticker..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            class="search-input"
          />
        </div>
      </div>

      <div class="filter-pills">
        <button
          class="pill"
          [class.active]="selectedSentiment() === 'ALL'"
          (click)="selectedSentiment.set('ALL')"
        >
          All News ({{ marketService.newsFeed().length }})
        </button>
        <button
          class="pill bullish"
          [class.active]="selectedSentiment() === 'bullish'"
          (click)="selectedSentiment.set('bullish')"
        >
          🚀 Bullish
        </button>
        <button
          class="pill bearish"
          [class.active]="selectedSentiment() === 'bearish'"
          (click)="selectedSentiment.set('bearish')"
        >
          🔻 Bearish
        </button>
        <button
          class="pill urgent"
          [class.active]="selectedSentiment() === 'urgent'"
          (click)="selectedSentiment.set('urgent')"
        >
          ⚡ Urgent / Shocks
        </button>
        <button
          class="pill host"
          [class.active]="selectedSentiment() === 'HOST'"
          (click)="selectedSentiment.set('HOST')"
        >
          📢 Host Actions
        </button>
      </div>

      <!-- News Feed Cards -->
      <div class="feed-list">
        @for (item of filteredNews(); track item.id) {
          <div class="news-card glass" [class.host-card]="item.isHostAction">
            <div class="card-header">
              <span class="sentiment-badge" [ngClass]="item.sentiment">
                {{ item.sentiment.toUpperCase() }}
              </span>
              @if (item.ticker) {
                <span class="ticker-badge">{{ item.ticker }}</span>
              }
              <span class="time-stamp">{{ formatTime(item.timestamp) }}</span>
            </div>

            <h4 class="news-title">{{ item.title }}</h4>
            <p class="news-body">{{ item.body }}</p>

            <div class="card-footer">
              <span class="source-tag">SOURCE: {{ item.source.toUpperCase() }}</span>
            </div>
          </div>
        } @empty {
          <div class="empty-feed glass">
            <div class="empty-icon">📰</div>
            <div class="empty-text">No news articles match your filter criteria.</div>
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

    .news-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1200px;
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

    .pulse-icon { font-size: 2.2rem; }
    .title { font-size: 1.4rem; font-weight: 800; margin: 0 0 2px 0; }
    .subtitle { font-size: 0.85rem; color: #8b92a8; margin: 0; }

    .search-input {
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(10, 11, 16, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 0.875rem;
      outline: none;
      width: 240px;

      &:focus { border-color: #7c5bf0; }
    }

    .filter-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pill {
      padding: 8px 16px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #8b92a8;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;

      &.active {
        background: #7c5bf0;
        border-color: #7c5bf0;
        color: #fff;
      }
    }

    .feed-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .news-card {
      padding: 18px 22px;
      border-radius: 14px;
      background: rgba(17, 19, 26, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;

      &.host-card {
        border-color: rgba(124, 91, 240, 0.4);
        background: rgba(124, 91, 240, 0.08);
      }
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sentiment-badge {
      font-size: 0.68rem;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;

      &.bullish { background: rgba(34, 217, 127, 0.15); color: #22d97f; }
      &.bearish { background: rgba(240, 72, 100, 0.15); color: #f04864; }
      &.urgent { background: rgba(245, 166, 35, 0.15); color: #f5a623; }
      &.neutral { background: rgba(255, 255, 255, 0.06); color: #8b92a8; }
    }

    .ticker-badge {
      font-size: 0.72rem;
      font-weight: 800;
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .time-stamp {
      font-size: 0.75rem;
      color: #5a6178;
      margin-left: auto;
    }

    .news-title {
      font-size: 1.05rem;
      font-weight: 800;
      margin: 0;

    }

    .news-body {
      font-size: 0.875rem;
      color: #c4c9d8;
      margin: 0;
      line-height: 1.4;
    }

    .card-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 6px;
    }

    .source-tag {
      font-size: 0.68rem;
      font-weight: 700;
      color: #5a6178;
    }

    .empty-feed {
      text-align: center;
      padding: 40px;
      border-radius: 14px;
      color: #8b92a8;
      .empty-icon { font-size: 2.5rem; margin-bottom: 8px; }
    }
  `]
})
export class NewsWireComponent {
  public marketService = inject(MarketService);

  public searchQuery = signal('');
  public selectedSentiment = signal<string>('ALL');

  public filteredNews = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedSentiment();
    const feed = this.marketService.newsFeed();

    return feed.filter(item => {
      const matchesSearch = !query || item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query) || (item.ticker && item.ticker.toLowerCase().includes(query));
      let matchesFilter = true;
      if (filter === 'HOST') matchesFilter = item.isHostAction;
      else if (filter !== 'ALL') matchesFilter = item.sentiment === filter;

      return matchesSearch && matchesFilter;
    });
  });

  public formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
