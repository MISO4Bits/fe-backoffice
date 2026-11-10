import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SolicitudesApiService } from './solicitudes-api.service';
import { RechazarSolicitud } from './rechazar-solicitud';
import {
  DecisionSolicitud,
  esPendienteAgente,
  EvidenciaSolicitud,
  fechaSolicitud,
  nombrePendiente,
  PendienteAgente,
  SolicitudDetalle,
} from './solicitudes.models';

@Component({
  selector: 'app-detalle-solicitud',
  imports: [RouterLink, RechazarSolicitud],
  templateUrl: './detalle-solicitud.html',
  styleUrl: './detalle-solicitud.scss',
})
export class DetalleSolicitud implements OnInit, OnDestroy {
  private readonly api = inject(SolicitudesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private suscripcion?: Subscription;
  private version = 0;
  private id = '';
  private reloj?: ReturnType<typeof setInterval>;
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly rechazo = signal(false);
  readonly seleccionados = signal<PendienteAgente[]>([]);
  readonly ahora = signal(Date.now());
  readonly agentes = computed(() => this.solicitud()?.pendientes.filter(esPendienteAgente) ?? []);
  readonly motivos = computed(() => this.agentes().map((p) => p.codigo));
  readonly identidad = computed(() => this.motivos().includes('EVIDENCIA_EN_REVISION'));
  readonly vencida = computed(() => {
    const hasta = this.solicitud()?.solicitudVigenteHasta;
    return !!hasta && Date.parse(hasta) <= this.ahora();
  });
  readonly puedeDecidir = computed(
    () =>
      !this.cargando() &&
      !this.enviando() &&
      !this.error() &&
      !this.vencida() &&
      this.solicitud()?.estado === 'PENDIENTE' &&
      this.agentes().length > 0,
  );
  readonly imagenes = signal<Record<string, { url?: string; error?: string; cargando?: boolean }>>(
    {},
  );
  readonly ampliada = signal<{ url: string; titulo: string } | null>(null);
  private readonly visor = viewChild<ElementRef<HTMLDialogElement>>('visor');
  readonly fecha = fechaSolicitud;
  readonly nombre = nombrePendiente;
  readonly moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
  readonly caras = [
    { tipo: 'cedula_frente', titulo: 'Frente de la cédula' },
    { tipo: 'cedula_reverso', titulo: 'Reverso de la cédula' },
    { tipo: 'selfie', titulo: 'Selfie' },
  ] as const;
  ngOnInit(): void {
    this.suscripcion = this.route.paramMap.subscribe((params) => {
      this.id = params.get('id') ?? '';
      void this.cargar();
    });
    this.reloj = setInterval(() => this.ahora.set(Date.now()), 1000);
  }
  ngOnDestroy(): void {
    this.version++;
    this.suscripcion?.unsubscribe();
    clearInterval(this.reloj);
    this.liberarImagenes();
  }
  private liberarImagenes(): void {
    for (const imagen of Object.values(this.imagenes()))
      if (imagen.url) URL.revokeObjectURL(imagen.url);
    this.imagenes.set({});
    this.ampliada.set(null);
    this.visor()?.nativeElement.close();
  }
  async cargar(): Promise<void> {
    const version = ++this.version;
    this.rechazo.set(false);
    this.liberarImagenes();
    this.seleccionados.set([]);
    this.error.set('');
    this.solicitud.set(this.api.cache(this.id) ?? null);
    this.cargando.set(true);
    try {
      const solicitud = await this.api.detalle(this.id);
      if (version !== this.version) return;
      this.solicitud.set(solicitud);
      this.ahora.set(Date.now());
      if (solicitud.estado !== 'PENDIENTE' || this.vencida() || !this.agentes().length) {
        await this.volver(
          this.vencida() || solicitud.estado === 'VENCIDA'
            ? 'La solicitud venció. Actualizamos la bandeja.'
            : 'La solicitud ya no espera tu revisión. Actualizamos la bandeja.',
        );
        return;
      }
      if (this.identidad())
        for (const evidencia of solicitud.evidencias)
          if (evidencia.evidenciaId) void this.cargarImagen(evidencia, version);
    } catch (error) {
      if (version !== this.version) return;
      if (error instanceof HttpErrorResponse && [404, 409, 410].includes(error.status))
        await this.volver(
          'La solicitud ya no está disponible para revisión. Actualizamos la bandeja.',
        );
      else this.error.set('No pudimos consultar la solicitud. Vuelve a intentar.');
    } finally {
      if (version === this.version) this.cargando.set(false);
    }
  }
  evidencia(tipo: EvidenciaSolicitud['tipo']): EvidenciaSolicitud | undefined {
    return this.solicitud()?.evidencias.find((e) => e.tipo === tipo);
  }
  estadoEvidencia(evidencia?: EvidenciaSolicitud): string {
    return !evidencia
      ? 'No disponible'
      : { ACEPTADA: 'Se ve bien', REVISION_MANUAL: 'En revisión manual', PENDIENTE: 'Pendiente' }[
          evidencia.estado
        ];
  }
  async cargarImagen(evidencia: EvidenciaSolicitud, version = this.version): Promise<void> {
    const id = evidencia.evidenciaId;
    if (!id || this.imagenes()[id]?.cargando) return;
    const anterior = this.imagenes()[id]?.url;
    if (anterior) URL.revokeObjectURL(anterior);
    this.imagenes.update((img) => ({ ...img, [id]: { cargando: true } }));
    try {
      const blob = await this.api.imagen(this.id, id);
      if (version !== this.version) return;
      if (!['image/jpeg', 'image/png'].includes(blob.type)) throw new Error('Formato no admitido');
      this.imagenes.update((img) => ({ ...img, [id]: { url: URL.createObjectURL(blob) } }));
    } catch {
      if (version === this.version)
        this.imagenes.update((img) => ({
          ...img,
          [id]: { error: 'No pudimos cargar la imagen.' },
        }));
    }
  }
  ampliar(url: string, titulo: string): void {
    this.ampliada.set({ url, titulo });
    this.visor()?.nativeElement.showModal();
  }
  cerrarImagen(): void {
    this.visor()?.nativeElement.close();
    this.ampliada.set(null);
  }
  marcar(codigo: PendienteAgente, marcado: boolean): void {
    if (!this.puedeDecidir() || !this.motivos().includes(codigo)) return;
    this.seleccionados.update((actual) =>
      marcado ? [...new Set([...actual, codigo])] : actual.filter((p) => p !== codigo),
    );
  }
  aprobar(): Promise<void> {
    const pendientes = this.seleccionados().filter((p) => this.motivos().includes(p));
    return pendientes.length
      ? this.decidir({ decision: 'APROBAR', pendientes })
      : Promise.resolve();
  }
  rechazar(motivo: PendienteAgente): Promise<void> {
    return this.motivos().includes(motivo)
      ? this.decidir({ decision: 'RECHAZAR', motivo })
      : Promise.resolve();
  }
  private async decidir(decision: DecisionSolicitud): Promise<void> {
    this.ahora.set(Date.now());
    if (this.vencida()) {
      await this.volver('La solicitud venció. Actualizamos la bandeja.');
      return;
    }
    if (!this.puedeDecidir()) return;
    const version = this.version;
    this.enviando.set(true);
    this.rechazo.set(false);
    this.error.set('');
    try {
      const resultado = await this.api.decidir(this.id, decision);
      if (version !== this.version) return;
      await this.volver(
        decision.decision === 'RECHAZAR'
          ? 'Solicitud rechazada.'
          : resultado.estado === 'EMITIDA'
            ? 'Solicitud aprobada. La póliza fue emitida.'
            : 'Pendientes verificados. Actualizamos la bandeja.',
      );
    } catch (error) {
      if (version !== this.version) return;
      if (error instanceof HttpErrorResponse && [404, 409, 410, 422].includes(error.status)) {
        await this.volver(
          error.error?.codigo === 'SOLICITUD_VENCIDA'
            ? 'La solicitud venció. Actualizamos la bandeja.'
            : 'La solicitud cambió o ya fue decidida. Actualizamos la bandeja.',
        );
      } else if (
        !(error instanceof HttpErrorResponse) ||
        error.status === 0 ||
        error.status >= 500
      ) {
        await this.volver(
          'No pudimos confirmar el resultado de la decisión. Actualizamos la bandeja: comprueba el estado antes de decidir de nuevo.',
        );
      } else
        this.error.set(
          'No pudimos registrar la decisión. Consulta la solicitud de nuevo antes de continuar.',
        );
    } finally {
      if (version === this.version) this.enviando.set(false);
    }
  }
  volver(aviso = ''): Promise<boolean> {
    return this.router.navigate(['/solicitudes'], { state: { aviso } });
  }
  fechaHora(valor: string): string {
    return `${this.fecha(valor)}, ${new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(valor))}`;
  }
}
