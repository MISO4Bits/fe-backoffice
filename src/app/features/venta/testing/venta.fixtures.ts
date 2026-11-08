import { ClienteSocio, PrecioVenta, VentaCreada } from '../venta.models';

export const CLIENTE: ClienteSocio = {
  id: 'cliente-1',
  nombre: 'Sofía Restrepo',
  tipoDocumento: 'CC',
  ultimosDigitosDocumento: '0001',
  estado: 'ACTIVO',
};
export function precioEjemplo(valor = 320000000): PrecioVenta {
  return {
    edad: 34,
    datosCredito: {
      valorCredito: valor,
      saldoInsoluto: valor,
      entidadAcreedora: 'Bancolombia',
      plazoRestanteMeses: 180,
    },
    origenDatos: 'CONFIRMADO',
    coberturaMeses: 180,
    coberturas: [
      {
        codigo: 'VIDA',
        obligatoria: true,
        sumaAsegurada: valor,
        primaNeta: 49100,
        iva: 0,
        primaTotal: 49100,
      },
      {
        codigo: 'HOGAR',
        obligatoria: false,
        sumaAsegurada: 240000000,
        primaNeta: 23760,
        iva: 4514,
        primaTotal: 28274,
      },
    ],
    vigenciaCotizacion: {
      desde: new Date().toISOString(),
      hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    creadaEn: new Date().toISOString(),
  };
}
export const POLIZA: VentaCreada = {
  polizaId: 'poliza-1',
  clienteId: CLIENTE.id,
  socioId: 'socio-1',
  numero: 'POL-2026-000124',
  estado: 'EMITIDA',
  moneda: 'COP',
  primaTotalMensual: 77374,
  vigencia: { desde: '2026-11-04T12:00:00Z', hasta: '2027-11-04T12:00:00Z' },
  datosCredito: precioEjemplo().datosCredito,
  datosVenta: { direccion: 'Calle 100 # 15-20', municipio: 'Bogotá', cuotaMensual: 3450000 },
};
