import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BandejaSolicitudes } from './bandeja-solicitudes';
import { SolicitudesApiService } from './solicitudes-api.service';
import { solicitudEjemplo } from './testing/solicitud.fixtures';
import { fechaSolicitud, nombrePendiente, motivoRechazo } from './solicitudes.models';

describe('Bandeja B20', () => {
  let fixture: ComponentFixture<BandejaSolicitudes>;
  let api: {
    pagina: ReturnType<typeof vi.fn>;
    detalle: ReturnType<typeof vi.fn>;
    limpiar: ReturnType<typeof vi.fn>;
    esperaMiRevision: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    api = {
      pagina: vi.fn().mockResolvedValue({ items: [] }),
      detalle: vi.fn().mockImplementation(async (id) => solicitudEjemplo(id)),
      limpiar: vi.fn(),
      esperaMiRevision: vi.fn(
        (s) =>
          s.estado === 'PENDIENTE' &&
          s.pendientes.some((p: { tipo: string }) => p.tipo === 'AGENTE'),
      ),
    };
    TestBed.configureTestingModule({
      imports: [BandejaSolicitudes],
      providers: [provideRouter([]), { provide: SolicitudesApiService, useValue: api }],
    });
    fixture = TestBed.createComponent(BandejaSolicitudes);
  });
  afterEach(() => fixture.destroy());
  it('recorre todos los cursores, deduplica, ordena y completa los clientes', async () => {
    const reciente = { ...solicitudEjemplo('s-2'), creadaEn: '2026-11-01T00:00:00Z' };
    api.pagina
      .mockResolvedValueOnce({ items: [reciente], siguienteCursor: 'siguiente' })
      .mockResolvedValueOnce({ items: [solicitudEjemplo(), reciente] });
    api.detalle.mockImplementation(async (id) => (id === 's-2' ? reciente : solicitudEjemplo(id)));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(api.pagina.mock.calls).toEqual([[undefined], ['siguiente']]);
    expect(api.detalle).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.filas().map((f) => f.resumen.polizaId)).toEqual([
      's-1',
      's-2',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Sofía Restrepo');
    expect(fixture.nativeElement.textContent).toContain('****0001');
    expect(fixture.nativeElement.textContent).not.toContain('1020340001');
  });
  it('muestra estado vacío y etiquetas de fecha y motivos', async () => {
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay solicitudes pendientes');
    expect(fechaSolicitud(null)).toBe('No disponible');
    expect(fechaSolicitud('incorrecta')).toBe('No disponible');
    expect(nombrePendiente('EVIDENCIA_FALTANTE')).toBe('Evidencias faltantes');
    expect(motivoRechazo('CREDITO_NO_VERIFICADO')).toContain('Crédito');
    expect(fixture.componentInstance.documento({ resumen: solicitudEjemplo() })).toBe(
      'No disponible',
    );
    expect(fixture.componentInstance.espera(new Date().toISOString())).toBe('0 días');
  });
  it('retiene la fila si falla un detalle y permite reintentar', async () => {
    api.pagina.mockResolvedValue({ items: [solicitudEjemplo()] });
    api.detalle.mockRejectedValueOnce(new Error('red'));
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reintentar datos');
    await fixture.componentInstance.reintentar(fixture.componentInstance.filas()[0]);
    expect(fixture.componentInstance.filas()[0].cliente?.nombre).toBe('Sofía Restrepo');
    api.detalle.mockRejectedValueOnce(new Error('red'));
    await fixture.componentInstance.reintentar(fixture.componentInstance.filas()[0]);
    expect(fixture.componentInstance.aviso()).toContain('No pudimos');
  });
  it('no declara un total completo si el cursor se repite o falla una página', async () => {
    api.pagina.mockResolvedValue({ items: [solicitudEjemplo()], siguienteCursor: 'repetido' });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();
    expect(api.pagina).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.error()).toContain('incompletos');
    expect(api.detalle).not.toHaveBeenCalled();
    api.pagina.mockRejectedValueOnce(new Error('red'));
    await fixture.componentInstance.cargar();
    expect(fixture.componentInstance.cargando()).toBe(false);
  });
  it('descarta solicitudes sin pendientes del agente y cambios decididos durante la carga', async () => {
    api.pagina.mockResolvedValue({
      items: [
        solicitudEjemplo(),
        {
          ...solicitudEjemplo('usuario'),
          pendientes: [{ codigo: 'CORREO_SIN_CONFIRMAR', tipo: 'USUARIO' }],
        },
      ],
    });
    api.detalle.mockResolvedValue({ ...solicitudEjemplo(), estado: 'RECHAZADA' });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    expect(fixture.componentInstance.filas()).toEqual([]);
    expect(api.detalle).toHaveBeenCalledOnce();
  });
  it('limita a cuatro las consultas simultáneas y pagina los resultados guardados', async () => {
    const items = Array.from({ length: 12 }, (_, i) => solicitudEjemplo(`s-${i}`));
    api.pagina.mockResolvedValue({ items });
    let activas = 0,
      maximo = 0;
    api.detalle.mockImplementation(async (id) => {
      activas++;
      maximo = Math.max(maximo, activas);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activas--;
      return solicitudEjemplo(id);
    });
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    expect(maximo).toBe(4);
    expect(fixture.componentInstance.paginas()).toBe(2);
    fixture.componentInstance.pagina.set(2);
    expect(fixture.componentInstance.visibles()).toHaveLength(2);
    expect(api.pagina).toHaveBeenCalledOnce();
  });
  it('ignora una respuesta tardía si se destruye la pantalla', async () => {
    let resolver!: (value: unknown) => void;
    api.pagina.mockImplementation(() => new Promise((resolve) => (resolver = resolve)));
    fixture.detectChanges();
    fixture.destroy();
    resolver({ items: [solicitudEjemplo()] });
    await Promise.resolve();
    expect(fixture.componentInstance.filas()).toEqual([]);
  });
});
