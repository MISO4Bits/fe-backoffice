import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { BFF_BASE_URL, HTTP_TIMEOUT_MS } from '../../core/config/api.config';
import { DecisionSiniestro, SiniestroDetalle, SiniestroResumen } from './siniestros.models';

@Injectable({ providedIn: 'root' })
export class SiniestrosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${this.baseUrl()}/v1/backoffice/siniestros`;

  private baseUrl(): string {
    let base = inject(BFF_BASE_URL);
    while (base.endsWith('/')) base = base.slice(0, -1);
    return base;
  }

  bandeja(automatico: boolean): Promise<SiniestroResumen[]> {
    return firstValueFrom(
      this.http
        .get<SiniestroResumen[]>(this.base, {
          params: automatico
            ? { estado: 'PAGADO', automatico: true }
            : { estado: 'EN_ESTUDIO', automatico: false },
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  detalle(id: string): Promise<SiniestroDetalle> {
    return firstValueFrom(
      this.http
        .get<SiniestroDetalle>(`${this.base}/${encodeURIComponent(id)}`)
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  imagen(id: string, archivoId: string): Promise<Blob> {
    return firstValueFrom(
      this.http
        .get(`${this.base}/${encodeURIComponent(id)}/evidencias/${encodeURIComponent(archivoId)}`, {
          responseType: 'blob',
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  decidir(id: string, decision: DecisionSiniestro): Promise<SiniestroDetalle> {
    // El BFF asigna el agente desde la sesión; no debe enviarse desde el navegador.
    const cuerpo =
      decision.decision === 'PAGAR'
        ? {
            decision: 'PAGAR',
            ...(decision.dano ? { dano: decision.dano, valor: decision.valor } : {}),
          }
        : decision.decision === 'PEDIR_EVIDENCIA'
          ? { decision: 'PEDIR_EVIDENCIA', detalle: decision.detalle }
          : { decision: 'RECHAZAR', motivo: decision.motivo };
    return firstValueFrom(
      this.http
        .post<SiniestroDetalle>(`${this.base}/${encodeURIComponent(id)}/decisiones`, cuerpo)
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
}
