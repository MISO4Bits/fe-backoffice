import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { NuevaVenta } from './nueva-venta';
import { VentasApiService } from './ventas-api.service';
import { CLIENTE, POLIZA, precioEjemplo } from './testing/venta.fixtures';
import { PrecioVenta } from './venta.models';

describe('Venta directa de BITS-361 / BITS-231', () => {
  let fixture: ComponentFixture<NuevaVenta>;
  let api: {
    buscar: ReturnType<typeof vi.fn>;
    entidades: ReturnType<typeof vi.fn>;
    crearCliente: ReturnType<typeof vi.fn>;
    precio: ReturnType<typeof vi.fn>;
    vender: ReturnType<typeof vi.fn>;
  };
  beforeEach(async () => {
    api = {
      buscar: vi.fn().mockResolvedValue(CLIENTE),
      entidades: vi.fn().mockResolvedValue([{ id: 'banco-1', nombre: 'Bancolombia' }]),
      crearCliente: vi.fn().mockResolvedValue(CLIENTE),
      precio: vi.fn().mockResolvedValue(precioEjemplo()),
      vender: vi.fn().mockResolvedValue(POLIZA),
    };
    await TestBed.configureTestingModule({
      imports: [NuevaVenta],
      providers: [{ provide: VentasApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(NuevaVenta);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
  });
  const root = () => fixture.nativeElement as HTMLElement;
  function input(id: string, value: string) {
    const el = root().querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    fixture.detectChanges();
  }
  function button(text: string): HTMLButtonElement {
    return Array.from(root().querySelectorAll('button')).find(
      (el) => el.textContent?.trim() === text,
    )!;
  }
  async function enviar(label: string) {
    root()
      .querySelector(`form[aria-label="${label}"]`)!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function esperar(texto: string) {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root().textContent).toContain(texto);
    });
  }
  async function abrirVenta() {
    input('buscar-documento', '1.020.340.001');
    await enviar('Buscar cliente');
    await esperar('Datos de la venta');
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function abrirAlta() {
    api.buscar.mockResolvedValue(null);
    input('buscar-documento', '1.032.450.001');
    input('buscar-correo', 'sofia.restrepo@correo.com');
    await enviar('Buscar cliente');
    await esperar('Datos del cliente');
  }
  function completarAlta() {
    input('cliente-primerNombre', 'Sofía María');
    input('cliente-primerApellido', 'Restrepo Gómez');
    input('cliente-fechaNacimiento', '1992-03-12');
    input('cliente-telefono', '300 123 4567');
  }
  async function cotizar() {
    input('venta-banco', 'Bancolombia');
    input('venta-monto', '$320.000.000');
    input('venta-plazo', '180');
    button('Calcular prima').click();
    await esperar('Prima mensual');
  }
  function completarVenta() {
    input('venta-cuota', '$3.450.000');
    input('venta-direccion', 'Calle 100 # 15-20, apto. 502');
    input('venta-municipio', 'Bogotá');
  }

  it('no consulta sin criterio o con datos inválidos', async () => {
    await enviar('Buscar cliente');
    expect(api.buscar).not.toHaveBeenCalled();
    input('buscar-correo', 'correo-invalido');
    await enviar('Buscar cliente');
    expect(api.buscar).not.toHaveBeenCalled();
    expect(root().textContent).toContain('Ingresa un correo electrónico válido.');
    input('buscar-correo', '');
    input('buscar-documento', '12');
    await enviar('Buscar cliente');
    expect(api.buscar).not.toHaveBeenCalled();
  });
  it('consulta solo por correo cuando no hay documento', async () => {
    input('buscar-correo', 'sofia@correo.com');
    await enviar('Buscar cliente');
    await esperar('Datos de la venta');
    expect(api.buscar).toHaveBeenCalledTimes(1);
    expect(api.buscar).toHaveBeenCalledWith({ correo: 'sofia@correo.com' });
    expect(root().textContent).toContain('****0001');
    expect(root().textContent).not.toContain('sofia@correo.com');
  });
  it('compara dos consultas y avanza únicamente si tienen el mismo ID', async () => {
    input('buscar-documento', '1.020.340.001');
    input('buscar-correo', 'sofia@correo.com');
    await enviar('Buscar cliente');
    await esperar('Datos de la venta');
    expect(api.buscar).toHaveBeenCalledWith({ tipoDocumento: 'CC', numeroDocumento: '1020340001' });
    expect(api.buscar).toHaveBeenCalledWith({ correo: 'sofia@correo.com' });
    expect(api.buscar).toHaveBeenCalledTimes(2);
  });
  it.each([
    [CLIENTE, { ...CLIENTE, id: 'otro' }, 'Es de una cuenta distinta a la del documento'],
    [CLIENTE, null, 'No encontramos una cuenta con este correo'],
    [null, CLIENTE, 'No encontramos una cuenta con este documento'],
  ])('bloquea criterios inconsistentes (%#)', async (doc, correo, texto) => {
    api.buscar.mockResolvedValueOnce(doc).mockResolvedValueOnce(correo);
    input('buscar-documento', '1020340001');
    input('buscar-correo', 'otro@correo.com');
    await enviar('Buscar cliente');
    await esperar(String(texto));
    expect(button('Continuar').disabled).toBe(true);
    expect(api.crearCliente).not.toHaveBeenCalled();
    input('buscar-correo', 'corregido@correo.com');
    expect(button('Continuar').disabled).toBe(false);
  });
  it('un error técnico no se convierte en cliente inexistente', async () => {
    api.buscar.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    input('buscar-documento', '1020340001');
    await enviar('Buscar cliente');
    await esperar('No pudimos buscar al cliente');
    expect(root().querySelector('h1')?.textContent).toBe('Nueva venta');
  });
  it.each(['BLOQUEADO', 'INACTIVO'] as const)('impide vender a un cliente %s', async (estado) => {
    api.buscar.mockResolvedValue({ ...CLIENTE, estado });
    input('buscar-correo', 'sofia@correo.com');
    await enviar('Buscar cliente');
    await esperar('El cliente no está activo');
    expect(api.precio).not.toHaveBeenCalled();
  });
  it('precarga el alta solo si ambos criterios devuelven 404 y conserva el regreso', async () => {
    await abrirAlta();
    expect((root().querySelector('#cliente-numeroDocumento') as HTMLInputElement).value).toBe(
      '1032450001',
    );
    expect((root().querySelector('#cliente-email') as HTMLInputElement).value).toBe(
      'sofia.restrepo@correo.com',
    );
    expect(root().querySelector('input[type="password"]')).toBeNull();
    expect(root().querySelector('input[type="checkbox"]')).toBeNull();
    button('Volver').click();
    fixture.detectChanges();
    expect(root().querySelector('h1')?.textContent).toBe('Nueva venta');
    expect((root().querySelector('#buscar-correo') as HTMLInputElement).value).toBe(
      'sofia.restrepo@correo.com',
    );
  });
  it('valida el alta antes de consultar y mapea nombres completos sin contraseña', async () => {
    await abrirAlta();
    await enviar('Datos del cliente');
    expect(api.crearCliente).not.toHaveBeenCalled();
    completarAlta();
    await enviar('Datos del cliente');
    await esperar('Datos de la venta');
    expect(api.crearCliente.mock.calls[0][0]).toEqual({
      tipoDocumento: 'CC',
      numeroDocumento: '1032450001',
      primerNombre: 'Sofía María',
      primerApellido: 'Restrepo Gómez',
      fechaNacimiento: '1992-03-12',
      telefono: '3001234567',
      email: 'sofia.restrepo@correo.com',
    });
    expect(api.crearCliente.mock.calls[0][1]).toMatch(/^[a-f0-9-]{36}$/);
  });
  it.each([
    ['correo', 'email'],
    ['documento', 'numeroDocumento'],
  ])('marca el duplicado de %s según Socio 01B', async (campo, inputName) => {
    await abrirAlta();
    completarAlta();
    api.crearCliente.mockRejectedValue(
      new HttpErrorResponse({ status: 409, error: { errores: [{ campo, mensaje: 'duplicado' }] } }),
    );
    await enviar('Datos del cliente');
    await esperar('Ese documento o ese correo ya pertenece a otra cuenta.');
    expect(button('Continuar').disabled).toBe(true);
    expect(root().querySelector(`#cliente-${inputName}`)?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    if (inputName === 'email') input('cliente-email', 'otro@correo.com');
    else input('cliente-tipoDocumento', 'CE');
    expect(button('Continuar').disabled).toBe(false);
  });
  it('conserva la clave del alta cuando hay que reintentar la misma solicitud', async () => {
    await abrirAlta();
    completarAlta();
    api.crearCliente.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await enviar('Datos del cliente');
    await esperar('No pudimos crear al cliente');
    await enviar('Datos del cliente');
    await esperar('Datos de la venta');
    expect(api.crearCliente.mock.calls[0][1]).toBe(api.crearCliente.mock.calls[1][1]);
  });
  it('permite reintentar la carga de bancos sin pedir datos financieros del cliente', async () => {
    api.entidades.mockRejectedValueOnce(new Error('no disponible'));
    await abrirVenta();
    await esperar('No pudimos cargar los bancos');
    button('Reintentar carga').click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root().querySelectorAll('#venta-banco option')).toHaveLength(2);
    });
  });
  it('valida monto mínimo y plazo antes de calcular precio', async () => {
    await abrirVenta();
    input('venta-banco', 'Bancolombia');
    input('venta-monto', '9.999.999');
    input('venta-plazo', '180');
    button('Calcular prima').click();
    await fixture.whenStable();
    expect(api.precio).not.toHaveBeenCalled();
    input('venta-monto', '10.000.000');
    input('venta-plazo', '481');
    button('Calcular prima').click();
    await fixture.whenStable();
    expect(api.precio).not.toHaveBeenCalled();
  });
  it('obtiene el desglose del backend y suma únicamente las coberturas seleccionadas', async () => {
    await abrirVenta();
    await cotizar();
    expect(api.precio).toHaveBeenCalledWith({
      clienteId: CLIENTE.id,
      valorCredito: 320000000,
      plazoRestanteMeses: 180,
      entidadAcreedora: 'Bancolombia',
    });
    expect(root().querySelector('.total')?.textContent).toContain('49.100');
    (root().querySelector('#venta-hogar') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(root().querySelector('.total')?.textContent).toContain('77.374');
    expect(root().querySelector('.summary')?.textContent).toContain('4.514');
    expect(button('Crear póliza').disabled).toBe(true); // cuota e inmueble siguen siendo obligatorios
  });
  it.each([
    [422, 'FUERA_DE_RANGO', 'El cliente debe tener entre 18 y 65 años'],
    [403, 'CLIENTE_NO_ACTIVO', 'El cliente no está activo'],
    [503, undefined, 'No pudimos calcular la prima'],
  ])('muestra la restricción HTTP %s sin emitir', async (status, codigo, texto) => {
    api.precio.mockRejectedValue(
      new HttpErrorResponse({ status: Number(status), error: { codigo } }),
    );
    await abrirVenta();
    input('venta-banco', 'Bancolombia');
    input('venta-monto', '320000000');
    input('venta-plazo', '180');
    button('Calcular prima').click();
    await esperar(String(texto));
    expect(root().querySelector('h1')?.textContent).toBe('Datos de la venta');
    expect(button('Crear póliza').disabled).toBe(true);
    expect(api.vender).not.toHaveBeenCalled();
  });
  it('descarta un precio tardío si el crédito cambió', async () => {
    let resolver!: (precio: PrecioVenta) => void;
    api.precio.mockImplementationOnce(
      () =>
        new Promise<PrecioVenta>((resolve) => {
          resolver = resolve;
        }),
    );
    await abrirVenta();
    input('venta-banco', 'Bancolombia');
    input('venta-monto', '320000000');
    input('venta-plazo', '180');
    button('Calcular prima').click();
    fixture.detectChanges();
    input('venta-monto', '200000000');
    api.precio.mockResolvedValue(precioEjemplo(200000000));
    button('Calcular prima').click();
    await esperar('Prima mensual');
    resolver(precioEjemplo(320000000));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root().querySelector('.insured')?.textContent).toContain('200.000.000');
  });
  it('emite solo una vez ante doble envío y muestra la respuesta definitiva', async () => {
    await abrirVenta();
    await cotizar();
    completarVenta();
    (root().querySelector('#venta-hogar') as HTMLInputElement).click();
    fixture.detectChanges();
    let resolver!: (value: typeof POLIZA) => void;
    api.vender.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    const form = root().querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(api.vender).toHaveBeenCalledTimes(1);
    expect(api.vender.mock.calls[0][0]).toEqual({
      clienteId: CLIENTE.id,
      valorCredito: 320000000,
      plazoRestanteMeses: 180,
      entidadAcreedora: 'Bancolombia',
      cuotaMensual: 3450000,
      direccion: 'Calle 100 # 15-20, apto. 502',
      municipio: 'Bogotá',
      coberturas: ['VIDA', 'HOGAR'],
    });
    resolver(POLIZA);
    await esperar('Póliza creada');
    expect(root().textContent).toContain(POLIZA.numero);
    button('Nueva venta').click();
    fixture.detectChanges();
    expect((root().querySelector('#buscar-documento') as HTMLInputElement).value).toBe('');
    expect(root().textContent).not.toContain(CLIENTE.nombre);
  });
  it('reintenta una emisión incierta con exactamente el mismo cuerpo y clave', async () => {
    await abrirVenta();
    await cotizar();
    completarVenta();
    api.vender.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await enviar('Datos de la venta');
    await esperar('No pudimos confirmar la emisión');
    expect(root().querySelector('fieldset')?.disabled).toBe(true);
    expect(button('Volver').disabled).toBe(true);
    await enviar('Datos de la venta');
    await esperar('Póliza creada');
    expect(api.vender.mock.calls[0]).toEqual(api.vender.mock.calls[1]);
    expect(api.vender.mock.calls[0][0].coberturas).toEqual(['VIDA']);
  });
  it('conserva los campos y no declara éxito si el backend rechaza la venta', async () => {
    await abrirVenta();
    await cotizar();
    completarVenta();
    api.vender.mockRejectedValue(
      new HttpErrorResponse({
        status: 400,
        error: { errores: [{ campo: 'direccion', mensaje: 'Revisa la dirección' }] },
      }),
    );
    await enviar('Datos de la venta');
    await esperar('Revisa la dirección');
    expect(root().querySelector('h1')?.textContent).toBe('Datos de la venta');
    input('venta-direccion', 'Calle 101');
    expect(root().querySelector('#venta-direccion')?.getAttribute('aria-invalid')).toBe('false');
  });
  it('un cliente inexistente por correo precarga solo ese dato y permite volver', async () => {
    api.buscar.mockResolvedValue(null);
    input('buscar-correo', 'nuevo@correo.com');
    await enviar('Buscar cliente');
    await esperar('Datos del cliente');
    expect((root().querySelector('#cliente-numeroDocumento') as HTMLInputElement).value).toBe('');
    expect((root().querySelector('#cliente-email') as HTMLInputElement).value).toBe(
      'nuevo@correo.com',
    );
  });

  it('no emite con un precio vencido hasta mostrar y confirmar el precio actualizado', async () => {
    const vencido = precioEjemplo();
    vencido.vigenciaCotizacion.hasta = '2020-01-01T00:00:00Z';
    api.precio.mockResolvedValueOnce(vencido).mockResolvedValue(precioEjemplo());
    await abrirVenta();
    await cotizar();
    completarVenta();
    await enviar('Datos de la venta');
    await esperar('La prima se actualizó.');
    expect(api.vender).not.toHaveBeenCalled();
    expect(api.precio).toHaveBeenCalledTimes(2);
    await enviar('Datos de la venta');
    await esperar('Póliza creada');
  });
  it('un rechazo por cliente inactivo al emitir bloquea Crear póliza y mantiene los datos', async () => {
    await abrirVenta();
    await cotizar();
    completarVenta();
    api.vender.mockRejectedValue(
      new HttpErrorResponse({ status: 403, error: { codigo: 'CLIENTE_NO_ACTIVO' } }),
    );
    await enviar('Datos de la venta');
    await esperar('El cliente no está activo');
    expect(button('Crear póliza').disabled).toBe(true);
    expect((root().querySelector('#venta-direccion') as HTMLInputElement).value).toContain(
      'Calle 100',
    );
  });
});
