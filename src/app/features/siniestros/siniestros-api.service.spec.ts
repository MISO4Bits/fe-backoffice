import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BFF_BASE_URL } from '../../core/config/api.config';
import { SiniestrosApiService } from './siniestros-api.service';
import { DecisionSiniestro } from './siniestros.models';

describe('Contrato HTTP BITS-365', () => {
  let api: SiniestrosApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BFF_BASE_URL, useValue: '/web/' },
      ],
    });
    api = TestBed.inject(SiniestrosApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('separa la bandeja de estudio de los pagos automáticos', async () => {
    const estudio = api.bandeja(false);
    const normal = http.expectOne(
      (r) =>
        r.url === '/web/v1/backoffice/siniestros' &&
        r.params.get('estado') === 'EN_ESTUDIO' &&
        r.params.get('automatico') === 'false',
    );
    normal.flush([]);
    expect(await estudio).toEqual([]);
    const automaticos = api.bandeja(true);
    const pagos = http.expectOne(
      (r) =>
        r.url === '/web/v1/backoffice/siniestros' &&
        r.params.get('estado') === 'PAGADO' &&
        r.params.get('automatico') === 'true',
    );
    pagos.flush([]);
    expect(await automaticos).toEqual([]);
  });
  it('codifica ids y consulta evidencias como imágenes autenticables', async () => {
    const detalle = api.detalle('s/1');
    http.expectOne('/web/v1/backoffice/siniestros/s%2F1').flush({ id: 's/1', cliente: null });
    expect((await detalle).cliente).toBeNull();
    const imagen = api.imagen('s/1', 'e/1');
    const r = http.expectOne('/web/v1/backoffice/siniestros/s%2F1/evidencias/e%2F1');
    expect(r.request.responseType).toBe('blob');
    r.flush(new Blob(['imagen'], { type: 'image/png' }));
    expect((await imagen).type).toBe('image/png');
  });
  it.each<DecisionSiniestro>([
    { decision: 'PAGAR' },
    { decision: 'PAGAR', dano: 'PERDIDA_TOTAL', valor: 250000000 },
    { decision: 'PEDIR_EVIDENCIA', detalle: 'Enviar foto legible' },
    { decision: 'RECHAZAR', motivo: 'Evento fuera de cobertura' },
  ])('envía únicamente los campos de $decision, sin agente', async (decision) => {
    const peticion = api.decidir('s-1', {
      ...decision,
      agente: 'fraude@ejemplo.com',
    } as unknown as DecisionSiniestro);
    const r = http.expectOne('/web/v1/backoffice/siniestros/s-1/decisiones');
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual(decision);
    r.flush({ id: 's-1', estado: 'PAGADO' });
    await peticion;
  });
});
