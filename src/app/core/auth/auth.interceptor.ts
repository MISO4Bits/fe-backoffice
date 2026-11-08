import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { BFF_BASE_URL, esRutaInterna, esRutaSesion } from '../config/api.config';
import { HttpAuthGateway } from './http-auth.gateway';
import { SessionService } from './session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(BFF_BASE_URL);
  // Nunca enviar tokens internos a dominios ajenos ni a las rutas del cliente.
  if (!esRutaInterna(request.url, base) || esRutaSesion(request.url, base)) return next(request);
  const auth = inject(HttpAuthGateway);
  const sesion = inject(SessionService);
  const router = inject(Router);
  const version = auth.version;
  const rechazar = async () => {
    if (auth.version !== version) return;
    await sesion.salir();
    await router.navigateByUrl('/ingreso', { replaceUrl: true });
  };
  const manejar = (error: unknown, token: string) => {
    if (
      error instanceof HttpErrorResponse &&
      auth.version === version &&
      auth.esTokenActual(token)
    ) {
      if (error.status === 401) void rechazar();
      if (error.status === 403 && error.error?.codigo === 'ROL_NO_PERMITIDO') {
        void router.navigateByUrl(sesion.inicio());
      }
    }
    return throwError(() => error);
  };
  return from(auth.tokenValido()).pipe(
    switchMap((token) => {
      if (!token || auth.version !== version) {
        void rechazar();
        return throwError(
          () => new HttpErrorResponse({ status: 401, statusText: 'Sesión expirada' }),
        );
      }
      const enviar = (value: string) =>
        next(request.clone({ setHeaders: { Authorization: `Bearer ${value}` } }));
      return enviar(token).pipe(
        catchError((error) => {
          if (
            !(error instanceof HttpErrorResponse) ||
            error.status !== 401 ||
            !auth.esTokenActual(token)
          )
            return manejar(error, token);
          return from(auth.refrescar()).pipe(
            switchMap((nuevo) => {
              if (!nuevo) {
                void rechazar();
                return throwError(() => error);
              }
              return enviar(nuevo).pipe(
                catchError((errorReintento) => manejar(errorReintento, nuevo)),
              );
            }),
          );
        }),
      );
    }),
  );
};
