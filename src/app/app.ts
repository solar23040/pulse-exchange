import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService } from './core/services/session.service';
import { EntryModalComponent } from './features/entry/entry.component';
import { WorkstationShellComponent } from './features/shell/shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, EntryModalComponent, WorkstationShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public sessionService = inject(SessionService);

  public onJoined() {
    // Session service updated, view toggles to shell
  }
}
