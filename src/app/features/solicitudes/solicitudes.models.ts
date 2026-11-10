import { Cobertura, PrecioVenta, TipoDocumento } from '../venta/venta.models';

export type PendienteAgente = 'EVIDENCIA_EN_REVISION' | 'CREDITO_NO_VERIFICADO';
export type CodigoPendiente = PendienteAgente | 'CORREO_SIN_CONFIRMAR' | 'EVIDENCIA_FALTANTE';
export interface PendienteSolicitud {
  codigo: CodigoPendiente;
  tipo: 'USUARIO' | 'AGENTE';
  mensaje?: string;
  detalle?: { evidencias: string[] } | null;
}
export interface SolicitudResumen {
  polizaId: string;
  clienteId: string;
  estado: 'PENDIENTE' | 'EMITIDA' | 'RECHAZADA' | 'VENCIDA';
  creadaEn: string;
  solicitudVigenteHasta?: string | null;
  primaTotalMensual: number;
  origenDatos: 'CONFIRMADO' | 'DECLARADO';
  pendientes: PendienteSolicitud[];
}
export interface ClienteSolicitud {
  id: string;
  nombre: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
}
export interface EvidenciaSolicitud {
  tipo: 'cedula_frente' | 'cedula_reverso' | 'selfie';
  estado: 'ACEPTADA' | 'REVISION_MANUAL' | 'PENDIENTE';
  evidenciaId?: string | null;
}
export interface SolicitudDetalle extends SolicitudResumen {
  cliente: ClienteSolicitud;
  coberturas: Cobertura[];
  datosCredito: PrecioVenta['datosCredito'];
  cotizacionCreadaEn: string;
  evidencias: EvidenciaSolicitud[];
  decisiones: {
    decision: 'APROBAR' | 'RECHAZAR';
    agente: string;
    pendientes: CodigoPendiente[];
    nota?: string | null;
    decididaEn: string;
  }[];
}
export interface PaginaSolicitudes {
  items: SolicitudResumen[];
  siguienteCursor?: string | null;
}
export type DecisionSolicitud =
  | { decision: 'APROBAR'; pendientes: PendienteAgente[] }
  | { decision: 'RECHAZAR'; motivo: PendienteAgente };
export interface FilaSolicitud {
  resumen: SolicitudResumen;
  cliente?: ClienteSolicitud;
  errorDetalle?: boolean;
}
export const esPendienteAgente = (
  p: PendienteSolicitud,
): p is PendienteSolicitud & { codigo: PendienteAgente } =>
  p.tipo === 'AGENTE' && ['EVIDENCIA_EN_REVISION', 'CREDITO_NO_VERIFICADO'].includes(p.codigo);
export const nombrePendiente = (codigo: CodigoPendiente): string =>
  ({
    EVIDENCIA_EN_REVISION: 'Identidad',
    CREDITO_NO_VERIFICADO: 'Crédito',
    CORREO_SIN_CONFIRMAR: 'Confirmación del correo',
    EVIDENCIA_FALTANTE: 'Evidencias faltantes',
  })[codigo];
export const motivoRechazo = (codigo: PendienteAgente): string =>
  codigo === 'EVIDENCIA_EN_REVISION'
    ? 'Identidad: no se pudo verificar'
    : 'Crédito: no se pudo verificar';
export const fechaSolicitud = (valor?: string | null): string => {
  if (!valor || !Number.isFinite(Date.parse(valor))) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(valor));
};
