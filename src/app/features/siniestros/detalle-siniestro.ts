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
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SiniestrosApiService } from './siniestros-api.service';
import {
  ArchivoSiniestro,
  DecisionSiniestro,
  fechaHoraSiniestro,
  fechaSiniestro,
  monedaSiniestro,
  SiniestroDetalle,
  tipoSiniestro,
} from './siniestros.models';

type Modal = 'pagar' | 'evidencia' | 'rechazar';

@Component({
  selector: 'app-detalle-siniestro',
  templateUrl: './detalle-siniestro.html',
  styleUrl: './detalle-siniestro.scss',
})
export class DetalleSiniestro implements OnInit, OnDestroy {
  private readonly api = inject(SiniestrosApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private suscripcion?: Subscription;
  private version = 0;
  private id = '';
  readonly siniestro = signal<SiniestroDetalle | null>(null);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly modal = signal<Modal | null>(null);
  readonly texto = signal('');
  readonly dano = signal<'REPARABLE' | 'PERDIDA_TOTAL'>('REPARABLE');
  readonly valor = signal<number | null>(null);
  readonly imagenes = signal<Record<string, { url?: string; error?: string; cargando?: boolean }>>(
    {},
  );
  readonly ampliada = signal<{ url: string; titulo: string } | null>(null);
  readonly visor = viewChild<ElementRef<HTMLDialogElement>>('visor');
  readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  readonly fecha = fechaSiniestro;
  readonly fechaHora = fechaHoraSiniestro;
  readonly moneda = monedaSiniestro;
  readonly tipo = tipoSiniestro;
  readonly puedeDecidir = computed(() => {
    const s = this.siniestro();
    return (
      !!s &&
      !s.automatico &&
      s.estado === 'EN_ESTUDIO' &&
      !this.cargando() &&
      !this.enviando() &&
      !this.error() &&
      (!s.fechaLimite || Date.parse(s.fechaLimite) > Date.now())
    );
  });
  readonly posteriores = computed(() => {
    const s = this.siniestro();
    if (!s?.evidenciaPedida) return [];
    const pedido = Date.parse(s.evidenciaPedida.pedidaEn);
    return s.archivos.filter((a) => Date.parse(a.entregadoEn) > pedido);
  });
  readonly iniciales = computed(() => {
    const s = this.siniestro();
    const posteriores = new Set(this.posteriores().map((a) => a.id));
    return s?.archivos.filter((a) => !posteriores.has(a.id)) ?? [];
  });
  readonly fotos = computed(() => this.iniciales().filter((a) => a.clase === 'FOTO'));
  readonly documentos = computed(() => this.iniciales().filter((a) => a.clase === 'DOCUMENTO'));
  readonly valorValido = computed(() => {
    const s = this.siniestro();
    const valor = this.valor();
    return (
      !!s &&
      valor !== null &&
      Number.isFinite(valor) &&
      valor > 0 &&
      valor <= s.poliza.sumaAsegurada
    );
  });
  readonly orden = computed(() => {
    const s = this.siniestro();
    if (!s) return [];
    if (s.tipo === 'INCAPACIDAD_TOTAL')
      return [{ beneficiario: s.saldoCredito.entidad, valor: s.saldoCredito.valor }];
    const valor = this.valor() ?? 0;
    if (this.dano() === 'REPARABLE') return [{ beneficiario: 'Cliente', valor }];
    const banco = Math.min(valor, s.saldoCredito.valor);
    return [
      { beneficiario: s.saldoCredito.entidad, valor: banco },
      ...(valor > banco ? [{ beneficiario: 'Cliente', valor: valor - banco }] : []),
    ];
  });
  ngOnInit(): void {
    this.suscripcion = this.route.paramMap.subscribe((p) => {
      this.id = p.get('id') ?? '';
      void this.cargar();
    });
  }
  ngOnDestroy(): void {
    this.version++;
    this.suscripcion?.unsubscribe();
    this.liberarImagenes();
  }
  private liberarImagenes(): void {
    for (const item of Object.values(this.imagenes())) if (item.url) URL.revokeObjectURL(item.url);
    this.imagenes.set({});
    this.ampliada.set(null);
    this.visor()?.nativeElement.close();
  }
  async cargar(): Promise<void> {
    const version = ++this.version;
    this.liberarImagenes();
    this.siniestro.set(null);
    this.error.set('');
    this.cargando.set(true);
    try {
      const siniestro = await this.api.detalle(this.id);
      if (version !== this.version) return;
      this.siniestro.set(siniestro);
      for (const archivo of siniestro.archivos) void this.cargarImagen(archivo, version);
    } catch (error) {
      if (version !== this.version) return;
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 404
          ? 'El siniestro no está disponible.'
          : 'No pudimos consultar el siniestro. Vuelve a intentar.',
      );
    } finally {
      if (version === this.version) this.cargando.set(false);
    }
  }
  async cargarImagen(archivo: ArchivoSiniestro, version = this.version): Promise<void> {
    if (this.imagenes()[archivo.id]?.cargando || this.imagenes()[archivo.id]?.url) return;
    this.imagenes.update((actual) => ({ ...actual, [archivo.id]: { cargando: true } }));
    try {
      const blob = await this.api.imagen(this.id, archivo.id);
      if (version !== this.version) return;
      if (!['image/jpeg', 'image/png'].includes(blob.type)) throw new Error('Formato no admitido');
      this.imagenes.update((actual) => ({
        ...actual,
        [archivo.id]: { url: URL.createObjectURL(blob) },
      }));
    } catch {
      if (version === this.version)
        this.imagenes.update((actual) => ({
          ...actual,
          [archivo.id]: { error: 'No pudimos cargar la imagen.' },
        }));
    }
  }
  abrirImagen(archivo: ArchivoSiniestro, titulo: string): void {
    const url = this.imagenes()[archivo.id]?.url;
    if (!url) return;
    this.ampliada.set({ url, titulo });
    this.visor()?.nativeElement.showModal();
  }
  cerrarImagen(): void {
    this.visor()?.nativeElement.close();
    this.ampliada.set(null);
  }
  abrirModal(tipo: Modal): void {
    if (!this.puedeDecidir()) return;
    this.modal.set(tipo);
    this.texto.set('');
    this.dano.set('REPARABLE');
    this.valor.set(null);
    queueMicrotask(() => this.dialogo()?.nativeElement.showModal());
  }
  cerrarModal(): void {
    this.dialogo()?.nativeElement.close();
    this.modal.set(null);
  }
  async confirmar(event: Event): Promise<void> {
    event.preventDefault();
    const s = this.siniestro();
    const modal = this.modal();
    if (!s || !modal || !this.puedeDecidir()) return;
    let decision: DecisionSiniestro;
    if (modal === 'pagar') {
      if (s.tipo === 'INCAPACIDAD_TOTAL') decision = { decision: 'PAGAR' };
      else {
        if (!this.valorValido()) return;
        decision = { decision: 'PAGAR', dano: this.dano(), valor: this.valor()! };
      }
    } else {
      const texto = this.texto().trim();
      if (!texto || texto.length > 2000) return;
      decision =
        modal === 'evidencia'
          ? { decision: 'PEDIR_EVIDENCIA', detalle: texto }
          : { decision: 'RECHAZAR', motivo: texto };
    }
    const version = this.version;
    this.enviando.set(true);
    this.error.set('');
    try {
      const respuesta = await this.api.decidir(this.id, decision);
      if (version !== this.version) return;
      this.cerrarModal();
      await this.volver(
        respuesta.estado === 'PAGADO'
          ? 'Siniestro pagado.'
          : respuesta.estado === 'RECHAZADO'
            ? 'Siniestro rechazado.'
            : 'Solicitud de evidencia registrada.',
      );
    } catch (error) {
      if (version !== this.version) return;
      this.cerrarModal();
      if (error instanceof HttpErrorResponse && [404, 409, 410, 422].includes(error.status)) {
        await this.volver('El siniestro cambió o ya fue decidido. Actualizamos la bandeja.');
      } else if (
        !(error instanceof HttpErrorResponse) ||
        error.status === 0 ||
        error.status >= 500
      ) {
        await this.volver(
          'No pudimos confirmar el resultado. Revisa el estado antes de decidir otra vez.',
        );
      } else this.error.set('No pudimos registrar la decisión. Vuelve a consultar el siniestro.');
    } finally {
      if (version === this.version) this.enviando.set(false);
    }
  }
  volver(aviso = ''): Promise<boolean> {
    return this.router.navigate(['/siniestros'], {
      queryParams:
        this.route.snapshot.queryParamMap.get('automatico') === 'true' ? { automatico: true } : {},
      state: { aviso },
    });
  }
  destino(): string {
    const d = this.siniestro()?.destinoPago;
    if (!d) return 'No disponible';
    if (d['tipo'] === 'CHEQUE' && d['oficina'] && typeof d['oficina'] === 'object') {
      const oficina = d['oficina'] as Record<string, unknown>;
      return (
        [oficina['banco'], oficina['nombre'], oficina['direccion']]
          .filter((dato): dato is string => typeof dato === 'string' && !!dato)
          .join(', ') || 'Oficina registrada'
      );
    }
    const banco = typeof d['banco'] === 'string' ? d['banco'] : '';
    const cuenta = typeof d['numeroCuenta'] === 'string' ? d['numeroCuenta'] : '';
    return (
      [banco, cuenta ? `****${cuenta.slice(-4)}` : ''].filter(Boolean).join(', ') ||
      'Destino registrado'
    );
  }
  medio(): string {
    const tipo = this.siniestro()?.destinoPago?.['tipo'];
    return typeof tipo === 'string'
      ? tipo.charAt(0) + tipo.slice(1).toLowerCase()
      : 'No disponible';
  }
}
