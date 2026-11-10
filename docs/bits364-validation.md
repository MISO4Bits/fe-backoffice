# BITS-364 — Solicitudes en revisión (BITS-100)

## Alcance

- `/solicitudes`: bandeja exclusiva de ADMIN, ordenada por fecha ascendente.
- `/solicitudes/:id`: cliente y documento completo, crédito y origen, primas,
  pendientes, decisiones anteriores y evidencias de identidad cuando corresponde.
- Aprobación de los pendientes marcados y rechazo con un único motivo vigente.
  El diálogo B21A pertenece a Solicitudes; no se comparte con Siniestros.
- Regreso a la bandeja y recarga después de decidir, ante vencimiento o conflicto.
- Los errores de resultado incierto no se reintentan automáticamente. Se vuelve
  a consultar la bandeja antes de decidir otra vez.

## Contrato

Se consumen las cuatro operaciones de `/v1/backoffice/solicitudes`: listado,
detalle, imagen y decisión. El interceptor existente agrega el token interno.
El agente lo asigna el BFF desde la sesión. No se envían `agente` ni `nota`.

```json
{"decision":"APROBAR","pendientes":["EVIDENCIA_EN_REVISION"]}
```

```json
{"decision":"RECHAZAR","motivo":"CREDITO_NO_VERIFICADO"}
```

La bandeja recorre los cursores una sola vez, deduplica por `polizaId`, conserva
los resultados y pagina localmente de diez en diez. Consulta los detalles con
cuatro trabajadores para completar nombre y documento; una falla conserva la
fila y permite reintentar. El total solo se presenta como definitivo después de
terminar la carga. El listado no es una fotografía transaccional: puede cambiar
mientras se recorre. El backend valida el estado al decidir.

El documento de la tabla se muestra enmascarado; el detalle muestra el documento
completo para comprobar identidad. Los detalles en memoria se limpian al cambiar
de usuario/rol o cerrar sesión. Las imágenes se obtienen como blobs autenticados,
se aceptan JPEG/PNG y se liberan sus URL al abandonar o recargar la pantalla.

## Verificación local

- 125 pruebas del frontend aprobadas, incluidas las nuevas pruebas de contrato,
  cursores, concurrencia limitada, decisiones, imágenes y errores.
- Cobertura global: statements 95.13 %, branches 87.33 %, functions 89.40 %,
  lines 98.03 %.
- Compilación de producción y lint aprobados.
- Playwright/Chromium: bandeja con doce solicitudes, paginación, detalle, imágenes
  ampliadas, diálogo, aprobación parcial, emisión al resolver el último pendiente,
  rechazo, conflicto con una decisión concurrente, escritorio, móvil y guarda SOCIO.
  Dos cuentas Admin verificaron que la aprobación parcial sale de la bandeja del
  primer autor y conserva el pendiente restante para la segunda cuenta.
- El BFF se ejecutó localmente con adaptadores en memoria y datos ficticios. No
  se modificó código del BFF ni se crearon pólizas en entornos compartidos.
- Artefactos de QA ignorados por Git: `.angular/bits364-results/`.

## Límites de esta evidencia

El entorno real debe verificar la persistencia de decisiones, el autor y la fecha,
la emisión atómica de póliza y el texto que finalmente recibe el cliente. Las
pruebas locales no acreditan esos efectos en svc-core desplegado.

Para respetar AC-3, la bandeja omite las solicitudes cuyo historial ya contiene una
decisión del Admin actual (correo de sesión, sin distinguir mayúsculas). Tras una
aprobación parcial quedan disponibles para otro Admin con los pendientes restantes.
El BFF devuelve una bandeja global: este filtro personal se realiza en el frontend
con las decisiones persistidas del detalle, no con una lista temporal de IDs.
