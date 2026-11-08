/** Contrato del PR bff-web #30, commit 633bd04 (BITS-378). */
export type TipoDocumento = 'CC' | 'CE' | 'PA';
export interface ClienteSocio {
  id: string;
  nombre: string;
  tipoDocumento: TipoDocumento;
  ultimosDigitosDocumento: string;
  estado: 'ACTIVO' | 'BLOQUEADO' | 'INACTIVO';
}
export interface CrearCliente {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  primerNombre: string;
  primerApellido: string;
  fechaNacimiento: string;
  telefono: string;
  email: string;
}
export interface EntidadFinanciera {
  id: string;
  nombre: string;
}
export interface PrecioRequest {
  clienteId: string;
  valorCredito: number;
  plazoRestanteMeses: number;
  entidadAcreedora: string;
}
export interface Cobertura {
  codigo: 'VIDA' | 'HOGAR';
  obligatoria: boolean;
  sumaAsegurada: number;
  primaNeta: number;
  iva: number;
  primaTotal: number;
}
export interface Vigencia {
  desde: string;
  hasta: string;
}
export interface PrecioVenta {
  edad: number;
  datosCredito: {
    valorCredito: number;
    saldoInsoluto: number;
    plazoRestanteMeses: number;
    entidadAcreedora: string;
  };
  origenDatos: 'CONFIRMADO' | 'DECLARADO';
  coberturaMeses: number;
  coberturas: Cobertura[];
  vigenciaCotizacion: Vigencia;
  creadaEn: string;
}
export interface VentaRequest extends PrecioRequest {
  coberturas: ('VIDA' | 'HOGAR')[];
  cuotaMensual: number;
  direccion: string;
  municipio: string;
}
export interface VentaCreada {
  polizaId: string;
  clienteId: string;
  socioId: string;
  numero: string | null;
  estado: 'EMITIDA' | 'PENDIENTE' | 'RECHAZADA' | 'VENCIDA';
  vigencia: Vigencia | null;
  primaTotalMensual: number;
  moneda: 'COP';
  datosCredito: PrecioVenta['datosCredito'];
  datosVenta: { direccion: string; municipio: string; cuotaMensual: number };
}
export interface ProblemaVenta {
  codigo?: string;
  errores?: { campo: string; mensaje: string }[];
}
