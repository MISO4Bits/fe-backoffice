import { FormControl } from '@angular/forms';
import {
  documentoSinFormato,
  documentoValido,
  fechaNacimientoValida,
  montoValido,
  numeroMonetario,
  telefonoSinFormato,
  telefonoValido,
} from './venta-form.utils';

describe('Validación de los datos capturados por el Socio', () => {
  it('valida el celular por sus dígitos y conserva el prefijo internacional', () => {
    expect(telefonoValido(new FormControl('+57 (300) 123-4567'))).toBeNull();
    expect(telefonoSinFormato('+57 (300) 123-4567')).toBe('+573001234567');
    expect(telefonoValido(new FormControl('123'))).toEqual({ telefono: true });
    expect(telefonoValido(new FormControl('abcdefghij'))).toEqual({ telefono: true });
    expect(telefonoValido(new FormControl(null))).toBeNull();
  });
  it('valida el documento sin tratar los separadores visuales como errores', () => {
    expect(documentoValido(new FormControl('1.020.340.001'))).toBeNull();
    expect(documentoValido(new FormControl('AB-1234'))).toBeNull();
    expect(documentoValido(new FormControl('12'))).toEqual({ documento: true });
    expect(documentoValido(new FormControl('invalid@'))).toEqual({ documento: true });
    expect(documentoValido(new FormControl(null))).toBeNull();
  });
  it.each([
    ['$ 320.000.000', 320000000],
    ['10000000', 10000000],
    ['1.234,56', 1234.56],
    ['0,01', 0.01],
  ])('interpreta COP %s sin perder separadores decimales', (text, numero) =>
    expect(numeroMonetario(text)).toBe(numero),
  );
  it.each(['-100', '1.2', 'abc', '', '1,234', 'Infinity'])(
    'rechaza el monto ambiguo o inválido %s',
    (text) => expect(Number.isNaN(numeroMonetario(text))).toBe(true),
  );
  it('valida el mínimo, máximo y cuota positiva', () => {
    expect(montoValido(10000000)(new FormControl('9.999.999'))).toEqual({ monto: true });
    expect(montoValido(10000000)(new FormControl('10.000.000'))).toBeNull();
    expect(montoValido(0.01)(new FormControl('0'))).toEqual({ monto: true });
    expect(montoValido(0.01)(new FormControl('1.000.000.000.001'))).toEqual({ monto: true });
    expect(montoValido(0.01)(new FormControl(null))).toEqual({ monto: true });
  });
  it.each(['1992-02-30', '1899-01-01', '2999-01-01', '12/03/1992'])(
    'rechaza fecha imposible o futura %s',
    (text) => expect(fechaNacimientoValida(new FormControl(text))).toEqual({ fecha: true }),
  );
  it('acepta fecha real y deja required al validador del formulario', () => {
    expect(fechaNacimientoValida(new FormControl('1992-03-12'))).toBeNull();
    expect(fechaNacimientoValida(new FormControl(null))).toBeNull();
    expect(documentoSinFormato('1.020.340 001')).toBe('1020340001');
  });
});
