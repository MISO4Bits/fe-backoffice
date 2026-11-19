import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Estado } from '../../shared/estado/estado';
import { monedaSiniestro, fechaSiniestro } from '../siniestros/siniestros.models';
import { EstadoPoliza, PolizasDelSocio, PolizasSocioApiService } from './polizas-socio-api.service';

const fechaCorte = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});
const fechaFiltro = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'America/Bogota',
});
const etiquetas: Record<EstadoPoliza, string> = {
  PENDIENTE: 'Pendiente',
  EMITIDA: 'Vigente',
  RECHAZADA: 'Rechazada',
  VENCIDA: 'Vencida',
  DESACTIVADA: 'Desactivada',
};

@Component({
  selector: 'app-polizas-socio',
  imports: [RouterLink, Estado],
  templateUrl: './polizas-socio.html',
  styleUrl: './polizas-socio.scss',
})
export class PolizasSocio implements OnInit {
  private readonly api = inject(PolizasSocioApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly tablero = this.route.snapshot.data['vista'] === 'tablero';
  readonly datos = signal<PolizasDelSocio | null>(null);
  readonly error = signal(false);
  readonly corte = computed(() => {
    const datos = this.datos();
    return datos ? fechaCorte.format(new Date(datos.consultadoEn)) : '';
  });
  readonly polizas = computed(() => this.datos()?.items ?? []);
  readonly renovaciones = computed(() => this.polizas().filter((p) => p.estado === 'DESACTIVADA'));
  readonly rechazadas = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('estado') === 'renovaciones')),
    { requireSync: true },
  );
  readonly busqueda = signal('');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly orden = signal('recientes');
  readonly pagina = signal(1);
  readonly tamano = 5;
  readonly filtradas = computed(() => {
    const texto = this.normalizar(this.busqueda().trim());
    const desde = this.desde();
    const hasta = this.hasta();
    const filas = this.rechazadas() ? this.renovaciones() : this.polizas();
    const sentido = this.orden() === 'recientes' ? -1 : 1;
    return filas
      .filter((p) => {
        if (
          texto &&
          ![p.cliente?.nombre, p.cliente?.ultimosDigitosDocumento].some(
            (valor) => valor && this.normalizar(valor).includes(texto),
          )
        )
          return false;
        if (!desde && !hasta) return true;
        const dia = fechaFiltro.format(new Date(p.creadaEn));
        return (!desde || dia >= desde) && (!hasta || dia <= hasta);
      })
      .sort((a, b) => sentido * (Date.parse(a.creadaEn) - Date.parse(b.creadaEn)));
  });
  readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtradas().length / this.tamano)));
  readonly paginaActual = computed(() => Math.min(this.pagina(), this.paginas()));
  readonly inicio = computed(() => (this.paginaActual() - 1) * this.tamano);
  readonly visibles = computed(() =>
    this.filtradas().slice(this.inicio(), this.inicio() + this.tamano),
  );
  readonly fecha = fechaSiniestro;
  readonly moneda = monedaSiniestro;
  readonly etiquetas = etiquetas;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.error.set(false);
    this.api
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.datos.set(datos),
        error: () => this.error.set(true),
      });
  }

  limpiar(): void {
    this.busqueda.set('');
    this.desde.set('');
    this.hasta.set('');
    this.orden.set('recientes');
    this.pagina.set(1);
  }

  cambiarEstado(estado: string): void {
    this.pagina.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: estado === 'renovaciones' ? { estado } : {},
    });
  }

  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }
}
