import { InjectionToken } from '@angular/core';

export type Rol = 'ADMIN' | 'SOCIO';

/** Modelo interno del frontend; no representa aún el contrato HTTP de David. */
export interface CuentaInterna {
  uid: string;
  correo: string;
  nombre: string;
  rol: Rol;
}

export type ErrorIngreso =
  'credenciales' | 'portal' | 'limite' | 'no-disponible' | 'integracion-pendiente';

export class FalloIngreso extends Error {
  constructor(readonly motivo: ErrorIngreso) {
    super(motivo);
  }
}

/** El adaptador definitivo resolverá tokens, refresco y cierre remoto según el PR. */
export interface AuthGateway {
  ingresar(correo: string, password: string): Promise<CuentaInterna>;
  salir(): Promise<void>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('AUTH_GATEWAY', {
  providedIn: 'root',
  factory: () => ({
    ingresar: async () => {
      throw new FalloIngreso('integracion-pendiente');
    },
    salir: async () => {},
  }),
});
