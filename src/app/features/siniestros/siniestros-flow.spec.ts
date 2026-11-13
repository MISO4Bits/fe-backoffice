import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { BandejaSiniestros } from './bandeja-siniestros';
import { DetalleSiniestro } from './detalle-siniestro';
import { SiniestrosApiService } from './siniestros-api.service';
import { SiniestroDetalle, SiniestroResumen } from './siniestros.models';

const resumen = (id: string, fechaLimite: string): SiniestroResumen => ({
  id,
  numero: `SIN-${id}`,
  polizaId: 'p-1',
  clienteId: 'c-1',
  tipo: 'INCENDIO_TERREMOTO',
  automatico: false,
  estado: 'EN_ESTUDIO',
  reportadoEn: '2026-11-01T10:00:00Z',
  actualizadoEn: '2026-11-01T10:00:00Z',
  fechaLimite,
});
const detalle = (tipo: SiniestroDetalle['tipo'] = 'INCAPACIDAD_TOTAL'): SiniestroDetalle => ({
  ...resumen('1', '2027-01-01T10:00:00Z'),
  tipo,
  fechaOcurrencia: '2026-11-01',
  ultimaEntregaEn: '2026-11-01T10:00:00Z',
  archivos: [],
  cliente: null,
  decisiones: [],
  poliza: {
    id: 'p-1',
    cobertura: tipo === 'INCAPACIDAD_TOTAL' ? 'VIDA' : 'HOGAR',
    sumaAsegurada: 250000000,
  },
  saldoCredito: {
    valor: 182400000,
    entidad: 'Bancolombia',
    consultadoEn: '2026-11-01T10:00:00Z',
    origen: 'OPEN_FINANCE',
  },
});

