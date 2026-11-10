import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { BFF_BASE_URL } from '../../core/config/api.config';
import { SessionService } from '../../core/auth/session.service';
import { SolicitudesApiService } from './solicitudes-api.service';
import { solicitudEjemplo } from './testing/solicitud.fixtures';
import { DecisionSolicitud } from './solicitudes.models';

describe('Contrato HTTP de Solicitudes', () => {
  let api: SolicitudesApiService;
  let http: HttpTestingController;
  const cuenta = signal<unknown>({ uid: 'admin', correo: 'admin@solventa4bits.com', rol: 'ADMIN' });
  beforeEach(() => {
    cuenta.set({ uid: 'admin', correo: 'admin@solventa4bits.com', rol: 'ADMIN' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BFF_BASE_URL, useValue: '/web/' },
        { provide: SessionService, useValue: { cuenta } },
      ],
    });
    api = TestBed.inject(SolicitudesApiService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => http.verify());
  it('retira de mi bandeja lo ya decidido por mi usuario, conservándolo para otro Admin', () => {
    const solicitud = solicitudEjemplo();
    expect(api.esperaMiRevision(solicitud)).toBe(true);
    solicitud.decisiones.push({
      decision: 'APROBAR',
      agente: ' ADMIN@solventa4bits.com ',
      pendientes: ['EVIDENCIA_EN_REVISION'],
      decididaEn: solicitud.creadaEn,
    });
    expect(api.esperaMiRevision(solicitud)).toBe(false);
    cuenta.set({ uid: 'otro-admin', correo: 'otro@solventa4bits.com', rol: 'ADMIN' });
    TestBed.tick();
    expect(api.esperaMiRevision(solicitud)).toBe(true);
    solicitud.estado = 'RECHAZADA';
    expect(api.esperaMiRevision(solicitud)).toBe(false);
    cuenta.set(null);
    TestBed.tick();
    expect(api.cache('s-1')).toBeUndefined();
  });
  it('envía límite y cursor, sin recorrer dos veces', async () => {
    const p = api.pagina();
    const r = http.expectOne('/web/v1/backoffice/solicitudes?limite=100');
    r.flush({ items: [], siguienteCursor: 'cursor+a' });
    await p;
    const siguiente = api.pagina('cursor+a');
    http.expectOne((r) => r.params.get('cursor') === 'cursor+a').flush({ items: [] });
    await siguiente;
  });
  it('codifica el identificador y limpia los detalles cuando cambia la sesión', async () => {
    const p = api.detalle('s/1');
    http.expectOne('/web/v1/backoffice/solicitudes/s%2F1').flush(solicitudEjemplo());
    await p;
    expect(api.cache('s/1')?.cliente.nombre).toBe('Sofía Restrepo');
    cuenta.set(null);
    TestBed.tick();
    expect(api.cache('s/1')).toBeUndefined();
  });
  it('no guarda respuestas tardías después de limpiar la caché', async () => {
    const p = api.detalle('s-1');
    api.limpiar();
    http.expectOne('/web/v1/backoffice/solicitudes/s-1').flush(solicitudEjemplo());
    await p;
    expect(api.cache('s-1')).toBeUndefined();
  });
  it.each<DecisionSolicitud>([
    { decision: 'APROBAR', pendientes: ['CREDITO_NO_VERIFICADO'] },
    { decision: 'RECHAZAR', motivo: 'EVIDENCIA_EN_REVISION' },
  ])('envía solo el cuerpo autorizado: $decision', async (decision) => {
    const p = api.decidir('s-1', {
      ...decision,
      agente: 'inyectado',
      nota: 'no enviar',
    } as unknown as DecisionSolicitud);
    const r = http.expectOne('/web/v1/backoffice/solicitudes/s-1/decisiones');
    expect(r.request.body).toEqual(decision);
    r.flush(solicitudEjemplo());
    await p;
  });
  it('lee imágenes como blob y propaga los errores del servicio', async () => {
    const p = api.imagen('s/1', 'e/1');
    const r = http.expectOne('/web/v1/backoffice/solicitudes/s%2F1/evidencias/e%2F1');
    expect(r.request.responseType).toBe('blob');
    r.flush(new Blob(['foto'], { type: 'image/png' }));
    expect((await p).type).toBe('image/png');
    const fallo = api.detalle('no');
    const assertion = expect(fallo).rejects.toMatchObject({ status: 404 });
    http
      .expectOne('/web/v1/backoffice/solicitudes/no')
      .flush({}, { status: 404, statusText: 'No encontrada' });
    await assertion;
  });
});
