import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGateway, CuentaInterna, FalloIngreso, Rol } from './auth.gateway';
import { BFF_BASE_URL, HTTP_TIMEOUT_MS } from '../config/api.config';

/** SesionConsolaOut del OpenAPI entregado para BITS-363/BITS-375. */
export interface SesionConsola {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: 'Bearer';
  rol: Rol;
  nombre?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HttpAuthGateway implements AuthGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(BFF_BASE_URL).replace(/\/+$/, '');
  private tokens: SesionConsola | null = null;
  private cuenta: CuentaInterna | null = null;
  private expiresAt = 0;
  private revision = 0;
  private pendiente: Promise<string | null> | null = null;

  async ingresar(correo: string, password: string): Promise<CuentaInterna> {
    this.limpiar();
    const revision = this.revision;
    try {
      const respuesta = await firstValueFrom(
        this.http
          .post<unknown>(`${this.base}/v1/backoffice/sesiones`, { email: correo, password })
          .pipe(timeout(HTTP_TIMEOUT_MS)),
      );
      if (revision !== this.revision) throw new FalloIngreso('no-disponible');
      this.guardar(respuesta, correo.trim().toLowerCase());
      return this.cuenta!;
    } catch (error) {
      if (revision === this.revision) this.limpiar();
      if (error instanceof FalloIngreso) throw error;
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      const codigo = error instanceof HttpErrorResponse ? error.error?.codigo : undefined;
      throw new FalloIngreso(
        status === 401
          ? 'credenciales'
          : status === 403 && codigo === 'ACCESO_POR_PORTAL_CLIENTE'
            ? 'portal'
            : status === 403 && codigo === 'CUENTA_SIN_ROL'
              ? 'sin-rol'
              : status === 429
                ? 'limite'
                : 'no-disponible',
      );
    }
  }

  async validar(): Promise<CuentaInterna | null> {
    return (await this.tokenValido()) ? this.cuenta : null;
  }

  tokenValido(): Promise<string | null> {
    if (this.tokens && Date.now() < this.expiresAt - 30000) {
      return Promise.resolve(this.tokens.accessToken);
    }
    return this.refrescar();
  }

  refrescar(): Promise<string | null> {
    if (this.pendiente) return this.pendiente;
    const refreshToken = this.tokens?.refreshToken;
    const correo = this.cuenta?.correo;
    if (!refreshToken || !correo) return Promise.resolve(null);
    const revision = this.revision;
    const intento = firstValueFrom(
      this.http
        .post<unknown>(`${this.base}/v1/backoffice/sesiones/refresco`, { refreshToken })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    )
      .then((respuesta) => {
        if (revision !== this.revision) return null;
        this.guardar(respuesta, correo);
        return this.tokens!.accessToken;
      })
      .catch(() => {
        if (revision === this.revision) {
          this.tokens = null;
          this.cuenta = null;
          this.expiresAt = 0;
        }
        return null;
      })
      .finally(() => {
        if (this.pendiente === intento) this.pendiente = null;
      });
    this.pendiente = intento;
    return intento;
  }

  esTokenActual(token: string): boolean {
    return this.tokens?.accessToken === token;
  }

  get version(): number {
    return this.revision;
  }

  async salir(): Promise<void> {
    this.limpiar();
  }

  private limpiar(): void {
    ++this.revision;
    this.tokens = null;
    this.cuenta = null;
    this.expiresAt = 0;
    this.pendiente = null;
  }

  private guardar(value: unknown, correo: string): void {
    const s = value as Partial<SesionConsola> | null;
    if (!s || (s.rol !== 'ADMIN' && s.rol !== 'SOCIO')) throw new FalloIngreso('sin-rol');
    if (
      typeof s.accessToken !== 'string' ||
      !s.accessToken ||
      typeof s.refreshToken !== 'string' ||
      !s.refreshToken ||
      typeof s.expiresIn !== 'number' ||
      !Number.isSafeInteger(s.expiresIn) ||
      s.expiresIn <= 0 ||
      (s.tokenType !== undefined && s.tokenType !== 'Bearer') ||
      (s.nombre != null && typeof s.nombre !== 'string')
    )
      throw new FalloIngreso('no-disponible');
    this.tokens = s as SesionConsola;
    this.expiresAt = Date.now() + s.expiresIn * 1000;
    this.cuenta = { correo, nombre: s.nombre ?? '', rol: s.rol };
  }
}
