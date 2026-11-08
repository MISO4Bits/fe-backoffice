import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export function documentoSinFormato(value: string): string {
  return value.replace(/[.\s]/g, '');
}
export function documentoValido(control: AbstractControl): ValidationErrors | null {
  const value = documentoSinFormato(String(control.value ?? ''));
  return !value || /^[0-9A-Za-z-]{4,20}$/.test(value) ? null : { documento: true };
}
export function telefonoSinFormato(value: string): string {
  return value.replace(/[\s()-]/g, '');
}
export function telefonoValido(control: AbstractControl): ValidationErrors | null {
  const value = telefonoSinFormato(String(control.value ?? ''));
  return !value || /^\+?[0-9]{7,15}$/.test(value) ? null : { telefono: true };
}
export function numeroMonetario(value: string): number {
  const raw = value.trim().replace(/^\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw)) return NaN;
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}
export function montoValido(min: number): ValidatorFn {
  return (control) => {
    const value = numeroMonetario(String(control.value ?? ''));
    return Number.isFinite(value) && value >= min && value <= 1e12 ? null : { monto: true };
  };
}
/** Misma validación de fecha real/no futura del formulario crear-cuenta de fe-web. */
export function fechaNacimientoValida(control: AbstractControl): ValidationErrors | null {
  const text = String(control.value ?? '');
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { fecha: true };
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return year >= 1900 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date <= new Date()
    ? null
    : { fecha: true };
}
