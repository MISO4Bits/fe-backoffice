import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { BFF_BASE_URL, HTTP_TIMEOUT_MS } from '../../core/config/api.config';
import {
  ClienteSocio,
  CrearCliente,
  EntidadFinanciera,
  PrecioRequest,
  PrecioVenta,
  TipoDocumento,
  VentaCreada,
  VentaRequest,
} from './venta.models';

@Injectable({ providedIn: 'root' })
export class VentasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(BFF_BASE_URL).replace(/\/+$/, '')}/v1/socio`;

  async buscar(
    criterio: { correo: string } | { tipoDocumento: TipoDocumento; numeroDocumento: string },
  ): Promise<ClienteSocio | null> {
    try {
      return await firstValueFrom(
        this.http
          .get<ClienteSocio>(`${this.base}/clientes`, {
            params: new HttpParams({ fromObject: criterio }),
          })
          .pipe(timeout(HTTP_TIMEOUT_MS)),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }
  }
  entidades(): Promise<EntidadFinanciera[]> {
    return firstValueFrom(
      this.http
        .get<EntidadFinanciera[]>(`${this.base}/entidades-financieras`, {
          params: { mercado: 'CO' },
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  crearCliente(cuerpo: CrearCliente, clave: string): Promise<ClienteSocio> {
    return firstValueFrom(
      this.http
        .post<ClienteSocio>(`${this.base}/clientes`, cuerpo, {
          headers: { 'Idempotency-Key': clave },
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  precio(cuerpo: PrecioRequest): Promise<PrecioVenta> {
    return firstValueFrom(
      this.http
        .post<PrecioVenta>(`${this.base}/ventas/precio`, cuerpo)
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
  vender(cuerpo: VentaRequest, clave: string): Promise<VentaCreada> {
    return firstValueFrom(
      this.http
        .post<VentaCreada>(`${this.base}/ventas`, cuerpo, {
          headers: { 'Idempotency-Key': clave },
        })
        .pipe(timeout(HTTP_TIMEOUT_MS)),
    );
  }
}
