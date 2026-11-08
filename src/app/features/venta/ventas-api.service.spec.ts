import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BFF_BASE_URL } from '../../core/config/api.config';
import { VentasApiService } from './ventas-api.service';
import { CLIENTE, POLIZA, precioEjemplo } from './testing/venta.fixtures';

describe('Contrato de venta del Socio (PR #30)', () => {
  let api: VentasApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BFF_BASE_URL, useValue: '/web/' },
      ],
    });
    api = TestBed.inject(VentasApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('consulta por un solo criterio y convierte únicamente 404 en cliente nuevo', async () => {
    const doc = api.buscar({ tipoDocumento: 'CC', numeroDocumento: '1020340001' });
    const req = http.expectOne((r) => r.url.endsWith('/socio/clientes'));
    expect(req.request.params.keys()).toEqual(['tipoDocumento', 'numeroDocumento']);
    req.flush(CLIENTE);
    expect(await doc).toEqual(CLIENTE);
    const email = api.buscar({ correo: 'nuevo@correo.com' });
    const missing = http.expectOne((r) => r.url.endsWith('/socio/clientes'));
    expect(missing.request.params.keys()).toEqual(['correo']);
    missing.flush({}, { status: 404, statusText: 'Not found' });
    expect(await email).toBeNull();
    const error = api.buscar({ correo: 'nuevo@correo.com' });
    const assertion = expect(error).rejects.toMatchObject({ status: 503 });
    http
      .expectOne((r) => r.url.endsWith('/socio/clientes'))
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion;
  });
  it('usa exclusivamente entidades, alta, precio y venta del canal Socio', async () => {
    const bancos = api.entidades();
    const lista = http.expectOne('/web/v1/socio/entidades-financieras?mercado=CO');
    lista.flush([{ id: 'banco-1', nombre: 'Bancolombia' }]);
    await bancos;
    const nuevo = {
      tipoDocumento: 'CC' as const,
      numeroDocumento: '1020340001',
      primerNombre: 'Sofía',
      primerApellido: 'Restrepo',
      fechaNacimiento: '1992-03-12',
      telefono: '3001234567',
      email: 'sofia@correo.com',
    };
    const alta = api.crearCliente(nuevo, 'alta-1');
    const reqAlta = http.expectOne('/web/v1/socio/clientes');
    expect(reqAlta.request.headers.get('Idempotency-Key')).toBe('alta-1');
    expect(reqAlta.request.body).toEqual(nuevo);
    reqAlta.flush(CLIENTE);
    await alta;
    const credito = {
      clienteId: CLIENTE.id,
      valorCredito: 320000000,
      plazoRestanteMeses: 180,
      entidadAcreedora: 'Bancolombia',
    };
    const precio = api.precio(credito);
    const reqPrecio = http.expectOne('/web/v1/socio/ventas/precio');
    expect(reqPrecio.request.body).toEqual(credito);
    reqPrecio.flush(precioEjemplo());
    await precio;
    const cuerpo = {
      ...credito,
      coberturas: ['VIDA' as const],
      cuotaMensual: 3450000,
      direccion: 'Calle 100',
      municipio: 'Bogotá',
    };
    const venta = api.vender(cuerpo, 'venta-1');
    const reqVenta = http.expectOne('/web/v1/socio/ventas');
    expect(reqVenta.request.headers.get('Idempotency-Key')).toBe('venta-1');
    expect(reqVenta.request.body).toEqual(cuerpo);
    expect(reqVenta.request.body.socioId).toBeUndefined();
    reqVenta.flush(POLIZA);
    await venta;
    http.expectNone('/web/v1/cotizaciones');
    http.expectNone('/web/v1/cuenta');
  });
});
