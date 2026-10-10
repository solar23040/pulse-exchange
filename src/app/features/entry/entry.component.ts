import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
  output,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../core/services/session.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { PlayerRole } from '../../core/models';

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entry.component.html',
  styleUrl: './entry.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryModalComponent implements OnInit {
  public sessionService = inject(SessionService);
  public wsService = inject(WebSocketService);

  // Form & state signals
  public role = signal<PlayerRole>('retail');
  public name = signal<string>('');
  public firmName = signal<string>('');
  public isConnecting = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public touched = signal<boolean>(false);

  // Output event to notify parent (app component) of successful join
  public joined = output<void>();

  // Validation: name required, 3-30 chars, alphanumeric + spaces
  public isNameValid = computed(() => {
    const val = this.name();
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 30) {
      return false;
    }
    return /^[a-zA-Z0-9 ]+$/.test(val);
  });

  public nameValidationError = computed(() => {
    const val = this.name();
    if (!this.touched() && !val) {
      return null;
    }
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Trader display name is required.';
    }
    if (trimmed.length < 3) {
      return 'Name must be at least 3 characters.';
    }
    if (val.length > 30) {
      return 'Name cannot exceed 30 characters.';
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(val)) {
      return 'Only letters, numbers, and spaces are allowed.';
    }
    return null;
  });

  // WebSocket connection readiness
  public isConnected = computed(() => {
    const status = this.wsService.connectionStatus();
    return (
      status === 'connected' ||
      this.wsService.isConnected() ||
      this.wsService.isOfflineMode()
    );
  });

  // "Enter the Floor" button disabled until name is valid and connected
  public canEnterFloor = computed(() => {
    return this.isNameValid() && this.isConnected() && !this.isConnecting();
  });

  ngOnInit(): void {
    // Initiate WebSocket connection
    this.wsService.connect();

    // Check localStorage for previous session info to prefill
    this.loadSavedPlayer();
  }

  public selectRole(newRole: PlayerRole): void {
    this.role.set(newRole);
  }

  public onNameChange(value: string): void {
    this.name.set(value);
  }

  public onFirmChange(value: string): void {
    this.firmName.set(value);
  }

  public markTouched(): void {
    this.touched.set(true);
  }

  public dismissError(): void {
    this.errorMessage.set(null);
  }

  public async onEnterFloor(): Promise<void> {
    this.touched.set(true);

    if (!this.canEnterFloor()) {
      if (!this.isNameValid()) {
        this.errorMessage.set(
          this.nameValidationError() || 'Please enter a valid trader name (3-30 characters, alphanumeric & spaces).'
        );
      } else if (!this.isConnected()) {
        this.errorMessage.set(
          'Connecting to exchange network. Please wait for server readiness before entering.'
        );
      }
      return;
    }

    this.isConnecting.set(true);
    this.errorMessage.set(null);

    try {
      const trimmedName = this.name().trim();
      const selectedRole = this.role();
      const firm =
        selectedRole === 'bank'
          ? this.firmName().trim() || 'Institutional Capital'
          : undefined;

      // Realistic visual feedback delay for floor authorization
      await new Promise((resolve) => setTimeout(resolve, 450));

      // 1. Join session via SessionService (this also saves to localStorage)
      this.sessionService.join(trimmedName, selectedRole, firm);

      // 2. Explicitly ensure localStorage contains the updated player
      const activePlayer = this.sessionService.player();
      if (activePlayer) {
        localStorage.setItem('pulse_player', JSON.stringify(activePlayer));
      }

      // 3. Broadcast JOIN message over WebSocket
      this.wsService.send({
        type: 'JOIN',
        payload: {
          name: trimmedName,
          role: selectedRole,
          firm
        }
      });

      // 4. Emit output event
      this.joined.emit();
    } catch (err: unknown) {
      console.error('Failed to join trading floor:', err);
      this.errorMessage.set(
        err instanceof Error
          ? err.message
          : 'Unable to enter trading floor. Please check connection and try again.'
      );
    } finally {
      this.isConnecting.set(false);
    }
  }

  private loadSavedPlayer(): void {
    const saved = localStorage.getItem('pulse_player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (parsed.name && typeof parsed.name === 'string') {
            this.name.set(parsed.name);
          }
          if (parsed.role === 'retail' || parsed.role === 'bank') {
            this.role.set(parsed.role);
          }
          if (parsed.firm && typeof parsed.firm === 'string') {
            this.firmName.set(parsed.firm);
          }
        }
      } catch (e) {
        console.warn('Could not parse stored player preferences:', e);
      }
    }
  }
}
