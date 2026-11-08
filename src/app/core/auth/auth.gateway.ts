import { InjectionToken } from '@angular/core';

export type Rol = 'ADMIN' | 'SOCIO';

/** Modelo interno: el contrato de sesión no devuelve el uid. */
export interface CuentaInterna {
  uid?: string;
  correo: string;
  nombre: string;
  rol: Rol;
}

export type ErrorIngreso = 'credenciales' | 'portal' | 'limite' | 'sin-rol' | 'no-disponible';

export class FalloIngreso extends Error {
  constructor(readonly motivo: ErrorIngreso) {
    super(motivo);
  }
}

/** Puerto de autenticación del canal interno. */
export interface AuthGateway {
  ingresar(correo: string, password: string): Promise<CuentaInterna>;
  salir(): Promise<void>;
  validar?(): Promise<CuentaInterna | null>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('AUTH_GATEWAY');
