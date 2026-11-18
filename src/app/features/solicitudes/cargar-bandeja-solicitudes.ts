import { SolicitudesApiService } from './solicitudes-api.service';
import { esPendienteAgente, FilaSolicitud } from './solicitudes.models';

export async function cargarBandejaSolicitudes(
  api: SolicitudesApiService,
  vigente: () => boolean,
  publicar?: (filas: Map<string, FilaSolicitud>) => void,
): Promise<FilaSolicitud[]> {
  const filas = new Map<string, FilaSolicitud>();
  const cursores = new Set<string>();
  let cursor: string | undefined;
  do {
    const resultado = await api.pagina(cursor);
    if (!vigente()) return [];
    for (const resumen of resultado.items) {
      if (resumen.estado === 'PENDIENTE' && resumen.pendientes.some(esPendienteAgente))
        filas.set(resumen.polizaId, { resumen });
    }
    publicar?.(filas);
    cursor = resultado.siguienteCursor || undefined;
    if (cursor && cursores.has(cursor)) throw new Error('Cursor repetido');
    if (cursor) cursores.add(cursor);
  } while (cursor);

  const pendientes = [...filas.values()];
  let indice = 0;
  const completar = async () => {
    while (vigente() && indice < pendientes.length) {
      const fila = pendientes[indice++];
      try {
        const detalle = await api.detalle(fila.resumen.polizaId);
        if (!vigente()) return;
        if (!api.esperaMiRevision(detalle)) filas.delete(detalle.polizaId);
        else filas.set(detalle.polizaId, { resumen: detalle, cliente: detalle.cliente });
      } catch {
        if (!vigente()) return;
        filas.set(fila.resumen.polizaId, { ...fila, errorDetalle: true });
      }
      publicar?.(filas);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pendientes.length) }, completar));
  return [...filas.values()];
}
