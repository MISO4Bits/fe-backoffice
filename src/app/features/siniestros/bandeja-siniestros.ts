import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SiniestrosApiService } from './siniestros-api.service';
import {
  fechaSiniestro,
  monedaSiniestro,
  SiniestroResumen,
  tipoSiniestro,
} from './siniestros.models';

@Component({
  selector: 'app-bandeja-siniestros',
  imports: [RouterLink],
  templateUrl: './bandeja-siniestros.html',
  styleUrl: './bandeja-siniestros.scss',
})
export class BandejaSiniestros implements OnInit, OnDestroy {
  private readonly api = inject(SiniestrosApiService);
  private readonly route = inject(ActivatedRoute);
  readonly automatico = signal(false);
  readonly filas = signal<SiniestroResumen[]>([]);
  readonly montos = signal<Record<string, number | null>>({});
  readonly fechasPago = signal<Record<string, string | null>>({});
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal(history.state?.aviso || '');
  readonly pagina = signal(1);
  readonly tamano = 5;
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filas().length / this.tamano)));
  readonly visibles = computed(() =>
    this.filas().slice((this.pagina() - 1) * this.tamano, this.pagina() * this.tamano),
  );
  readonly fecha = fechaSiniestro;
  readonly tipo = tipoSiniestro;
  readonly moneda = monedaSiniestro;
  private version = 0;
  private suscripcion?: Subscription;
  ngOnInit(): void {
    this.suscripcion = this.route.queryParamMap.subscribe((params) => {
      this.automatico.set(params.get('automatico') === 'true');
      void this.cargar();
    });
  }
  ngOnDestroy(): void {
    this.version++;
    this.suscripcion?.unsubscribe();
  }
  async cargar(): Promise<void> {
    const version = ++this.version;
    this.cargando.set(true);
    this.error.set('');
    this.filas.set([]);
    this.montos.set({});
    this.fechasPago.set({});
    this.pagina.set(1);
    try {
      const automatico = this.automatico();
      const filas = (await this.api.bandeja(automatico)).filter((fila) =>
        automatico
          ? fila.automatico && fila.estado === 'PAGADO'
          : !fila.automatico && fila.estado === 'EN_ESTUDIO',
      );
      if (version !== this.version) return;
      this.filas.set(
        filas.sort((a, b) => {
          if (automatico)
            return (
              Date.parse(b.actualizadoEn) - Date.parse(a.actualizadoEn) ||
              a.numero.localeCompare(b.numero)
            );
          const fa = a.fechaLimite ? Date.parse(a.fechaLimite) : Infinity;
          const fb = b.fechaLimite ? Date.parse(b.fechaLimite) : Infinity;
          return fa - fb || a.numero.localeCompare(b.numero);
        }),
      );
      if (automatico) {
        let indice = 0;
        const completar = async () => {
          while (version === this.version && indice < filas.length) {
            const fila = filas[indice++];
            try {
              const detalle = await this.api.detalle(fila.id);
              if (version !== this.version) return;
              this.montos.update((actual) => ({
                ...actual,
                [fila.id]:
                  detalle.pago?.lineas.reduce((total, linea) => total + linea.valor, 0) ?? null,
              }));
              this.fechasPago.update((actual) => ({
                ...actual,
                [fila.id]: detalle.pago?.pagadoEn ?? null,
              }));
            } catch {
              if (version === this.version)
                this.montos.update((actual) => ({ ...actual, [fila.id]: null }));
              if (version === this.version)
                this.fechasPago.update((actual) => ({ ...actual, [fila.id]: null }));
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, filas.length) }, completar));
      }
    } catch {
      if (version === this.version)
        this.error.set('No pudimos cargar los siniestros. Vuelve a intentar.');
    } finally {
      if (version === this.version) this.cargando.set(false);
    }
  }
  intervalo(): string {
    const total = this.filas().length;
    return total
      ? `Mostrando ${(this.pagina() - 1) * this.tamano + 1} a ${Math.min(this.pagina() * this.tamano, total)} de ${total} siniestros`
      : 'Mostrando 0 siniestros';
  }
}
