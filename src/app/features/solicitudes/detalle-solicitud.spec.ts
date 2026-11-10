import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { DetalleSolicitud } from './detalle-solicitud';
import { SolicitudesApiService } from './solicitudes-api.service';
import { solicitudEjemplo } from './testing/solicitud.fixtures';

describe('Detalle y decisiones B21 / B21A', () => {
  let fixture: ComponentFixture<DetalleSolicitud>;
  let api: {
    detalle: ReturnType<typeof vi.fn>;
    cache: ReturnType<typeof vi.fn>;
    imagen: ReturnType<typeof vi.fn>;
    decidir: ReturnType<typeof vi.fn>;
  };
  let navegar: ReturnType<typeof vi.spyOn>;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
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
      value: vi.fn().mockReturnValue('blob:prueba'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    api = {
      detalle: vi.fn().mockResolvedValue(solicitudEjemplo()),
      cache: vi.fn(),
      imagen: vi.fn().mockResolvedValue(new Blob(['foto'], { type: 'image/png' })),
      decidir: vi.fn().mockResolvedValue({ ...solicitudEjemplo(), estado: 'EMITIDA' }),
    };
    parametros = new BehaviorSubject(convertToParamMap({ id: 's-1' }));
    TestBed.configureTestingModule({
      imports: [DetalleSolicitud],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
        { provide: SolicitudesApiService, useValue: api },
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DetalleSolicitud);
  });
  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });
  async function abrir() {
    fixture.detectChanges();
    await vi.waitFor(() => expect(componente().cargando()).toBe(false));
    fixture.detectChanges();
  }
  const root = () => fixture.nativeElement as HTMLElement;
  const componente = () => fixture.componentInstance;
  const boton = (nombre: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === nombre,
    )!;
  it('muestra documento completo, crédito, origen, primas e historial', async () => {
    const s = solicitudEjemplo();
    s.decisiones = [
      {
        decision: 'APROBAR',
        agente: 'admin@solventa4bits.com',
        pendientes: ['CREDITO_NO_VERIFICADO'],
        decididaEn: s.creadaEn,
      },
      {
        decision: 'RECHAZAR',
        agente: 'otra@solventa4bits.com',
        pendientes: ['EVIDENCIA_EN_REVISION'],
        decididaEn: s.creadaEn,
      },
    ];
    s.pendientes.push({ codigo: 'CORREO_SIN_CONFIRMAR', tipo: 'USUARIO' });
    api.detalle.mockResolvedValue(s);
    await abrir();
    expect(root().textContent).toContain('1020340001');
    expect(root().textContent).toContain('Bancolombia');
    expect(root().textContent).toContain('declarados');
    expect(root().textContent).toContain('77.374');
    expect(root().textContent).toContain('admin@solventa4bits.com');
    expect(root().textContent).toContain('Rechazo');
    expect(root().textContent).toContain('Pendiente del cliente');
    expect(boton('Aprobar').disabled).toBe(true);
  });
  it('aprueba solo los marcados, bloquea doble envío y comunica la emisión', async () => {
    await abrir();
    componente().marcar('EVIDENCIA_EN_REVISION', true);
    componente().marcar('CREDITO_NO_VERIFICADO', true);
    componente().marcar('CREDITO_NO_VERIFICADO', false);
    componente().marcar('EVIDENCIA_EN_REVISION', true);
    let resolver!: (v: unknown) => void;
    api.decidir.mockImplementation(() => new Promise((r) => (resolver = r)));
    const p = componente().aprobar();
    await componente().aprobar();
    expect(api.decidir).toHaveBeenCalledOnce();
    expect(api.decidir).toHaveBeenCalledWith('s-1', {
      decision: 'APROBAR',
      pendientes: ['EVIDENCIA_EN_REVISION'],
    });
    resolver({ ...solicitudEjemplo(), estado: 'EMITIDA' });
    await p;
    expect(navegar).toHaveBeenCalledWith(['/solicitudes'], {
      state: { aviso: 'Solicitud aprobada. La póliza fue emitida.' },
    });
  });
  it('aprobar sin selección no decide y una aprobación parcial informa la actualización', async () => {
    await abrir();
    await componente().aprobar();
    expect(api.decidir).not.toHaveBeenCalled();
    api.decidir.mockResolvedValue(solicitudEjemplo());
    componente().marcar('CREDITO_NO_VERIFICADO', true);
    await componente().aprobar();
    expect(navegar.mock.calls[0][1]?.state?.['aviso']).toContain('Pendientes verificados');
  });
  it('el diálogo permite cancelar y envía únicamente un motivo disponible, sin nota', async () => {
    api.detalle.mockResolvedValue({
      ...solicitudEjemplo(),
      pendientes: [{ codigo: 'CREDITO_NO_VERIFICADO', tipo: 'AGENTE' }],
    });
    await abrir();
    expect(api.imagen).not.toHaveBeenCalled();
    boton('Rechazar').click();
    fixture.detectChanges();
    expect(root().querySelectorAll('#motivo-rechazo option')).toHaveLength(2);
    expect(root().querySelector('textarea')).toBeNull();
    boton('Cancelar').click();
    fixture.detectChanges();
    expect(root().querySelector('app-rechazar-solicitud')).toBeNull();
    boton('Rechazar').click();
    fixture.detectChanges();
    const select = root().querySelector<HTMLSelectElement>('#motivo-rechazo')!;
    select.value = 'CREDITO_NO_VERIFICADO';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    root()
      .querySelector('app-rechazar-solicitud form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(api.decidir).toHaveBeenCalled());
    await fixture.whenStable();
    expect(api.decidir).toHaveBeenCalledWith('s-1', {
      decision: 'RECHAZAR',
      motivo: 'CREDITO_NO_VERIFICADO',
    });
    expect(navegar.mock.calls[0][1]?.state?.['aviso']).toBe('Solicitud rechazada.');
  });
  it('Escape cierra el rechazo sin decidir', async () => {
    await abrir();
    boton('Rechazar').click();
    fixture.detectChanges();
    root()
      .querySelector('app-rechazar-solicitud dialog')!
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(componente().rechazo()).toBe(false);
    expect(api.decidir).not.toHaveBeenCalled();
  });
  it('descarga evidencias autorizadas, amplía y libera las URL al salir', async () => {
    api.detalle.mockResolvedValue({
      ...solicitudEjemplo(),
      evidencias: [
        { tipo: 'cedula_frente', estado: 'ACEPTADA', evidenciaId: 'foto' },
        { tipo: 'selfie', estado: 'REVISION_MANUAL' },
      ],
    });
    await abrir();
    expect(api.imagen).toHaveBeenCalledWith('s-1', 'foto');
    expect(root().querySelector('img')?.src).toBe('blob:prueba');
    componente().ampliar('blob:prueba', 'Frente');
    fixture.detectChanges();
    expect(root().querySelector('.visor')?.hasAttribute('open')).toBe(true);
    componente().cerrarImagen();
    expect(componente().ampliada()).toBeNull();
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prueba');
  });
  it('ofrece reintento de imagen y rechaza formatos no admitidos', async () => {
    const evidencia = { tipo: 'selfie', estado: 'PENDIENTE', evidenciaId: 'foto' } as const;
    api.detalle.mockResolvedValue({ ...solicitudEjemplo(), evidencias: [evidencia] });
    api.imagen.mockRejectedValueOnce(new Error('red'));
    await abrir();
    expect(root().textContent).toContain('No pudimos cargar la imagen');
    api.imagen.mockResolvedValueOnce(new Blob(['no es foto'], { type: 'text/html' }));
    await componente().cargarImagen(evidencia);
    expect(componente().imagenes()['foto'].error).toBeTruthy();
    await componente().cargarImagen(evidencia);
    expect(componente().imagenes()['foto'].url).toBe('blob:prueba');
    expect(componente().estadoEvidencia(undefined)).toBe('No disponible');
  });
  it.each(['RECHAZADA', 'VENCIDA'] as const)(
    'devuelve a bandeja una solicitud %s',
    async (estado) => {
      api.detalle.mockResolvedValue({ ...solicitudEjemplo(), estado });
      await abrir();
      expect(navegar).toHaveBeenCalled();
      expect(api.decidir).not.toHaveBeenCalled();
    },
  );
  it('bloquea una solicitud que vence mientras se revisa', async () => {
    await abrir();
    componente().marcar('CREDITO_NO_VERIFICADO', true);
    componente().solicitud.update((s) => ({
      ...s!,
      solicitudVigenteHasta: '2020-01-01T00:00:00Z',
    }));
    await componente().aprobar();
    expect(api.decidir).not.toHaveBeenCalled();
    expect(navegar.mock.calls[0][1]?.state?.['aviso']).toContain('venció');
  });
  it.each([404, 409, 410, 422])(
    'actualiza bandeja ante conflicto o recurso no disponible (%s)',
    async (status) => {
      await abrir();
      api.decidir.mockRejectedValue(
        new HttpErrorResponse({
          status,
          error: { codigo: status === 409 ? 'SOLICITUD_VENCIDA' : 'PENDIENTE_NO_APLICA' },
        }),
      );
      componente().marcar('CREDITO_NO_VERIFICADO', true);
      await componente().aprobar();
      expect(navegar.mock.calls[0][1]?.state?.['aviso']).toMatch(/Actualizamos la bandeja/);
    },
  );
  it.each([0, 503])('no reintenta una decisión de resultado incierto (%s)', async (status) => {
    await abrir();
    api.decidir.mockRejectedValue(new HttpErrorResponse({ status }));
    await componente().rechazar('CREDITO_NO_VERIFICADO');
    expect(api.decidir).toHaveBeenCalledOnce();
    expect(navegar.mock.calls[0][1]?.state?.['aviso']).toContain('No pudimos confirmar');
  });
  it('muestra errores recuperables de consulta y decisión', async () => {
    api.detalle.mockRejectedValueOnce(new Error('red'));
    await abrir();
    expect(componente().error()).toContain('consultar');
    await componente().cargar();
    api.decidir.mockRejectedValue(new HttpErrorResponse({ status: 400 }));
    await componente().rechazar('CREDITO_NO_VERIFICADO');
    expect(componente().error()).toContain('registrar');
  });
  it('un detalle inexistente vuelve a la bandeja', async () => {
    api.detalle.mockRejectedValue(new HttpErrorResponse({ status: 404 }));
    await abrir();
    expect(navegar.mock.calls[0][1]?.state?.['aviso']).toContain('ya no está disponible');
  });
  it('descarta detalles que llegan tarde tras cambiar la ruta', async () => {
    let resolver!: (v: unknown) => void;
    api.detalle.mockImplementationOnce(() => new Promise((r) => (resolver = r)));
    fixture.detectChanges();
    parametros.next(convertToParamMap({ id: 's-2' }));
    await vi.waitFor(() => expect(componente().cargando()).toBe(false));
    resolver({
      ...solicitudEjemplo(),
      cliente: { ...solicitudEjemplo().cliente, nombre: 'Respuesta anterior' },
    });
    await Promise.resolve();
    expect(componente().solicitud()?.cliente.nombre).toBe('Sofía Restrepo');
  });
});
