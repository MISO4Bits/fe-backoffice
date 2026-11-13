import { ClienteSolicitud } from '../solicitudes/solicitudes.models';

export type TipoSiniestro = 'INCAPACIDAD_TOTAL' | 'INCENDIO_TERREMOTO' | 'SISMO_PARAMETRICO';
export type EstadoSiniestro = 'EN_ESTUDIO' | 'FALTA_INFORMACION' | 'PAGADO' | 'RECHAZADO';
export interface SiniestroResumen {
  id: string;
  numero: string;
  polizaId: string;
  tipo: TipoSiniestro;
  automatico: boolean;
  estado: EstadoSiniestro;
  reportadoEn: string;
  actualizadoEn: string;
  clienteId: string;
  fechaLimite?: string | null;
}
export interface ArchivoSiniestro {
  id: string;
  clase: 'FOTO' | 'DOCUMENTO';
  capturadoEn?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  entregadoEn: string;
}
export interface LineaPago {
  beneficiario: 'BANCO' | 'CLIENTE';
  valor: number;
  destino: string;
}
export interface SiniestroDetalle extends SiniestroResumen {
  fechaOcurrencia: string;
  narracion?: string | null;
  ultimaEntregaEn: string;
  evidenciaPedida?: { detalle: string; pedidaEn: string } | null;
  motivoRechazo?: string | null;
  pago?: { pagadoEn: string; lineas: LineaPago[] } | null;
  archivos: ArchivoSiniestro[];
  evento?: { fecha: string; municipio: string; magnitud: number } | null;
  cliente?: ClienteSolicitud | null;
  poliza: {
    id: string;
    numero?: string | null;
    cobertura: 'VIDA' | 'HOGAR';
    sumaAsegurada: number;
  };
  saldoCredito: {
    valor: number;
    entidad: string;
    consultadoEn: string;
    origen: 'OPEN_FINANCE' | 'POLIZA';
  };
  destinoPago?: Record<string, unknown> | null;
  decisiones: {
    agente: string;
    decision: 'PAGAR' | 'PEDIR_EVIDENCIA' | 'RECHAZAR';
    fecha: string;
    dano?: 'REPARABLE' | 'PERDIDA_TOTAL' | null;
    valor?: number | null;
    detalle?: string | null;
    motivo?: string | null;
  }[];
}
export type DecisionSiniestro =
  | { decision: 'PAGAR'; dano?: 'REPARABLE' | 'PERDIDA_TOTAL'; valor?: number }
  | { decision: 'PEDIR_EVIDENCIA'; detalle: string }
  | { decision: 'RECHAZAR'; motivo: string };

export const tipoSiniestro = (tipo: TipoSiniestro): string =>
  ({
    INCAPACIDAD_TOTAL: 'Incapacidad total',
    INCENDIO_TERREMOTO: 'Incendio o terremoto',
    SISMO_PARAMETRICO: 'Terremoto',
  })[tipo];

export const fechaSiniestro = (valor?: string | null): string => {
  if (!valor) return 'No disponible';
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00Z`)
    : new Date(valor);
  if (!Number.isFinite(fecha.getTime())) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(fecha);
};

export const fechaHoraSiniestro = (valor?: string | null): string => {
  if (!valor) return 'No disponible';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return fechaSiniestro(valor);
  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(fecha);
};

export const monedaSiniestro = (valor: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
