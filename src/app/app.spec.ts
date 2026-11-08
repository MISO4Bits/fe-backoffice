import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { routes } from './app.routes';
import { AUTH_GATEWAY, CuentaInterna, FalloIngreso, Rol } from './core/auth/auth.gateway';
import { SessionService } from './core/auth/session.service';

const cuenta = (rol: Rol): CuentaInterna => ({
  uid: 'interno-1',
  nombre: 'Ana',
  correo: 'ana@solventa4bits.com',
  rol,
});

describe('Ingreso y navegación de BITS-363', () => {
  let ingresar: ReturnType<typeof vi.fn>;
  let salir: ReturnType<typeof vi.fn>;
  let harness: RouterTestingHarness;
  let sesion: SessionService;
  let router: Router;

  beforeEach(async () => {
    ingresar = vi.fn().mockResolvedValue(cuenta('ADMIN'));
    salir = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTH_GATEWAY, useValue: { ingresar, salir } },
      ],
    });
    sesion = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create('/ingreso');
  });

  function pantalla(): HTMLElement {
    return harness.routeNativeElement!;
  }
  function escribir(selector: string, value: string): void {
    const input = pantalla().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  async function enviar(): Promise<void> {
    pantalla()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  async function autenticar(rol: Rol): Promise<void> {
    ingresar.mockResolvedValue(cuenta(rol));
    await sesion.ingresar('ana@solventa4bits.com', 'clave-de-prueba');
    await harness.navigateByUrl(sesion.inicio());
  }
  function completar(): void {
    escribir('#correo-login', 'ana@solventa4bits.com');
    escribir('#clave-login', 'clave-de-prueba');
  }

  it('muestra un único login sin selector de rol ni registro', () => {
    expect(pantalla().querySelector('h1')?.textContent).toBe('Backoffice de Solventa');
    expect(pantalla().querySelectorAll('input')).toHaveLength(2);
    expect(pantalla().querySelector('select')).toBeNull();
    expect(pantalla().textContent).not.toContain('Crear cuenta');
  });

  it('valida ambos campos antes de consultar el servicio', async () => {
    await enviar();
    expect(ingresar).not.toHaveBeenCalled();
    expect(pantalla().textContent).toContain('Ingresa un correo electrónico válido.');
    expect(pantalla().textContent).toContain('Ingresa tu contraseña.');
  });

  it.each(['ADMIN', 'SOCIO'] as const)('ingresa como %s y llega a su inicio', async (rol) => {
    ingresar.mockResolvedValue(cuenta(rol));
    completar();
    await enviar();
    expect(ingresar).toHaveBeenCalledWith('ana@solventa4bits.com', 'clave-de-prueba');
    expect(router.url).toBe(rol === 'ADMIN' ? '/tablero' : '/venta');
    expect(pantalla().querySelector('h1')?.textContent).toBe(
      rol === 'ADMIN' ? 'Lo que hay por decidir' : 'Nueva venta',
    );
  });

  it('muestra credenciales inválidas como error del formulario', async () => {
    ingresar.mockRejectedValue(new FalloIngreso('credenciales'));
    completar();
    await enviar();
    expect(pantalla().querySelector('[role="alert"]')?.textContent).toBe(
      'Correo o contraseña incorrectos',
    );
    expect(pantalla().querySelectorAll('input[aria-invalid="true"]')).toHaveLength(2);
    expect(sesion.cuenta()).toBeNull();
    escribir('#clave-login', 'otra-clave');
    harness.detectChanges();
    expect(pantalla().querySelector('[role="alert"]')).toBeNull();
  });

  it('distingue portal equivocado de credenciales incorrectas', async () => {
    ingresar.mockRejectedValue(new FalloIngreso('portal'));
    completar();
    await enviar();
    expect(pantalla().querySelector('[role="alert"]')?.textContent).toBe(
      'Tu acceso es por solventa4bits.com',
    );
    expect(pantalla().querySelectorAll('input[aria-invalid="true"]')).toHaveLength(0);
    expect(router.url).toBe('/ingreso');
  });

  it.each([
    ['limite', 'Demasiados intentos.'],
    ['sin-rol', 'Tu cuenta no tiene un rol habilitado'],
    ['no-disponible', 'No pudimos iniciar sesión.'],
  ] as const)('muestra el estado %s sin abrir sesión', async (motivo, texto) => {
    ingresar.mockRejectedValue(new FalloIngreso(motivo));
    completar();
    await enviar();
    expect(pantalla().querySelector('[role="alert"]')?.textContent).toContain(texto);
    expect(sesion.cuenta()).toBeNull();
  });

  it('impide envíos duplicados mientras espera al servicio', async () => {
    let resolver!: (valor: CuentaInterna) => void;
    ingresar.mockImplementation(
      () =>
        new Promise<CuentaInterna>((resolve) => {
          resolver = resolve;
        }),
    );
    completar();
    const form = pantalla().querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    harness.detectChanges();
    expect(ingresar).toHaveBeenCalledTimes(1);
    expect(pantalla().querySelector('button')?.disabled).toBe(true);
    resolver(cuenta('ADMIN'));
    await vi.waitFor(() => expect(router.url).toBe('/tablero'));
    await harness.fixture.whenStable();
    expect(router.url).toBe('/tablero');
  });

  it.each(['/tablero', '/solicitudes', '/siniestros', '/venta', '/no-existe', '/'])(
    'protege %s sin sesión',
    async (url) => {
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/ingreso');
    },
  );

  it('muestra solo las tres opciones del Admin y protege Venta', async () => {
    await autenticar('ADMIN');
    expect(Array.from(pantalla().querySelectorAll('nav a'), (a) => a.textContent?.trim())).toEqual([
      'Tablero',
      'Solicitudes',
      'Siniestros',
    ]);
    await harness.navigateByUrl('/venta');
    expect(router.url).toBe('/tablero');
    await harness.navigateByUrl('/solicitudes');
    expect(pantalla().querySelector('h1')?.textContent).toBe('Solicitudes');
    await harness.navigateByUrl('/siniestros');
    expect(pantalla().querySelector('h1')?.textContent).toBe('Siniestros');
  });

  it('muestra solo Venta al Socio y protege las rutas del Admin', async () => {
    await autenticar('SOCIO');
    expect(Array.from(pantalla().querySelectorAll('nav a'), (a) => a.textContent?.trim())).toEqual([
      'Venta',
    ]);
    for (const url of ['/tablero', '/solicitudes', '/siniestros', '/ingreso', '/no-existe', '/']) {
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/venta');
    }
    expect(pantalla().querySelector('.sale-card button')?.hasAttribute('disabled')).toBe(true);
  });

  it.each(['ADMIN', 'SOCIO'] as const)(
    'Salir cierra la sesión del %s y bloquea el regreso',
    async (rol) => {
      await autenticar(rol);
      pantalla().querySelector<HTMLButtonElement>('.logout')!.click();
      await harness.fixture.whenStable();
      expect(salir).toHaveBeenCalledOnce();
      expect(sesion.cuenta()).toBeNull();
      expect(router.url).toBe('/ingreso');
      await harness.navigateByUrl(rol === 'ADMIN' ? '/tablero' : '/venta');
      expect(router.url).toBe('/ingreso');
    },
  );

  it('cierra la sesión local aunque falle el cierre remoto', async () => {
    await autenticar('ADMIN');
    salir.mockRejectedValue(new Error('sin conexión'));
    pantalla().querySelector<HTMLButtonElement>('.logout')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/ingreso');
    expect(sesion.cuenta()).toBeNull();
  });

  it('rechaza un rol inesperado del adaptador', async () => {
    ingresar.mockResolvedValue({ ...cuenta('ADMIN'), rol: 'CLIENTE' });
    await expect(sesion.ingresar('cliente@correo.com', 'clave')).rejects.toMatchObject({
      motivo: 'sin-rol',
    });
    expect(sesion.cuenta()).toBeNull();
  });

  it('vuelve al login sin esperar un cierre remoto lento', async () => {
    await autenticar('ADMIN');
    let resolver!: () => void;
    salir.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolver = resolve;
        }),
    );
    pantalla().querySelector<HTMLButtonElement>('.logout')!.click();
    await vi.waitFor(() => expect(router.url).toBe('/ingreso'));
    expect(sesion.cuenta()).toBeNull();
    resolver();
    await harness.fixture.whenStable();
  });

  it('un ingreso tardío no restaura una sesión cerrada', async () => {
    let resolver!: (valor: CuentaInterna) => void;
    ingresar.mockImplementation(
      () =>
        new Promise<CuentaInterna>((resolve) => {
          resolver = resolve;
        }),
    );
    const pendiente = sesion.ingresar('ana@solventa4bits.com', 'clave');
    await sesion.salir();
    resolver(cuenta('ADMIN'));
    await pendiente;
    expect(sesion.cuenta()).toBeNull();
  });
});
