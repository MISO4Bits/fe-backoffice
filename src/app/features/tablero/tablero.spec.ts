import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SiniestrosApiService } from '../siniestros/siniestros-api.service';
import { SolicitudesApiService } from '../solicitudes/solicitudes-api.service';
import { solicitudEjemplo } from '../solicitudes/testing/solicitud.fixtures';
import { Tablero } from './tablero';

describe('Tablero del Admin', () => {
  const pagina = vi.fn();
  const detalle = vi.fn();
  const bandeja = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: SolicitudesApiService,
          useValue: {
            pagina,
            detalle,
            esperaMiRevision: (fila: { polizaId: string }) => fila.polizaId !== 'ya-revisada',
          },
        },
        { provide: SiniestrosApiService, useValue: { bandeja } },
      ],
    });
  });

  it('cuenta todas las páginas y conserva el enlace de una bandeja vacía', async () => {
    pagina
      .mockResolvedValueOnce({ items: [solicitudEjemplo('primera')], siguienteCursor: 'siguiente' })
      .mockResolvedValueOnce({
        items: [solicitudEjemplo('segunda'), solicitudEjemplo('ya-revisada')],
      });
    detalle.mockImplementation(async (id: string) => solicitudEjemplo(id));
    bandeja.mockResolvedValue([
      { estado: 'PAGADO', automatico: false },
      { estado: 'EN_ESTUDIO', automatico: true },
    ]);
    const fixture = TestBed.createComponent(Tablero);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();

    const pantalla: HTMLElement = fixture.nativeElement;
    expect(pagina).toHaveBeenNthCalledWith(2, 'siguiente');
    expect(bandeja).toHaveBeenCalledWith(false);
    expect(pantalla.querySelector('a[href="/solicitudes"] .count')?.textContent?.trim()).toBe('2');
    expect(pantalla.querySelector('a[href="/siniestros"] .count')?.textContent?.trim()).toBe('0');
    expect(pantalla.querySelector('[role="status"]')?.textContent).toMatch(/^Corte al /);
  });

  it('marca el conteo incompleto y permite volver a consultar', async () => {
    pagina.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ items: [] });
    bandeja.mockResolvedValue([{ estado: 'EN_ESTUDIO', automatico: false }]);
    const fixture = TestBed.createComponent(Tablero);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.cargando()).toBe(false));
    fixture.detectChanges();

    expect(fixture.componentInstance.solicitudes()).toBe('No disponible');
    expect(fixture.componentInstance.siniestros()).toBe(1);
    const pantalla: HTMLElement = fixture.nativeElement;
    pantalla.querySelector('button')!.click();
    await vi.waitFor(() => expect(fixture.componentInstance.solicitudes()).toBe(0));
  });
});
