import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { VentasApiService } from './ventas-api.service';
import {
  ClienteSocio,
  CrearCliente,
  EntidadFinanciera,
  PrecioRequest,
  PrecioVenta,
  ProblemaVenta,
  TipoDocumento,
  VentaCreada,
  VentaRequest,
} from './venta.models';
import {
  documentoSinFormato,
  documentoValido,
  fechaNacimientoValida,
  MONEDA,
  montoValido,
  numeroMonetario,
  telefonoSinFormato,
  telefonoValido,
} from './venta-form.utils';

type Paso = 'buscar' | 'cliente' | 'venta' | 'creada';
interface Intento<T> {
  cuerpo: T;
  huella: string;
  clave: string;
}

@Component({
  selector: 'app-nueva-venta',
  imports: [ReactiveFormsModule],
  templateUrl: './nueva-venta.html',
  styleUrl: './nueva-venta.scss',
})
export class NuevaVenta {
  private readonly api = inject(VentasApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;
  private versionPrecio = 0;
  private firmaPrecio = '';
  private firmaSolicitada = '';
  private altaIntento: Intento<CrearCliente> | null = null;
  private ventaIntento: Intento<VentaRequest> | null = null;
  protected readonly paso = signal<Paso>('buscar');
  protected readonly ocupada = signal(false);
  protected readonly cotizando = signal(false);
  protected readonly cargandoBancos = signal(false);
  protected readonly errorBancos = signal('');
  protected readonly error = signal('');
  protected readonly camposError = signal<Record<string, string>>({});
  protected readonly inconsistente = signal(false);
  protected readonly reintentoVenta = signal(false);
  protected readonly cliente = signal<ClienteSocio | null>(null);
  protected readonly bancos = signal<EntidadFinanciera[]>([]);
  protected readonly precio = signal<PrecioVenta | null>(null);
  protected readonly emitida = signal<VentaCreada | null>(null);
  protected readonly moneda = (valor: number) => MONEDA.format(valor);
  protected readonly fecha = (valor: string) =>
    new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Bogota',
    }).format(new Date(valor));
  protected readonly tipos = [
    { valor: 'CC', nombre: 'C.C.' },
    { valor: 'CE', nombre: 'C.E.' },
    { valor: 'PA', nombre: 'Pasaporte' },
  ];
  protected readonly camposCliente = [
    { nombre: 'tipoDocumento', etiqueta: 'Tipo de documento', tipo: 'select' },
    { nombre: 'numeroDocumento', etiqueta: 'Número de documento', tipo: 'text' },
    { nombre: 'primerNombre', etiqueta: 'Nombres', tipo: 'text' },
    { nombre: 'primerApellido', etiqueta: 'Apellidos', tipo: 'text' },
    { nombre: 'fechaNacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date' },
    { nombre: 'telefono', etiqueta: 'Celular', tipo: 'tel' },
    { nombre: 'email', etiqueta: 'Correo', tipo: 'email' },
  ] as const;
  protected readonly busqueda = this.fb.nonNullable.group({
    tipoDocumento: ['CC' as TipoDocumento, Validators.pattern(/^(CC|CE|PA)$/)],
    numeroDocumento: ['', [documentoValido]],
    correo: ['', [Validators.email, Validators.maxLength(254)]],
  });
  protected readonly alta = this.fb.nonNullable.group({
    tipoDocumento: [
      'CC' as TipoDocumento,
      [Validators.required, Validators.pattern(/^(CC|CE|PA)$/)],
    ],
    numeroDocumento: ['', [Validators.required, documentoValido]],
    primerNombre: [
      '',
      [Validators.required, Validators.maxLength(60), Validators.pattern(/^[\p{L}\p{M} ]+$/u)],
    ],
    primerApellido: [
      '',
      [Validators.required, Validators.maxLength(60), Validators.pattern(/^[\p{L}\p{M} ]+$/u)],
    ],
    fechaNacimiento: ['', [Validators.required, fechaNacimientoValida]],
    telefono: ['', [Validators.required, telefonoValido]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  protected readonly venta = this.fb.nonNullable.group({
    entidadAcreedora: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    ],
    valorCredito: ['', [Validators.required, montoValido(10000000)]],
    plazoRestanteMeses: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(480), Validators.pattern(/^\d+$/)],
    ],
    cuotaMensual: ['', [Validators.required, montoValido(0.01)]],
    direccion: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/.*\S.*/)]],
    municipio: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/.*\S.*/)]],
    hogar: [false],
  });
  protected readonly hogarSeleccionado = signal(false);
  protected readonly vida = computed(() =>
    this.precio()?.coberturas.find((c) => c.codigo === 'VIDA'),
  );
  protected readonly hogar = computed(() =>
    this.precio()?.coberturas.find((c) => c.codigo === 'HOGAR'),
  );
  protected readonly seleccionadas = computed(
    () =>
      this.precio()?.coberturas.filter((c) => c.codigo === 'VIDA' || this.hogarSeleccionado()) ??
      [],
  );
  protected readonly prima = computed(() =>
    this.seleccionadas().reduce((total, c) => total + c.primaTotal, 0),
  );
  protected readonly iva = computed(() =>
    this.seleccionadas().reduce((total, c) => total + c.iva, 0),
  );

  constructor() {
    this.venta.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.hogarSeleccionado.set(this.venta.controls.hogar.value);
      const firma = JSON.stringify(this.cuerpoPrecio());
      if (firma !== this.firmaSolicitada && !this.reintentoVenta()) {
        this.versionPrecio++;
        this.precio.set(null);
        this.cotizando.set(false);
        this.error.set('');
        this.firmaSolicitada = firma;
      }
    });
    this.venta.valueChanges.pipe(debounceTime(350), takeUntilDestroyed()).subscribe(() => {
      if (this.paso() === 'venta' && !this.reintentoVenta() && !this.precio())
        void this.calcularPrecio();
    });
    this.destroyRef.onDestroy(() => {
      this.version++;
      this.versionPrecio++;
    });
  }

  protected hayCriterio(): boolean {
    return !!(
      this.busqueda.controls.numeroDocumento.value.trim() ||
      this.busqueda.controls.correo.value.trim()
    );
  }
  protected editarBusqueda(): void {
    this.inconsistente.set(false);
    this.camposError.set({});
    this.error.set('');
  }
  protected editarCliente(campo: string): void {
    this.camposError.update((actual) => {
      const copia = { ...actual };
      delete copia[campo];
      return copia;
    });
    if (!Object.keys(this.camposError()).length) this.error.set('');
  }
  protected tieneConflicto(): boolean {
    return Object.keys(this.camposError()).length > 0;
  }
  protected errorAlta(nombre: keyof typeof this.alta.controls): string {
    const control = this.alta.controls[nombre];
    return (
      this.camposError()[nombre] || (control.touched && control.invalid ? 'Revisa este campo.' : '')
    );
  }
  protected errorVenta(nombre: keyof typeof this.venta.controls): string {
    const control = this.venta.controls[nombre];
    return (
      this.camposError()[nombre] ||
      (control.touched && control.invalid
        ? nombre === 'valorCredito'
          ? 'El monto debe estar entre $10.000.000 y $1.000.000.000.000.'
          : nombre === 'plazoRestanteMeses'
            ? 'Ingresa entre 1 y 480 meses completos.'
            : nombre === 'cuotaMensual'
              ? 'Ingresa una cuota mayor que cero.'
              : 'Completa este campo correctamente.'
        : '')
    );
  }

  protected async buscar(): Promise<void> {
    if (this.ocupada() || this.inconsistente()) return;
    const datos = this.busqueda.getRawValue();
    this.busqueda.patchValue({
      numeroDocumento: documentoSinFormato(datos.numeroDocumento),
      correo: datos.correo.trim().toLowerCase(),
    });
    this.busqueda.markAllAsTouched();
    if (!this.hayCriterio() || this.busqueda.invalid) return;
    const { tipoDocumento, numeroDocumento, correo } = this.busqueda.getRawValue();
    const version = ++this.version;
    this.ocupada.set(true);
    this.error.set('');
    this.camposError.set({});
    try {
      const [porDocumento, porCorreo] = await Promise.all([
        numeroDocumento ? this.api.buscar({ tipoDocumento, numeroDocumento }) : null,
        correo ? this.api.buscar({ correo }) : null,
      ]);
      if (version !== this.version) return;
      if (numeroDocumento && correo && porDocumento?.id !== porCorreo?.id) {
        this.inconsistente.set(true);
        this.camposError.set(
          !porDocumento
            ? {
                numeroDocumento:
                  'No encontramos una cuenta con este documento que coincida con el correo.',
              }
            : {
                correo: porCorreo
                  ? 'Es de una cuenta distinta a la del documento'
                  : 'No encontramos una cuenta con este correo que coincida con el documento.',
              },
        );
        return;
      }
      const cliente = porDocumento ?? porCorreo;
      if (cliente) this.abrirVenta(cliente);
      else {
        this.alta.reset({ tipoDocumento, numeroDocumento, email: correo });
        this.altaIntento = null;
        this.paso.set('cliente');
      }
    } catch {
      if (version === this.version)
        this.error.set('No pudimos buscar al cliente. Inténtalo nuevamente.');
    } finally {
      if (version === this.version) this.ocupada.set(false);
    }
  }

  protected async crearCliente(): Promise<void> {
    if (this.ocupada() || this.tieneConflicto()) return;
    const d = this.alta.getRawValue();
    this.alta.patchValue({
      numeroDocumento: documentoSinFormato(d.numeroDocumento),
      primerNombre: d.primerNombre.trim(),
      primerApellido: d.primerApellido.trim(),
      email: d.email.trim().toLowerCase(),
      telefono: telefonoSinFormato(d.telefono),
    });
    this.alta.markAllAsTouched();
    if (this.alta.invalid) return;
    const cuerpo = this.alta.getRawValue();
    this.altaIntento = this.intento(cuerpo, this.altaIntento);
    const version = ++this.version;
    this.ocupada.set(true);
    this.error.set('');
    try {
      const cliente = await this.api.crearCliente(cuerpo, this.altaIntento.clave);
      if (version === this.version) this.abrirVenta(cliente);
    } catch (error) {
      if (version !== this.version) return;
      this.aplicarErrores(error);
      this.error.set(
        error instanceof HttpErrorResponse && error.status === 409
          ? 'Ese documento o ese correo ya pertenece a otra cuenta. Búscala en Nueva venta.'
          : 'No pudimos crear al cliente. Revisa los datos e inténtalo nuevamente.',
      );
    } finally {
      if (version === this.version) this.ocupada.set(false);
    }
  }

  private abrirVenta(cliente: ClienteSocio): void {
    if (cliente.estado !== 'ACTIVO') {
      this.error.set(
        'El cliente no está activo en Solventa. No puedes crear una póliza para esta cuenta.',
      );
      return;
    }
    if (this.cliente()?.id !== cliente.id) this.venta.reset();
    this.cliente.set(cliente);
    this.error.set('');
    this.camposError.set({});
    this.precio.set(null);
    this.ventaIntento = null;
    this.reintentoVenta.set(false);
    this.paso.set('venta');
    if (!this.bancos().length) void this.cargarBancos();
    void this.calcularPrecio();
  }

  protected async cargarBancos(): Promise<void> {
    if (this.cargandoBancos()) return;
    this.cargandoBancos.set(true);
    this.errorBancos.set('');
    try {
      const bancos = await this.api.entidades();
      if (!this.destroyRef.destroyed) {
        this.bancos.set(bancos);
        if (!bancos.length) this.errorBancos.set('No hay bancos disponibles. Inténtalo más tarde.');
      }
    } catch {
      if (!this.destroyRef.destroyed)
        this.errorBancos.set('No pudimos cargar los bancos. Inténtalo nuevamente.');
    } finally {
      this.cargandoBancos.set(false);
    }
  }

  private cuerpoPrecio(): PrecioRequest | null {
    const cliente = this.cliente();
    const { entidadAcreedora, valorCredito, plazoRestanteMeses } = this.venta.controls;
    if (!cliente || entidadAcreedora.invalid || valorCredito.invalid || plazoRestanteMeses.invalid)
      return null;
    return {
      clienteId: cliente.id,
      entidadAcreedora: entidadAcreedora.value,
      valorCredito: numeroMonetario(valorCredito.value),
      plazoRestanteMeses: Number(plazoRestanteMeses.value),
    };
  }

  protected formatearMonto(campo: 'valorCredito' | 'cuotaMensual'): void {
    const control = this.venta.controls[campo];
    const valor = numeroMonetario(control.value);
    if (Number.isFinite(valor)) control.setValue(MONEDA.format(valor));
  }

  protected async calcularPrecio(): Promise<void> {
    const cuerpo = this.cuerpoPrecio();
    if (!cuerpo || this.paso() !== 'venta' || this.reintentoVenta()) return;
    const firma = JSON.stringify(cuerpo);
    if (this.cotizando() || (this.precio() && this.firmaPrecio === firma)) return;
    const version = ++this.versionPrecio;
    this.firmaSolicitada = firma;
    this.cotizando.set(true);
    this.error.set('');
    this.precio.set(null);
    try {
      const precio = await this.api.precio(cuerpo);
      if (version !== this.versionPrecio) return;
      if (
        !precio.coberturas.some((c) => c.codigo === 'VIDA') ||
        precio.coberturas.some((c) =>
          [c.primaNeta, c.iva, c.primaTotal, c.sumaAsegurada].some(
            (n) => !Number.isFinite(n) || n < 0,
          ),
        ) ||
        !Number.isFinite(Date.parse(precio.vigenciaCotizacion.hasta))
      )
        throw new Error('Precio incompleto');
      this.precio.set(precio);
      this.firmaPrecio = firma;
    } catch (error) {
      if (version === this.versionPrecio) {
        this.aplicarErrores(error);
        this.error.set(
          this.mensajeVenta(error, 'No pudimos calcular la prima. Inténtalo nuevamente.'),
        );
      }
    } finally {
      if (version === this.versionPrecio) this.cotizando.set(false);
    }
  }

  protected async crearPoliza(): Promise<void> {
    if (this.ocupada()) return;
    this.venta.markAllAsTouched();
    if (!this.reintentoVenta()) {
      const precio = this.precio();
      const cuerpoPrecio = this.cuerpoPrecio();
      if (
        this.venta.invalid ||
        !precio ||
        this.cotizando() ||
        !cuerpoPrecio ||
        JSON.stringify(cuerpoPrecio) !== this.firmaPrecio
      )
        return;
      if (Date.parse(precio.vigenciaCotizacion.hasta) <= Date.now()) {
        this.precio.set(null);
        await this.calcularPrecio();
        if (this.precio())
          this.error.set('La prima se actualizó. Revísala antes de crear la póliza.');
        return;
      }
      const d = this.venta.getRawValue();
      const cuerpo: VentaRequest = {
        ...cuerpoPrecio,
        cuotaMensual: numeroMonetario(d.cuotaMensual),
        direccion: d.direccion.trim(),
        municipio: d.municipio.trim(),
        coberturas: d.hogar && this.hogar() ? ['VIDA', 'HOGAR'] : ['VIDA'],
      };
      this.ventaIntento = this.intento(cuerpo, this.ventaIntento);
    }
    const intento = this.ventaIntento!;
    const version = ++this.version;
    this.ocupada.set(true);
    this.error.set('');
    this.camposError.set({});
    try {
      const poliza = await this.api.vender(intento.cuerpo, intento.clave);
      if (version !== this.version) return;
      if (poliza.estado !== 'EMITIDA' || !poliza.numero || !poliza.vigencia)
        throw new Error('Emisión sin confirmar');
      this.emitida.set(poliza);
      this.reintentoVenta.set(false);
      this.paso.set('creada');
    } catch (error) {
      if (version !== this.version) return;
      const incierto =
        !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
      this.reintentoVenta.set(incierto);
      this.aplicarErrores(error);
      const codigo =
        error instanceof HttpErrorResponse ? (error.error as ProblemaVenta | null)?.codigo : null;
      if (codigo === 'CLIENTE_NO_ACTIVO' || codigo === 'FUERA_DE_RANGO') this.precio.set(null);
      this.error.set(
        incierto
          ? 'No pudimos confirmar la emisión. Reintenta con los mismos datos para evitar una póliza duplicada.'
          : this.mensajeVenta(
              error,
              'No pudimos crear la póliza. Revisa los datos e inténtalo nuevamente.',
            ),
      );
    } finally {
      if (version === this.version) this.ocupada.set(false);
    }
  }

  private intento<T>(cuerpo: T, anterior: Intento<T> | null): Intento<T> {
    const huella = JSON.stringify(cuerpo);
    return anterior?.huella === huella ? anterior : { cuerpo, huella, clave: crypto.randomUUID() };
  }
  private aplicarErrores(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) return;
    const problema = error.error as ProblemaVenta | null;
    const campos: Record<string, string> = {};
    for (const e of problema?.errores ?? []) {
      const nombre = e.campo.split('.').pop()!;
      campos[nombre === 'correo' ? 'email' : nombre === 'documento' ? 'numeroDocumento' : nombre] =
        error.status === 409 ? 'Ya pertenece a otra cuenta' : e.mensaje;
    }
    this.camposError.set(campos);
  }
  private mensajeVenta(error: unknown, generico: string): string {
    const codigo =
      error instanceof HttpErrorResponse ? (error.error as ProblemaVenta | null)?.codigo : null;
    return codigo === 'CLIENTE_NO_ACTIVO'
      ? 'El cliente no está activo en Solventa. No puedes crear una póliza para esta cuenta.'
      : codigo === 'FUERA_DE_RANGO'
        ? 'El cliente debe tener entre 18 y 65 años y el crédito debe terminar antes de superar los 75 años.'
        : generico;
  }
  protected volver(): void {
    if (this.ocupada() || this.reintentoVenta()) return;
    this.version++;
    this.versionPrecio++;
    this.cotizando.set(false);
    this.error.set('');
    this.camposError.set({});
    this.precio.set(null);
    this.paso.set('buscar');
  }
  protected nuevaVenta(): void {
    this.version++;
    this.versionPrecio++;
    this.busqueda.reset();
    this.alta.reset();
    this.venta.reset();
    this.cliente.set(null);
    this.precio.set(null);
    this.emitida.set(null);
    this.error.set('');
    this.camposError.set({});
    this.inconsistente.set(false);
    this.reintentoVenta.set(false);
    this.cotizando.set(false);
    this.altaIntento = null;
    this.ventaIntento = null;
    this.paso.set('buscar');
  }
}
