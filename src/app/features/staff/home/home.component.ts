import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-staff-home',
  templateUrl: './home.component.html',
})
export class StaffHomeComponent {
  readonly name = inject(AuthService).currentName;
}
