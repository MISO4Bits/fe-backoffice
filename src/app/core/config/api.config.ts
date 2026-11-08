import { InjectionToken } from '@angular/core';
import { API_BASE_URL } from './api-base-url';

export const BFF_BASE_URL = new InjectionToken<string>('BFF_BASE_URL', {
  providedIn: 'root',
  factory: () => API_BASE_URL,
});
export const HTTP_TIMEOUT_MS = 10000;

export function esRutaInterna(url: string, base: string): boolean {
  const prefix = base.replace(/\/+$/, '');
  return ['/v1/backoffice', '/v1/socio'].some((path) => {
    const resource = url.split(/[?#]/)[0];
    return resource === `${prefix}${path}` || resource.startsWith(`${prefix}${path}/`);
  });
}

export function esRutaSesion(url: string, base: string): boolean {
  const resource = url.split(/[?#]/)[0];
  const path = `${base.replace(/\/+$/, '')}/v1/backoffice/sesiones`;
  return resource === path || resource === `${path}/refresco`;
}
