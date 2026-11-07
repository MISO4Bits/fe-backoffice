import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';
import { Rol } from './auth.gateway';

export const soloInvitados: CanActivateFn = () => {
  const sesion = inject(SessionService);
  return !sesion.cuenta() || inject(Router).parseUrl(sesion.inicio());
};
export const requiereSesion: CanActivateFn = () =>
  !!inject(SessionService).cuenta() || inject(Router).parseUrl('/ingreso');
export function requiereRol(rol: Rol): CanActivateFn {
  return () => {
    const sesion = inject(SessionService);
    return sesion.cuenta()?.rol === rol || inject(Router).parseUrl(sesion.inicio());
  };
}
export const irAlInicio: CanActivateFn = () =>
  inject(Router).parseUrl(inject(SessionService).inicio());
