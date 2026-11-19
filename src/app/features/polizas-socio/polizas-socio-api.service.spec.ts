import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BFF_BASE_URL } from '../../core/config/api.config';
import { PolizasSocioApiService } from './polizas-socio-api.service';

describe('PolizasSocioApiService', () => {
  it.each([
    ['/web///', '/web/v1/socio/polizas'],
    ['///', '/v1/socio/polizas'],
  ])('normaliza la URL base %s', (base, url) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BFF_BASE_URL, useValue: base },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PolizasSocioApiService).listar().subscribe();

    http.expectOne({ method: 'GET', url }).flush({
      items: [],
      consultadoEn: '2026-11-03T13:00:00Z',
      incompleta: false,
    });
    http.verify();
  });
});
