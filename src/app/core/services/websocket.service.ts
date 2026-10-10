import { Injectable, signal, NgZone, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { ClientMessage, ServerMessage, MarketTick, SectorIndex, LeaderboardEntry, NewsItem, Alert, Order, Portfolio, SessionState, Player } from '../models';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private zone = inject(NgZone);
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;

  public isConnected = signal(false);
  public isOfflineMode = signal(false);
  public connectionStatus = signal<'connecting' | 'connected' | 'disconnected' | 'offline'>('disconnected');

  // Message Subjects
  private messageSubject = new Subject<ServerMessage>();
  public messages$: Observable<ServerMessage> = this.messageSubject.asObservable();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('pulse_exchange_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (this.isOfflineMode()) {
          this.zone.run(() => this.messageSubject.next(event.data));
        }
      };
    }
  }

  public connect(customUrl?: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.connectionStatus.set('connecting');
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }

    // Use current host if no URL provided (allows connecting via local IP network)
    let targetUrl = customUrl;
    if (!targetUrl) {
      if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        targetUrl = `${protocol}//${window.location.host}`;
      } else {
        targetUrl = 'ws://localhost:4200';
      }
    }

    try {
      this.ws = new WebSocket(targetUrl);

      // Safety net: some dev servers accept the TCP connection but never
      // answer the WS handshake (no open / error / close events), which
      // would leave the UI stuck on "connecting" forever. Fall back to the
      // local simulation engine instead.
      this.openTimer = setTimeout(() => {
        this.zone.run(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN && this.connectionStatus() === 'connecting') {
            try {
              this.ws.close();
            } catch {
              // Already gone — fall through to offline mode.
            }
            this.enableOfflineFallback();
          }
        });
      }, 5000);

      this.ws.onopen = () => {
        this.zone.run(() => {
          if (this.openTimer) {
            clearTimeout(this.openTimer);
            this.openTimer = null;
          }
          this.isConnected.set(true);
          this.isOfflineMode.set(false);
          this.connectionStatus.set('connected');
          console.log('[WebSocket] Connected to PULSE EXCHANGE server');
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);
          this.zone.run(() => this.messageSubject.next(data));
        } catch (e) {
          console.error('[WebSocket] Error parsing server message', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error, activating offline fallback', err);
        this.enableOfflineFallback();
      };

      this.ws.onclose = () => {
        this.zone.run(() => {
          this.isConnected.set(false);
          if (this.connectionStatus() !== 'offline') {
            this.connectionStatus.set('disconnected');
            // Try reconnecting after 3 seconds
            setTimeout(() => this.connect(customUrl), 3000);
          }
        });
      };
    } catch (e) {
      console.warn('[WebSocket] Exception during connect, enabling offline fallback', e);
      this.enableOfflineFallback();
    }
  }

  private enableOfflineFallback(): void {
    this.zone.run(() => {
      this.isConnected.set(false);
      this.isOfflineMode.set(true);
      this.connectionStatus.set('offline');
      console.log('[WebSocket] Offline simulation fallback active');
    });
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(msg);
    }
  }
}
