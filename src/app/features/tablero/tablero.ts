import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiniestrosApiService } from '../siniestros/siniestros-api.service';
import { esSiniestroPorDecidir } from '../siniestros/siniestros.models';
import { cargarBandejaSolicitudes } from '../solicitudes/cargar-bandeja-solicitudes';
import { SolicitudesApiService } from '../solicitudes/solicitudes-api.service';

type Conteo = number | 'Cargando…' | 'No disponible';

const formatoCorte = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

@Component({
  selector: 'app-tablero',
  imports: [RouterLink],
  template: ` <h1>Lo que hay por decidir</h1>
    <p class="page-intro" role="status">{{ corte() }}</p>
    <div class="summary-grid">
      <a class="summary-card" routerLink="/solicitudes">
        <h2>SOLICITUDES EN REVISIÓN</h2>
        <p class="count" [class.count-status]="typeof solicitudes() !== 'number'">
          {{ solicitudes() }}
        </p>
        <span class="card-action"
          >Ver la bandeja <span class="chevron" aria-hidden="true"></span
        ></span>
      </a>
      <a class="summary-card" routerLink="/siniestros">
        <h2>SINIESTROS EN ESTUDIO</h2>
        <p class="count" [class.count-status]="typeof siniestros() !== 'number'">
          {{ siniestros() }}
        </p>
        <span class="card-action"
          >Ver la bandeja <span class="chevron" aria-hidden="true"></span
        ></span>
      </a>
    </div>
    @if (!cargando() && (solicitudes() === 'No disponible' || siniestros() === 'No disponible')) {
      <button type="button" class="retry" (click)="cargar()">Volver a intentar</button>
    }`,
  styles: `
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
      margin-top: 24px;
    }
    .summary-card {
      background: var(--mat-sys-on-primary);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 24px;
      color: inherit;
      text-decoration: none;
    }
    .summary-card:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 3px;
    }
    h2 {
      margin: 0;
      font-size: 12px;
      line-height: 16px;
      color: var(--mat-sys-outline);
      font-weight: 600;
    }
    .count {
      font-size: 40px;
      line-height: 48px;
      margin: 4px 0 12px;
      font-weight: 700;
    }
    .count-status {
      font-size: 16px;
    }
    .card-action {
      color: var(--mat-sys-primary);
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .summary-card:hover .card-action {
      text-decoration: underline;
    }
    .retry {
      margin-top: 16px;
    }
    .chevron {
      display: inline-block;
      width: 16px;
      height: 16px;
      background: currentColor;
      mask: url('/assets/icons/chevron-right.svg') center / contain no-repeat;
    }
    @media (max-width: 700px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Tablero implements OnInit, OnDestroy {
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly siniestrosApi = inject(SiniestrosApiService);
  private activo = true;
  readonly cargando = signal(true);
  readonly corte = signal('Consultando las bandejas…');
  readonly solicitudes = signal<Conteo>('Cargando…');
  readonly siniestros = signal<Conteo>('Cargando…');

  ngOnInit(): void {
    void this.cargar();
  }

  ngOnDestroy(): void {
    this.activo = false;
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.corte.set('Consultando las bandejas…');
    this.solicitudes.set('Cargando…');
    this.siniestros.set('Cargando…');
    const [solicitudes, siniestros] = await Promise.allSettled([
      cargarBandejaSolicitudes(this.solicitudesApi, () => this.activo),
      this.siniestrosApi.bandeja(false),
    ]);
    if (!this.activo) return;

    this.solicitudes.set(
      solicitudes.status === 'fulfilled' && !solicitudes.value.some((fila) => fila.errorDetalle)
        ? solicitudes.value.length
        : 'No disponible',
    );
    this.siniestros.set(
      siniestros.status === 'fulfilled'
        ? siniestros.value.filter(esSiniestroPorDecidir).length
        : 'No disponible',
    );
    this.corte.set(
      this.solicitudes() === 'No disponible' || this.siniestros() === 'No disponible'
        ? 'No se pudo completar la consulta.'
        : `Corte al ${formatoCorte.format(new Date())}`,
    );
    this.cargando.set(false);
  }
}
