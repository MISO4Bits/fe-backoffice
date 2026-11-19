import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { timeout } from 'rxjs';
import { BFF_BASE_URL, HTTP_TIMEOUT_MS } from '../../core/config/api.config';

export type EstadoPoliza = 'PENDIENTE' | 'EMITIDA' | 'RECHAZADA' | 'VENCIDA' | 'DESACTIVADA';

export interface PolizaVendida {
  polizaId: string;
  estado: EstadoPoliza;
  creadaEn: string;
  primaTotalMensual: number;
  cliente?: {
    nombre: string;
    tipoDocumento: 'CC' | 'CE' | 'PA';
    ultimosDigitosDocumento: string;
  } | null;
}

export interface PolizasDelSocio {
  items: PolizaVendida[];
  consultadoEn: string;
  incompleta: boolean;
}

@Injectable({ providedIn: 'root' })
export class PolizasSocioApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(BFF_BASE_URL).replace(/\/+$/, '');

  listar() {
    return this.http
      .get<PolizasDelSocio>(`${this.base}/v1/socio/polizas`)
      .pipe(timeout(HTTP_TIMEOUT_MS));
  }
}
