# BITS-365 — Decidir siniestros (BITS-114)

## Alcance implementado

- `/siniestros`: bandeja solo para ADMIN. «En estudio» consulta `estado=EN_ESTUDIO&automatico=false`, ordena por `fechaLimite` y pagina de cinco en cinco. «Pagos automáticos» consulta `estado=PAGADO&automatico=true`, completa fecha e importe desde cada detalle y muestra enlaces de solo lectura.
- `/siniestros/:id`: un detalle para incapacidad total, hogar y sismo paramétrico. Muestra cliente y documento cuando `cliente` está disponible, póliza, saldo guardado y origen, destino elegido, evidencias, pedido posterior e historial de decisiones.
- Las evidencias se leen como blobs autenticados; solo se aceptan JPEG/PNG. Se abren ampliadas sin descargarlas y se liberan sus URL al abandonar la pantalla.
- Incapacidad total envía `{ "decision": "PAGAR" }`, sin valor ni daño. Hogar exige `REPARABLE` o `PERDIDA_TOTAL` y un valor positivo que no supere la suma asegurada. La vista previa distribuye la pérdida total entre el banco y el cliente; el BFF y svc-core determinan la orden definitiva.
- Pedir evidencia envía `detalle`; rechazar envía `motivo`. Son diálogos de texto propios de Siniestros. El frontend nunca envía `agente`.
- Tras decidir o detectar un conflicto, se vuelve a la bandeja y se consulta su estado actualizado. Ante un resultado incierto no se reintenta automáticamente el pago.

## Contrato y límites

Se consumen `GET /v1/backoffice/siniestros`, `GET /v1/backoffice/siniestros/{id}`, `GET /v1/backoffice/siniestros/{id}/evidencias/{evidenciaId}` y `POST /v1/backoffice/siniestros/{id}/decisiones` del contrato actualizado. `fechaOcurrencia` es una fecha sin hora. `cliente` puede ser `null`; la pantalla conserva el número de siniestro y muestra «Cliente no disponible».

El contrato agrupa incendio y terremoto de hogar en `INCENDIO_TERREMOTO`. No ofrece un subtipo que permita distinguirlos de forma fiable en la bandeja o el detalle; por ello se muestra «Incendio o terremoto». Si AC1 y AC2 requieren la distinción exacta de Figma, svc-core/BFF deben exponerla.

La respuesta de la bandeja no trae fecha ni importe del pago automático. Se consultan los detalles con hasta cuatro solicitudes concurrentes para completarlos. Si falla un detalle, la fila sigue visible y muestra «No disponible» en esos campos.

## Verificación

- `npm run build`: correcto.
- `npm run lint`: correcto.
- `npm test -- --watch=false`: 143 pruebas aprobadas; cobertura global superior a 80 % en statements, branches, functions y lines.
- Playwright local con respuestas ficticias: capturas de B30, B31, B31A, B30A y B36 en `.angular/bits365-visual/`. Se comprobaron la navegación, el modal de pago, el importe automático y la ausencia de botones de decisión en B36. Estas capturas no validan persistencia, órdenes de pago ni notificaciones reales.

Para validar de extremo a extremo en el entorno integrado se necesitan cuentas Admin y siniestros de los tres tipos, incluidos uno que volvió con evidencia y otro automático pagado. La emisión de la orden, la idempotencia y los avisos al cliente pertenecen a svc-core y otros servicios; el frontend presenta la respuesta y evita repetir automáticamente una decisión de resultado incierto.
