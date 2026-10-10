import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'market',
    loadComponent: () => import('./features/market/market.component').then(m => m.MarketWatchComponent)
  },
  {
    path: 'terminal',
    loadComponent: () => import('./features/terminal/terminal.component').then(m => m.TradingTerminalComponent)
  },
  {
    path: 'portfolio',
    loadComponent: () => import('./features/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: 'tracking',
    loadComponent: () => import('./features/tracking/tracking.component').then(m => m.TrackingComponent)
  },
  {
    path: 'news',
    loadComponent: () => import('./features/news/news.component').then(m => m.NewsWireComponent)
  },
  {
    path: 'host',
    loadComponent: () => import('./features/host/host.component').then(m => m.HostConsoleComponent)
  },
  {
    path: '',
    redirectTo: 'market',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'market'
  }
];
