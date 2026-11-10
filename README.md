# fe-backoffice

Este repo contiene el código del cliente web de backoffice.

## Comandos

| Comando                     | Qué hace                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| `npm start`                 | Servidor de desarrollo                                              |
| `npm run build`             | Build de producción en `dist/fe-backoffice-base/browser`            |
| `npm test -- --watch=false` | Pruebas unitarias (Vitest) con cobertura; falla bajo 80 %           |
| `npm run lint`              | ESLint                                                              |
| `npm run format:check`      | Verifica el formato (Prettier); `npm run format` lo corrige         |
| `npm run tokens:build`      | Regenera `src/styles/_tokens.scss` desde `design/figma-tokens.json` |

`src/styles/_tokens.scss` es un archivo generado: no se edita a mano ni se formatea (está en
`.prettierignore`).

## CI y despliegue

El workflow `.github/workflows/ci.yml` corre en cada pull request y en cada push a `main` y
`develop`:

1. **gitleaks**: busca secretos en el historial.
2. **quality**: ESLint, formato, pruebas y cobertura.
3. **sonar**: espera el quality gate de SonarQube Cloud.
4. **deploy**: solo en un push a `develop`, y solo si pasaron los tres anteriores. Construye y
   publica los archivos estáticos en el bucket `solventa-dev-backoffice`.

El backoffice se sirve en **https://backoffice.solventa4bits.com**, con el mismo balanceador y la
misma red de entrega de contenido del portal de clientes (DI-012). La infraestructura vive en
`iac-gcp-dev/persistent/backoffice.tf` y no se destruye al terminar cada sesión de trabajo.

`index.html` se publica con `Cache-Control: no-store` y los `.js` y `.css` (que llevan hash en el
nombre) con un año de caché, así que no hace falta invalidar la caché de la red de entrega.

### Variables y secretos de GitHub

El repo necesita, en Settings → Secrets and variables → Actions:

- Variable `GCP_WORKLOAD_IDENTITY_PROVIDER`:
  `projects/1091757449262/locations/global/workloadIdentityPools/github-actions/providers/github`
- Variable `GCP_SERVICE_ACCOUNT`: `ci-image-publisher@solventa-admin.iam.gserviceaccount.com`
- Secreto `SONAR_TOKEN`: el token del proyecto `MISO4Bits_fe-backoffice` en SonarQube Cloud.

## Pendiente

- Conectar el build de `deploy` con la API del ambiente: ya existe `npm run build:dev`
  con reemplazo de URL; el workflow todavía ejecuta la configuración `production`.
- Incorporar al CI las pruebas de navegador. La verificación local de BITS-361 se
  describe en [el informe de validación](docs/bits361-validation.md).

## Venta directa del Socio (BITS-361)

La ruta `/venta` implementa las pantallas Socio 01, 01N, 01C, 01A, 01B, 03 y 04.
Se mantienen la sesión y el menú por rol de BITS-363. La HU BITS-231 y sus AC
tienen prioridad sobre los ejemplos del prototipo.

### Contrato y reglas

Contrato de referencia: PR `MISO4Bits/bff-web#30`, commit
`633bd0483227f9c24db2212fb2e4286e00aacb00`. No se modificó su rama ni se aprobó el PR.

- Búsqueda por documento, correo o ambos. Con ambos se hacen dos GET separados:
  mismo ID permite continuar; dos 404 abren el alta; IDs distintos, o un 404
  y una coincidencia, bloquean el avance con un error por campo.
- Los errores de red/servidor no se interpretan como cliente nuevo.
- El alta precarga los criterios ingresados y envía nombres/apellidos completos
  como `primerNombre`/`primerApellido`. No solicita ni transmite contraseña o
  consentimientos. Los duplicados 409 se muestran en correo o documento.
- Solo se muestran el nombre y los últimos cuatro dígitos del documento del
  cliente encontrado. No se consulta su historial ni Open Finance/Open Data.
