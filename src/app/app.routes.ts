import { Routes } from '@angular/router';
import { irAlInicio, requiereRol, requiereSesion, soloInvitados } from './core/auth/auth.guards';
import { Login } from './features/login/login';
import { BackofficeShell } from './shared/backoffice-shell/backoffice-shell';

export const routes: Routes = [
  {
    path: 'ingreso',
    title: 'Backoffice de Solventa',
    component: Login,
    canActivate: [soloInvitados],
  },
  {
    path: '',
    component: BackofficeShell,
    canActivate: [requiereSesion],
    canActivateChild: [requiereSesion],
    children: [
      { path: '', pathMatch: 'full', canActivate: [irAlInicio], component: Login },
      {
        path: 'tablero',
        title: 'Tablero · Solventa',
        canActivate: [requiereRol('ADMIN')],
        loadComponent: () => import('./features/tablero/tablero').then((m) => m.Tablero),
      },
      {
        path: 'solicitudes',
        title: 'Solicitudes · Solventa',
        canActivate: [requiereRol('ADMIN')],
        data: { titulo: 'Solicitudes' },
        loadComponent: () => import('./features/pendiente/pendiente').then((m) => m.Pendiente),
      },
      {
        path: 'siniestros',
        title: 'Siniestros · Solventa',
        canActivate: [requiereRol('ADMIN')],
        data: { titulo: 'Siniestros' },
        loadComponent: () => import('./features/pendiente/pendiente').then((m) => m.Pendiente),
      },
      {
        path: 'venta',
        title: 'Nueva venta · Solventa',
        canActivate: [requiereRol('SOCIO')],
        loadComponent: () => import('./features/venta/nueva-venta').then((m) => m.NuevaVenta),
      },
      { path: '**', canActivate: [irAlInicio], component: Login },
    ],
  },
];