describe('Bandeja B30', () => {
  let fixture: ComponentFixture<BandejaSiniestros>;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const api = { bandeja: vi.fn(), detalle: vi.fn() };
  beforeEach(() => {
    api.bandeja.mockReset().mockResolvedValue([]);
    api.detalle.mockReset();
    parametros = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [BandejaSiniestros],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { queryParamMap: parametros } },
      ],
    });
    fixture = TestBed.createComponent(BandejaSiniestros);
  });
  afterEach(() => fixture.destroy());
  it('muestra el total y ordena por plazo, no por fecha de reporte', async () => {
    api.bandeja.mockResolvedValue([
      resumen('tarde', '2026-12-20T10:00:00Z'),
      resumen('pronto', '2026-11-20T10:00:00Z'),
    ]);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(fixture.componentInstance.filas().map((s) => s.id)).toEqual(['pronto', 'tarde']);
    expect(fixture.nativeElement.textContent).toContain('Mostrando 1 a 2 de 2 siniestros');
    expect(api.bandeja).toHaveBeenCalledWith(false);
  });
  it('pagina cinco por pantalla y permite cambiar de página', async () => {
    api.bandeja.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) =>
        resumen(`${i}`, `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      ),
    );
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(fixture.componentInstance.paginas()).toBe(2);
    expect(fixture.componentInstance.visibles()).toHaveLength(5);
    fixture.componentInstance.pagina.set(2);
    fixture.detectChanges();
    expect(fixture.componentInstance.visibles()).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Mostrando 6 a 7 de 7');
  });
  it('consulta el importe de pagos automáticos y no los mezcla con En estudio', async () => {
    const pagado = {
      ...resumen('auto', '2026-11-20T10:00:00Z'),
      automatico: true,
      estado: 'PAGADO',
    };
    api.bandeja.mockResolvedValue([pagado, resumen('normal', '2026-11-19T10:00:00Z')]);
    api.detalle.mockResolvedValue({
      ...detalle('SISMO_PARAMETRICO'),
      pago: {
        pagadoEn: pagado.actualizadoEn,
        lineas: [{ beneficiario: 'BANCO', valor: 1850000, destino: 'Bancolombia' }],
      },
    });
    parametros.next(convertToParamMap({ automatico: 'true' }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(api.bandeja).toHaveBeenCalledWith(true);
    expect(api.detalle).toHaveBeenCalledWith('auto');
    expect(fixture.componentInstance.filas().map((f) => f.id)).toEqual(['auto']);
    expect(fixture.nativeElement.textContent).toContain('1.850.000');
  });
  it('si falla el listado no presenta un total definitivo', async () => {
    api.bandeja.mockRejectedValue(new Error('red'));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toContain('No pudimos');
    expect(fixture.nativeElement.textContent).toContain('Total pendiente de confirmar');
  });
});

describe('Detalle B31 y B32V', () => {
  let fixture: ComponentFixture<DetalleSiniestro>;
  let router: Router;
  const api = { detalle: vi.fn(), imagen: vi.fn(), decidir: vi.fn() };
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      }),
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      }),
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:imagen'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    api.detalle.mockReset().mockResolvedValue(detalle());
    api.imagen.mockReset();
    api.decidir.mockReset().mockResolvedValue({ ...detalle(), estado: 'PAGADO' });
    TestBed.configureTestingModule({
      imports: [DetalleSiniestro],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 's-1' })),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DetalleSiniestro);
  });
  afterEach(() => fixture.destroy());
  it('paga incapacidad por el saldo guardado sin enviar valor ni daño', async () => {
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    const c = fixture.componentInstance;
    expect(c.orden()).toEqual([{ beneficiario: 'Bancolombia', valor: 182400000 }]);
    c.modal.set('pagar');
    await c.confirmar(new Event('submit'));
    expect(api.decidir).toHaveBeenCalledWith('s-1', { decision: 'PAGAR' });
    expect(router.navigate).toHaveBeenCalledWith(['/siniestros'], expect.any(Object));
  });
  it('permite decidir si el backend aún lo devuelve En estudio aunque la fecha límite haya pasado', async () => {
    api.detalle.mockResolvedValue({ ...detalle(), fechaLimite: '2020-01-01T00:00:00Z' });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(c.puedeDecidir()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Tu decisión');
    c.modal.set('pagar');
    await c.confirmar(new Event('submit'));
    expect(api.decidir).toHaveBeenCalledWith('s-1', { decision: 'PAGAR' });
  });
  it('limita el pago de hogar y divide pérdida total entre banco y cliente', async () => {
    api.detalle.mockResolvedValue(detalle('INCENDIO_TERREMOTO'));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    const c = fixture.componentInstance;
    c.modal.set('pagar');
    c.dano.set('PERDIDA_TOTAL');
    c.valor.set(250000001);
    await c.confirmar(new Event('submit'));
    expect(api.decidir).not.toHaveBeenCalled();
    c.valor.set(250000000);
    expect(c.orden()).toEqual([
      { beneficiario: 'Bancolombia', valor: 182400000 },
      { beneficiario: 'Cliente', valor: 67600000 },
    ]);
    await c.confirmar(new Event('submit'));
    expect(api.decidir).toHaveBeenCalledWith('s-1', {
      decision: 'PAGAR',
      dano: 'PERDIDA_TOTAL',
      valor: 250000000,
    });
  });
  it('no ofrece decisiones para un pago automático', async () => {
    api.detalle.mockResolvedValue({
      ...detalle('SISMO_PARAMETRICO'),
      automatico: true,
      estado: 'PAGADO',
      pago: {
        pagadoEn: '2026-11-02T10:00:00Z',
        lineas: [{ beneficiario: 'BANCO', destino: 'Bancolombia', valor: 1850000 }],
      },
    });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(fixture.componentInstance.puedeDecidir()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Orden de pago');
    expect(fixture.nativeElement.textContent).not.toContain('Tu decisión');
  });
  it('muestra la evidencia posterior al pedido y permite ampliarla', async () => {
    const s = detalle('INCENDIO_TERREMOTO');
    s.cliente = {
      id: 'c-1',
      nombre: 'Sofía Restrepo',
      tipoDocumento: 'CC',
      numeroDocumento: '1020340001',
    };
    s.evidenciaPedida = { detalle: 'Falta fachada', pedidaEn: '2026-11-02T10:00:00Z' };
    s.archivos = [
      {
        id: 'foto-1',
        clase: 'FOTO',
        capturadoEn: '2026-11-01T10:00:00Z',
        entregadoEn: '2026-11-01T11:00:00Z',
        latitud: 4.6,
        longitud: -74,
      },
      { id: 'doc-1', clase: 'DOCUMENTO', entregadoEn: '2026-11-03T11:00:00Z' },
    ];
    api.detalle.mockResolvedValue(s);
    api.imagen.mockResolvedValue(new Blob(['foto'], { type: 'image/png' }));
    fixture.detectChanges();
    await vi.waitFor(() =>
      expect(Object.keys(fixture.componentInstance.imagenes()).length).toBe(2),
    );
    await vi.waitFor(() =>
      expect(fixture.componentInstance.imagenes()['doc-1']?.url).toBe('blob:imagen'),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Falta fachada');
    expect(fixture.nativeElement.textContent).toContain('Lo que envió el cliente (1)');
    expect(fixture.nativeElement.textContent).toContain('Sofía Restrepo');
    const c = fixture.componentInstance;
    c.abrirImagen(s.archivos[1], 'Documento 1');
    expect(c.ampliada()?.titulo).toBe('Documento 1');
    c.cerrarImagen();
    expect(c.ampliada()).toBeNull();
  });
  it('envía el texto de evidencia y rechazo sin campos ajenos', async () => {
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    const c = fixture.componentInstance;
    c.modal.set('evidencia');
    c.texto.set('  Enviar foto legible  ');
    await c.confirmar(new Event('submit'));
    expect(api.decidir).toHaveBeenCalledWith('s-1', {
      decision: 'PEDIR_EVIDENCIA',
      detalle: 'Enviar foto legible',
    });
    api.decidir.mockClear();
    c.modal.set('rechazar');
    c.texto.set('  Fuera de cobertura  ');
    await c.confirmar(new Event('submit'));
    expect(api.decidir).toHaveBeenCalledWith('s-1', {
      decision: 'RECHAZAR',
      motivo: 'Fuera de cobertura',
    });
  });
  it('vuelve a la bandeja ante un conflicto concurrente', async () => {
    api.decidir.mockRejectedValue(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    const c = fixture.componentInstance;
    c.modal.set('rechazar');
    c.texto.set('No cubierto');
    await c.confirmar(new Event('submit'));
    expect(router.navigate).toHaveBeenCalledWith(
      ['/siniestros'],
      expect.objectContaining({ state: { aviso: expect.stringContaining('cambió') } }),
    );
  });
  it('muestra el destino de cheque y tolera datos opcionales ausentes', async () => {
    api.detalle.mockResolvedValue({
      ...detalle('INCENDIO_TERREMOTO'),
      destinoPago: {
        tipo: 'CHEQUE',
        oficina: { banco: 'BBVA', nombre: 'Centro', direccion: 'Calle 10' },
      },
    });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    const c = fixture.componentInstance;
    expect(c.medio()).toBe('Cheque');
    expect(c.destino()).toContain('BBVA, Centro, Calle 10');
    c.siniestro.set({ ...detalle(), destinoPago: null });
    expect(c.destino()).toBe('No disponible');
    expect(c.medio()).toBe('No disponible');
    expect(c.fecha(null)).toBe('No disponible');
    expect(c.fecha('fecha inválida')).toBe('No disponible');
    expect(c.fechaHora('2026-11-01')).toBe(c.fecha('2026-11-01'));
  });
});
