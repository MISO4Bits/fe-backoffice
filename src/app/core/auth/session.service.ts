import { computed, inject, Injectable, signal } from '@angular/core';
import { AUTH_GATEWAY, CuentaInterna, FalloIngreso, Rol } from './auth.gateway';

export function inicioPorRol(rol: Rol): string {
  return rol === 'ADMIN' ? '/tablero' : '/venta';
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly estado = signal<CuentaInterna | null>(null);
  private revision = 0;
  readonly cuenta = this.estado.asReadonly();
  readonly inicio = computed(() => {
    const cuenta = this.cuenta();
    return cuenta ? inicioPorRol(cuenta.rol) : '/ingreso';
  });

  async ingresar(correo: string, password: string): Promise<void> {
    const revision = ++this.revision;
    this.estado.set(null);
    const cuenta = await this.gateway.ingresar(correo, password);
    if (!cuenta || (cuenta.rol !== 'ADMIN' && cuenta.rol !== 'SOCIO'))
      throw new FalloIngreso('portal');
    if (revision === this.revision) this.estado.set(cuenta);
  }

  async salir(): Promise<void> {
    ++this.revision;
    this.estado.set(null);
    await this.gateway.salir();
  }
}