- Datos de la venta pide banco, monto, plazo, cuota mensual, dirección y municipio
  (texto libre por acuerdo). El banco se envía por su nombre, según el contrato.
- El precio se pide cuando banco, monto y plazo son válidos; se descartan
  respuestas tardías si el crédito cambia. Vida es obligatoria; Tu casa/Hogar es
  opcional. Las primas, impuestos y sumas aseguradas provienen del backend.
- La edad y el estado del cliente son validados por el backend. El frontend
  bloquea además el monto menor a 10.000.000, los campos incompletos y los rangos
  del contrato. Un precio vencido se actualiza antes de permitir confirmar.
- Cada alta y cada intento de venta tienen claves `Idempotency-Key` separadas.
  Un reintento del mismo cuerpo conserva la clave; un doble envío se bloquea.
  Si una emisión queda sin confirmar por timeout/error de servidor, el formulario
  mantiene su cuerpo y clave, bloquea su edición y permite reintentar esa emisión.
- La confirmación usa número, prima y vigencia de la póliza EMITIDA devuelta por
  el BFF. Nueva venta limpia los datos de la operación anterior.
- El interceptor solo redirige un 403 con `ROL_NO_PERMITIDO`. Los errores de
  negocio, como `CLIENTE_NO_ACTIVO`, permanecen en el flujo con su mensaje.

Se consumen exclusivamente las cinco rutas `/v1/socio`: `clientes` (GET/POST),
`entidades-financieras`, `ventas/precio` y `ventas`. No se crea una cotización del
autoservicio ni se envía `socioId`: el BFF lo toma del token.

### Probar en local

Se necesita un BFF con BITS-378 disponible y una cuenta SOCIO. El `develop` del BFF
anterior a ese PR permite autenticarse, pero todavía no ofrece las rutas de venta.

```powershell
# BFF local en 8081, frontend en 4201:
npm start -- --port 4201

# Si ejecutas una copia aislada del BFF en otro puerto, reinicia ng serve con:
$env:BFF_PROXY_TARGET = 'http://127.0.0.1:8084'
npm start -- --port 4201
```

Los scripts `tools/start-local-bff.py` y `tools/start-local-frontend.ps1` permiten
probar con usuarios ADMIN/SOCIO en memoria. El primero acepta `--bff-path` para
apuntar a una copia separada del backend; el segundo acepta `-Port` y `-BffPort`.
Las credenciales de esos scripts son de prueba, no cuentas del entorno compartido.

Se verificó el flujo con una copia de solo lectura del commit del PR, exportada a
`.angular` y ejecutada con adaptadores en memoria. Las capturas y scripts de QA
en `.angular/bits361-results` son artefactos locales ignorados por Git.

Pendiente de verificación en el entorno integrado: tarifa real, correos/documento
de póliza y conservación de cotizaciones, solicitudes y evidencias en svc-core
(AC-6). El frontend no consulta ni modifica esos recursos. No se afirma que las
pruebas con adaptadores en memoria validen la persistencia o notificaciones reales.

## BITS-364 — Solicitudes en revisión

El Admin dispone de la bandeja `/solicitudes` y el detalle `/solicitudes/:id`:
datos del cliente y crédito, primas, historial de decisiones y evidencias
autenticadas. Puede aprobar los pendientes que verificó o rechazar con un solo
motivo, sin nota. El BFF registra el autor desde la sesión.

La bandeja recorre todos los cursores, completa nombre y documento consultando
los detalles con concurrencia limitada y pagina los resultados en memoria.
Al decidir vuelve a cargar la bandeja y excluye las solicitudes cuyo historial
ya contiene una decisión del Admin actual. Los conflictos, vencimientos y respuestas
inciertas se informan sin repetir automáticamente la operación.

Para probar se necesita una cuenta ADMIN y el BFF con BITS-376 disponible. La
configuración de proxy y arranque local es la misma descrita anteriormente.
El alcance, la evidencia y las verificaciones pendientes de integración están
en [docs/bits364-validation.md](docs/bits364-validation.md).
