import { Component, signal, inject, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../core/services/session.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { PlayerRole } from '../../core/models';

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="entry-overlay">
      <!-- Animated backdrop glow elements -->
      <div class="glow-orb orb-1"></div>
      <div class="glow-orb orb-2"></div>
      <div class="grid-overlay"></div>

      <div class="entry-modal glass-strong">
        <!-- Header -->
        <div class="modal-header">
          <div class="brand-badge">
            <span class="live-dot"></span>
            <span class="brand-text">PULSE EXCHANGE</span>
          </div>
          <h1 class="modal-title">Live Trading Floor</h1>
          <p class="modal-subtitle">Institutional & Retail Simulation Network</p>
        </div>

        <!-- Connection Status Indicator -->
        <div class="connection-pill" [ngClass]="wsService.connectionStatus()">
          <span class="status-dot"></span>
          @if (wsService.connectionStatus() === 'connected') {
            <span>SERVER ONLINE &bull; READY TO CONNECT</span>
          } @else if (wsService.connectionStatus() === 'connecting') {
            <span>CONNECTING TO EXCHANGE SERVER...</span>
          } @else {
            <span>OFFLINE MODE ACTIVE &bull; LOCAL SIMULATION</span>
          }
        </div>

        <!-- Form Content -->
        <form (ngSubmit)="onEnterFloor()" class="entry-form">
          <!-- Name Input -->
          <div class="form-group">
            <label for="name">Trader Display Name</label>
            <div class="input-wrapper">
              <input
                id="name"
                type="text"
                [(ngModel)]="name"
                name="name"
                placeholder="e.g. Alex Vance, WallSt_Cap"
                required
                maxlength="24"
                class="form-input"
              />
            </div>
          </div>

          <!-- Role Selector -->
          <div class="form-group">
            <label>Select Floor Access Tier</label>
            <div class="role-grid">
              <button
                type="button"
                class="role-card"
                [class.active]="selectedRole() === 'retail'"
                (click)="selectedRole.set('retail')"
              >
                <div class="role-icon">👤</div>
                <div class="role-info">
                  <div class="role-name">Retail Trader</div>
                  <div class="role-capital">₹10,00,000 Starting Cash</div>
                </div>
                <div class="role-check">✓</div>
              </button>

              <button
                type="button"
                class="role-card institutional"
                [class.active]="selectedRole() === 'bank'"
                (click)="selectedRole.set('bank')"
              >
                <div class="role-icon">🏛️</div>
                <div class="role-info">
                  <div class="role-name">Bank / Institutional VIP</div>
                  <div class="role-capital">₹10,00,00,000 Capital Pool</div>
                </div>
                <div class="role-check">✓</div>
              </button>
            </div>
          </div>

          <!-- Firm Name (Only for Bank Role) -->
          @if (selectedRole() === 'bank') {
            <div class="form-group fade-in">
              <label for="firm">Institution / Capital Firm Name</label>
              <input
                id="firm"
                type="text"
                [(ngModel)]="firm"
                name="firm"
                placeholder="e.g. BlackRock, Citadel, Goldman Securities"
                class="form-input"
              />
            </div>
          }

          <!-- Enter Floor CTA -->
          <button
            type="submit"
            class="cta-button"
            [disabled]="!name().trim()"
          >
            ENTER TRADING FLOOR &rarr;
          </button>
        </form>

        <div class="footer-note">
          Simulated market environment. No real funds or broker APIs involved.
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }

    .entry-overlay {
      position: relative;
      width: 100%;
      height: 100vh;
      background: #0a0b10;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
      color: #e8ebf2;
    }

    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
    }

    .glow-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.25;
      pointer-events: none;
    }

    .orb-1 {
      width: 500px;
      height: 500px;
      background: #7c5bf0;
      top: -100px;
      left: -100px;
    }

    .orb-2 {
      width: 600px;
      height: 600px;
      background: #0ea5e9;
      bottom: -150px;
      right: -150px;
    }

    .entry-modal {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 480px;
      padding: 32px;
      border-radius: 20px;
      background: rgba(17, 19, 26, 0.85);
      backdrop-filter: blur(32px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);
    }

    .modal-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: rgba(124, 91, 240, 0.12);
      border: 1px solid rgba(124, 91, 240, 0.3);
      border-radius: 9999px;
      margin-bottom: 12px;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22d97f;
      box-shadow: 0 0 10px #22d97f;
    }

    .brand-text {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #9575f5;
    }

    .modal-title {
      font-size: 1.75rem;
      font-weight: 800;
      margin: 0 0 4px 0;
      letter-spacing: -0.02em;
    }

    .modal-subtitle {
      font-size: 0.875rem;
      color: #8b92a8;
      margin: 0;
    }

    .connection-pill {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 24px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);

      &.connected {
        color: #22d97f;
        border-color: rgba(34, 217, 127, 0.2);
        .status-dot { background: #22d97f; }
      }

      &.connecting {
        color: #f5a623;
        border-color: rgba(245, 166, 35, 0.2);
        .status-dot { background: #f5a623; }
      }

      &.offline {
        color: #38bdf8;
        border-color: rgba(56, 189, 248, 0.2);
        .status-dot { background: #38bdf8; }
      }
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .entry-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;

      label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #c4c9d8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .form-input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 10px;
      background: rgba(10, 11, 16, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #ffffff;
      font-size: 0.95rem;
      outline: none;
      transition: all 0.2s ease;

      &:focus {
        border-color: #7c5bf0;
        box-shadow: 0 0 12px rgba(124, 91, 240, 0.3);
      }
    }

    .role-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .role-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: inherit;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      &.active {
        background: rgba(124, 91, 240, 0.15);
        border-color: #7c5bf0;

        .role-check {
          opacity: 1;
          background: #7c5bf0;
        }
      }

      &.institutional.active {
        background: rgba(192, 132, 252, 0.15);
        border-color: #c084fc;

        .role-check {
          background: #c084fc;
        }
      }
    }

    .role-icon {
      font-size: 1.5rem;
    }

    .role-info {
      flex: 1;
    }

    .role-name {
      font-weight: 700;
      font-size: 0.9375rem;
    }

    .role-capital {
      font-size: 0.78rem;
      color: #8b92a8;
      margin-top: 2px;
    }

    .role-check {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      opacity: 0.4;
      transition: all 0.2s ease;
    }

    .cta-button {
      width: 100%;
      padding: 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, #7c5bf0 0%, #0ea5e9 100%);
      border: none;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(124, 91, 240, 0.35);
      transition: all 0.2s ease;
      margin-top: 8px;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(124, 91, 240, 0.5);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .footer-note {
      margin-top: 20px;
      font-size: 0.75rem;
      color: #5a6178;
      text-align: center;
    }
  `]
})
export class EntryModalComponent {
  public sessionService = inject(SessionService);
  public wsService = inject(WebSocketService);

  public name = signal('');
  public selectedRole = signal<PlayerRole>('retail');
  public firm = signal('');

  public joined = output<void>();

  constructor() {
    this.wsService.connect();
  }

  public onEnterFloor() {
    if (!this.name().trim()) return;

    // Join session locally
    this.sessionService.join(
      this.name().trim(),
      this.selectedRole(),
      this.selectedRole() === 'bank' ? this.firm().trim() || 'Institutional Capital' : undefined
    );

    // Send JOIN over WebSocket
    this.wsService.send({
      type: 'JOIN',
      payload: {
        name: this.name().trim(),
        role: this.selectedRole(),
        firm: this.selectedRole() === 'bank' ? this.firm().trim() || 'Institutional Capital' : undefined
      }
    });

    // Emit joined event to parent to transition to workstation shell
    this.joined.emit();
  }
}
