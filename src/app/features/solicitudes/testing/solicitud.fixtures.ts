import { SolicitudDetalle } from '../solicitudes.models';
export const solicitudEjemplo = (id = 's-1'): SolicitudDetalle => ({
  polizaId: id,
  clienteId: 'c-1',
  estado: 'PENDIENTE',
  creadaEn: '2026-10-28T14:12:00Z',
  solicitudVigenteHasta: '2099-11-27T23:59:00Z',
  primaTotalMensual: 77374,
  origenDatos: 'DECLARADO',
  cliente: {
    id: 'c-1',
    nombre: 'Sofía Restrepo',
    tipoDocumento: 'CC',
    numeroDocumento: '1020340001',
  },
  pendientes: [
    { codigo: 'EVIDENCIA_EN_REVISION', tipo: 'AGENTE' },
    { codigo: 'CREDITO_NO_VERIFICADO', tipo: 'AGENTE' },
  ],
  datosCredito: {
    entidadAcreedora: 'Bancolombia',
    valorCredito: 380000000,
    saldoInsoluto: 320000000,
    plazoRestanteMeses: 180,
  },
  cotizacionCreadaEn: '2026-10-28T14:12:00Z',
  decisiones: [],
  evidencias: [],
  coberturas: [
    {
      codigo: 'VIDA',
      obligatoria: true,
      sumaAsegurada: 320000000,
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
});
