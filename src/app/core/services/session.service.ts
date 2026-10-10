import { Injectable, signal, computed } from '@angular/core';
import { Player, PlayerRole } from '../models';
import { generateUuid } from '../utils';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  public player = signal<Player | null>(null);

  public isJoined = computed(() => !!this.player());
  public isBank = computed(() => this.player()?.role === 'bank');
  public isHost = computed(() => this.player()?.role === 'host');

  constructor() {
    this.rejoin();
  }

  public join(name: string, role: PlayerRole, firm?: string): void {
    const id = generateUuid();
    const initialCash = role === 'bank' ? 100000000 : 1000000;
    
    const newPlayer: Player = {
      id,
      name,
      role,
      firm,
      cash: initialCash,
      portfolioValue: 0,
      totalValue: initialCash,
      returnPercent: 0,
      rank: 0,
      joinedAt: Date.now(),
      initialCash
    };

    this.player.set(newPlayer);
    localStorage.setItem('pulse_player', JSON.stringify(newPlayer));
  }

  public rejoin(): void {
    const stored = localStorage.getItem('pulse_player');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Player;
        this.player.set(parsed);
      } catch (e) {
        console.error('Failed to parse stored player', e);
      }
    }
  }

  public updatePlayer(partial: Partial<Player>): void {
    const current = this.player();
    if (current) {
      const updated = { ...current, ...partial };
      this.player.set(updated);
      localStorage.setItem('pulse_player', JSON.stringify(updated));
    }
  }

  public logout(): void {
    this.player.set(null);
    localStorage.removeItem('pulse_player');
  }
}
