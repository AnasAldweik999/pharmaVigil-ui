import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly theme = inject(ThemeService);
  // Injected purely so its constructor effect (starting/stopping the unread-
  // notifications poll based on auth state) runs for the app's lifetime.
  private readonly notifications = inject(NotificationService);
}
