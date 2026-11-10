import { HttpClient } from '@angular/common/http';
import { effect, inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { BFF_BASE_URL, HTTP_TIMEOUT_MS } from '../../core/config/api.config';
import { SessionService } from '../../core/auth/session.service';
import {
  DecisionSolicitud,
  PaginaSolicitudes,
  SolicitudDetalle,
  SolicitudResumen,
  esPendienteAgente,
} from './solicitudes.models';

@Injectable({ providedIn: 'root' })
export class SolicitudesApiService {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SessionService);
  private readonly base = `${this.baseUrl()}/v1/backoffice/solicitudes`;
  private readonly detalles = new Map<string, SolicitudDetalle>();
  private version = 0;
  private baseUrl(): string {
    let base = inject(BFF_BASE_URL);
    while (base.endsWith('/')) base = base.slice(0, -1);
    return base;
  }
  constructor() {
    let identidad: string | null | undefined;
    effect(() => {
      const cuenta = this.sesion.cuenta();
      const actual = cuenta ? `${cuenta.uid}:${cuenta.rol}` : null;
      if (actual !== identidad) {
        identidad = actual;
        this.limpiar();
      }
    });
  }
  limpiar(): void {
    this.version++;
    this.detalles.clear();
  }
  cache(id: string): SolicitudDetalle | undefined {
    return this.detalles.get(id);
  }
  esperaMiRevision(solicitud: SolicitudDetalle): boolean {
    const correo = this.sesion.cuenta()?.correo.trim().toLowerCase();
    return (
      solicitud.estado === 'PENDIENTE' &&
      solicitud.pendientes.some(esPendienteAgente) &&
      !solicitud.decisiones.some(
        (decision) => correo && decision.agente.trim().toLowerCase() === correo,
      )
    );
  }
  pagina(cursor?: string): Promise<PaginaSolicitudes> {
    return firstValueFrom(
      this.http
        .get<PaginaSolicitudes>(this.base, {
          params: cursor ? { limite: 100, cursor } : { limite: 100 },
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  async detalle(id: string): Promise<SolicitudDetalle> {
    const version = this.version;
    const resultado = await firstValueFrom(
      this.http
        .get<SolicitudDetalle>(`${this.base}/${encodeURIComponent(id)}`)
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
    if (version === this.version) this.detalles.set(id, resultado);
    return resultado;
  }
  imagen(id: string, evidencia: string): Promise<Blob> {
    return firstValueFrom(
      this.http
        .get(`${this.base}/${encodeURIComponent(id)}/evidencias/${encodeURIComponent(evidencia)}`, {
          responseType: 'blob',
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  decidir(id: string, decision: DecisionSolicitud): Promise<SolicitudResumen> {
    // Construir el cuerpo explícitamente: nunca propagar agente, nota ni campos ajenos.
    const cuerpo =
      decision.decision === 'APROBAR'
        ? { decision: decision.decision, pendientes: decision.pendientes }
        : { decision: decision.decision, motivo: decision.motivo };
    return firstValueFrom(
      this.http
        .post<SolicitudResumen>(`${this.base}/${encodeURIComponent(id)}/decisiones`, cuerpo)
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
}
