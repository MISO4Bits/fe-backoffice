import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { AUTH_GATEWAY } from './auth.gateway';
import { HttpAuthGateway, SesionConsola } from './http-auth.gateway';
import { authInterceptor } from './auth.interceptor';
import { SessionService } from './session.service';
import { BFF_BASE_URL } from '../config/api.config';

const base = '/web';
const login = `${base}/v1/backoffice/sesiones`;
const refresh = `${login}/refresco`;
const recurso = `${base}/v1/backoffice/siniestros`;
const respuesta = (changes: Partial<SesionConsola> = {}): SesionConsola => ({
  accessToken: 'acceso-interno',
  refreshToken: 'refresco-interno',
  expiresIn: 900,
  rol: 'ADMIN',
  nombre: 'Ana',
  ...changes,
});

describe('Contrato HTTP de sesión interna e interceptor', () => {
  let auth: HttpAuthGateway;
  let sesion: SessionService;
  let http: HttpClient;
  let mock: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BFF_BASE_URL, useValue: base },
        { provide: AUTH_GATEWAY, useExisting: HttpAuthGateway },
      ],
    });
    auth = TestBed.inject(HttpAuthGateway);
    sesion = TestBed.inject(SessionService);
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => {
    try {
      mock.verify();
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });

  async function ingresar(data = respuesta()) {
    const pending = sesion.ingresar('ana@solventa4bits.com', 'prueba-123');
    const req = mock.expectOne(login);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@solventa4bits.com', password: 'prueba-123' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(data);
    await pending;
  }
  async function esperarRequest(url: string) {
    let request!: TestRequest;
    await vi.waitFor(() => {
      request = mock.expectOne(url);
    });
    return request;
  }

  it.each(['ADMIN', 'SOCIO'] as const)(
    'usa el rol %s del backend sin consultar /cuenta',
    async (rol) => {
      await ingresar(respuesta({ rol, nombre: null }));
      expect(sesion.cuenta()).toMatchObject({ rol, nombre: '', correo: 'ana@solventa4bits.com' });
      expect(sesion.inicio()).toBe(rol === 'ADMIN' ? '/tablero' : '/venta');
      mock.expectNone('/web/v1/cuenta');
    },
  );

  it.each([
    [401, undefined, 'credenciales'],
    [403, 'ACCESO_POR_PORTAL_CLIENTE', 'portal'],
    [403, 'CUENTA_SIN_ROL', 'sin-rol'],
    [403, 'OTRO', 'no-disponible'],
    [429, undefined, 'limite'],
    [503, undefined, 'no-disponible'],
  ])('traduce HTTP %s / %s a %s', async (status, codigo, motivo) => {
    const pending = sesion.ingresar('ana@solventa4bits.com', 'clave');
    const assertion = expect(pending).rejects.toMatchObject({ motivo });
    mock.expectOne(login).flush({ codigo }, { status: Number(status), statusText: 'Error' });
    await assertion;
    expect(sesion.cuenta()).toBeNull();
  });

  it('rechaza una respuesta incompleta sin conservar tokens', async () => {
    const pending = auth.ingresar('ana@solventa4bits.com', 'clave');
    const assertion = expect(pending).rejects.toMatchObject({ motivo: 'no-disponible' });
    mock.expectOne(login).flush({ rol: 'ADMIN' });
    await assertion;
    expect(await auth.tokenValido()).toBeNull();
  });

  it('comparte un refresco entre llamadas concurrentes y rota los tokens', async () => {
    await ingresar();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 880000);
    const a = auth.tokenValido();
    const b = auth.tokenValido();
    const req = mock.expectOne(refresh);
    expect(req.request.body).toEqual({ refreshToken: 'refresco-interno' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(respuesta({ accessToken: 'nuevo', refreshToken: 'refresco-nuevo' }));
    expect(await Promise.all([a, b])).toEqual(['nuevo', 'nuevo']);
  });

  it('un refresco posterior a Salir no restaura la sesión', async () => {
    await ingresar();
    const pending = auth.refrescar();
    const req = mock.expectOne(refresh);
    await sesion.salir();
    req.flush(respuesta());
    expect(await pending).toBeNull();
    expect(await auth.tokenValido()).toBeNull();
    expect(sesion.cuenta()).toBeNull();
  });

  it('el guard puede invalidar una sesión cuyo refresco ha vencido', async () => {
    await ingresar();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000000);
    const pending = sesion.validar();
    mock.expectOne(refresh).flush({}, { status: 401, statusText: 'Expired' });
    expect(await pending).toBe(false);
    expect(sesion.cuenta()).toBeNull();
  });

  it('envía Bearer solo a recursos internos y reintenta una vez tras 401', async () => {
    await ingresar();
    const pending = firstValueFrom(http.get(recurso));
    const req = await esperarRequest(recurso);
    expect(req.request.headers.get('Authorization')).toBe('Bearer acceso-interno');
    req.flush({}, { status: 401, statusText: 'Expired' });
    mock.expectOne(refresh).flush(respuesta({ accessToken: 'renovado' }));
    const retry = await esperarRequest(recurso);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer renovado');
    retry.flush([]);
    expect(await pending).toEqual([]);
  });

  it('un segundo 401 cierra la sesión sin entrar en un bucle', async () => {
    await ingresar();
    const pending = firstValueFrom(http.get(recurso));
    const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
    (await esperarRequest(recurso)).flush({}, { status: 401, statusText: 'Expired' });
    mock.expectOne(refresh).flush(respuesta({ accessToken: 'renovado' }));
    (await esperarRequest(recurso)).flush({}, { status: 401, statusText: 'Denied' });
    await assertion;
    expect(sesion.cuenta()).toBeNull();
    expect(navegar).toHaveBeenCalledWith('/ingreso', { replaceUrl: true });
  });

  it('un 403 conserva sesión y vuelve al inicio del rol', async () => {
    await ingresar(respuesta({ rol: 'SOCIO' }));
    const pending = firstValueFrom(http.get(recurso));
    const assertion = expect(pending).rejects.toMatchObject({ status: 403 });
    (await esperarRequest(recurso)).flush(
      { codigo: 'ROL_NO_PERMITIDO' },
      { status: 403, statusText: 'Forbidden' },
    );
    await assertion;
    mock.expectNone(refresh);
    expect(sesion.cuenta()?.rol).toBe('SOCIO');
    expect(navegar).toHaveBeenCalledWith('/venta');
  });

  it.each([
    '/web/v1/cuenta',
    '/web/v1/sesiones',
    'https://otro.test/web/v1/backoffice/siniestros',
    '/web/v1/backoffice-ajeno',
  ])('no filtra tokens a %s', async (url) => {
    await ingresar();
    const pending = firstValueFrom(http.get(url));
    const req = mock.expectOne(url);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await pending;
  });

  it('un 401 viejo no cierra una sesión nueva', async () => {
    await ingresar();
    const pending = firstValueFrom(http.get(recurso));
    const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
    const old = await esperarRequest(recurso);
    await sesion.salir();
    await ingresar(respuesta({ accessToken: 'otra-sesion', rol: 'SOCIO' }));
    old.flush({}, { status: 401, statusText: 'Expired' });
    await assertion;
    expect(sesion.cuenta()?.rol).toBe('SOCIO');
    expect(navegar).not.toHaveBeenCalled();
  });
});
