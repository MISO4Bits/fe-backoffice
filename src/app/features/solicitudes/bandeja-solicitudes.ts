import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SolicitudesApiService } from './solicitudes-api.service';
import {
  esPendienteAgente,
  fechaSolicitud,
  FilaSolicitud,
  nombrePendiente,
} from './solicitudes.models';

@Component({
  selector: 'app-bandeja-solicitudes',
  imports: [RouterLink],
  templateUrl: './bandeja-solicitudes.html',
  styleUrl: './bandeja-solicitudes.scss',
})
export class BandejaSolicitudes implements OnInit, OnDestroy {
  private readonly api = inject(SolicitudesApiService);
  private readonly router = inject(Router);
  readonly filas = signal<FilaSolicitud[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal<string>(
    this.router.getCurrentNavigation()?.extras.state?.['aviso'] ?? '',
  );
  readonly pagina = signal(1);
  readonly tamano = 10;
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filas().length / this.tamano)));
  readonly visibles = computed(() =>
    this.filas().slice((this.pagina() - 1) * this.tamano, this.pagina() * this.tamano),
  );
  readonly fecha = fechaSolicitud;
  private version = 0;
  ngOnInit(): void {
    void this.cargar();
  }
  ngOnDestroy(): void {
    this.version++;
  }
  async cargar(): Promise<void> {
    const version = ++this.version;
    this.api.limpiar();
    this.cargando.set(true);
    this.error.set('');
    this.filas.set([]);
    this.pagina.set(1);
    const filas = new Map<string, FilaSolicitud>();
    const cursores = new Set<string>();
    try {
      let cursor: string | undefined;
      do {
        const resultado = await this.api.pagina(cursor);
        if (version !== this.version) return;
        for (const resumen of resultado.items) {
          if (resumen.estado === 'PENDIENTE' && resumen.pendientes.some(esPendienteAgente))
            filas.set(resumen.polizaId, { resumen });
        }
        this.publicar(filas);
        cursor = resultado.siguienteCursor || undefined;
        if (cursor && cursores.has(cursor)) throw new Error('Cursor repetido');
        if (cursor) cursores.add(cursor);
      } while (cursor);
      const pendientes = [...filas.values()];
      let indice = 0;
      const completar = async () => {
        while (version === this.version && indice < pendientes.length) {
          const fila = pendientes[indice++];
          try {
            const detalle = await this.api.detalle(fila.resumen.polizaId);
            if (version !== this.version) return;
            if (!this.api.esperaMiRevision(detalle)) filas.delete(detalle.polizaId);
            else filas.set(detalle.polizaId, { resumen: detalle, cliente: detalle.cliente });
          } catch {
            if (version === this.version)
              filas.set(fila.resumen.polizaId, { ...fila, errorDetalle: true });
          }
          if (version === this.version) this.publicar(filas);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, pendientes.length) }, completar));
    } catch {
      if (version === this.version)
        this.error.set(
          'No pudimos completar la bandeja. El listado y el total pueden estar incompletos. Vuelve a intentar.',
        );
    } finally {
      if (version === this.version) this.cargando.set(false);
    }
  }
  private publicar(filas: Map<string, FilaSolicitud>): void {
    this.filas.set(
      [...filas.values()].sort(
        (a, b) =>
          Date.parse(a.resumen.creadaEn) - Date.parse(b.resumen.creadaEn) ||
          a.resumen.polizaId.localeCompare(b.resumen.polizaId),
      ),
    );
    if (this.pagina() > this.paginas()) this.pagina.set(this.paginas());
  }
  async reintentar(fila: FilaSolicitud): Promise<void> {
    const version = this.version;
    try {
      const detalle = await this.api.detalle(fila.resumen.polizaId);
      if (version !== this.version) return;
      this.filas.update((filas) =>
        filas.flatMap((f) =>
          f.resumen.polizaId !== detalle.polizaId
            ? [f]
            : this.api.esperaMiRevision(detalle)
              ? [{ resumen: detalle, cliente: detalle.cliente }]
              : [],
        ),
      );
      this.pagina.set(Math.min(this.pagina(), this.paginas()));
    } catch {
      if (version === this.version)
        this.aviso.set(
          'No pudimos cargar los datos del cliente. Puedes abrir la solicitud o volver a intentar.',
        );
    }
  }
  pendientes(fila: FilaSolicitud): string {
    return fila.resumen.pendientes
      .filter(esPendienteAgente)
      .map((p) => nombrePendiente(p.codigo))
      .join(' y ');
  }
  documento(fila: FilaSolicitud): string {
    const c = fila.cliente;
    return c
      ? `${c.tipoDocumento === 'CC' ? 'C.C.' : c.tipoDocumento} ****${c.numeroDocumento.slice(-4)}`
      : 'No disponible';
  }
  espera(fecha: string): string {
    const dias = Math.max(0, Math.floor((Date.now() - Date.parse(fecha)) / 86400000));
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
}
