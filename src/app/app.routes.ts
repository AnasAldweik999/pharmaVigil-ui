import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { SetupUsernameComponent } from './features/auth/setup-username/setup-username.component';
import {supervisorGuard} from './core/guards/supervisor.guard';
import {staffGuard} from './core/guards/staff.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', title: 'PharmaVigil · Sign In', component: LoginComponent },
  { path: 'reset-password', title: 'PharmaVigil · Reset Password', component: ResetPasswordComponent },
  { path: 'setup-username', title: 'PharmaVigil · Set Username', component: SetupUsernameComponent },
  {
    path: 'supervisor',
    canActivate: [authGuard, supervisorGuard],
    loadChildren: () =>
      import('./features/supervisor/supervisor.routes').then((m) => m.supervisorRoutes),
  },
  {
    path: 'staff',
    canActivate: [authGuard, staffGuard],
    loadChildren: () =>
      import('./features/staff/staff.routes').then((m) => m.staffRoutes),
  },
  { path: '**', redirectTo: '/login' },
];
