# fe-backoffice

Cliente Angular del Backoffice de Solventa. Comparte Angular 21.2, tokens,
tema, retícula y fuentes con `fe-web`.

## Desarrollo y validación

```sh
npm install
npm start
npm run build
npm test -- --watch=false
```

## Alcance de BITS-363

| Pantalla o recorrido                          | Estado                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| E01 / E01S: login compartido de Admin y Socio | Formulario, validaciones y estado de espera                        |
| E01A: credenciales inválidas                  | Banner y campos con estado de error                                |
| E02: cliente en Backoffice                    | Mensaje de portal equivocado, separado de credenciales inválidas   |
| B10: Tablero                                  | Vista estática con cifras y fecha del prototipo                    |
| Socio 01: Nueva venta                         | Vista estática; controles deshabilitados, sin búsqueda de clientes |
| Menú por rol                                  | Admin: Tablero, Solicitudes, Siniestros; Socio: Venta              |
| Acceso por URL a otro rol                     | Redirección al inicio del rol autenticado                          |
| Salir                                         | Limpieza de sesión local y regreso al login                        |
| Solicitudes y Siniestros                      | Marcadores de pantalla; funcionalidad fuera de este alcance        |
| E02B: cuenta interna en fe-web                | Pendiente para un cambio posterior en ese repositorio              |

## Autenticación integrada

### Prueba local con Admin y Socio

Desde fe-backoffice, abre dos terminales. Si ya hay un BFF o frontend en los
puertos 8081 y 4201, detén esos procesos con Ctrl+C antes de usar los scripts.

Primera terminal (requiere las dependencias instaladas en `.venv` de bff-web):

```powershell
..\bff-web\.venv\Scripts\python.exe -B .\tools\start-local-bff.py
```

Segunda terminal:

```powershell
.\tools\start-local-frontend.ps1
```

Abre `http://localhost:4201`. Usuarios locales:

| Correo | Contraseña de prueba | Rol |
| --- | --- | --- |
| admin@solventa4bits.com | PruebaLocal363! | ADMIN |
| socio@solventa4bits.com | PruebaLocal363! | SOCIO |

El script de BFF fuerza adaptadores en memoria y siembra ambas cuentas en cada
arranque. No modifica el arranque normal del BFF, archivos de ese repositorio
ni cuentas de Identity Platform. Estas credenciales no sirven en entornos reales.
Puedes usar el Admin local en Postman para crear más cuentas en ese proceso.

Para otros puertos, combina `start-local-bff.py --port 8083` con
`start-local-frontend.ps1 -Port 4203 -BffPort 8083`. Para verificar la siembra sin
abrir un servidor, agrega `--check` al comando Python.

### Contrato del canal interno

`HttpAuthGateway` implementa `AUTH_GATEWAY` con el contrato actualizado de
`bff-web` (BITS-375). La HU y sus AC tienen prioridad sobre el prototipo.

- `POST /v1/backoffice/sesiones`: `{ email, password }`.
- `POST /v1/backoffice/sesiones/refresco`: `{ refreshToken }`.
- Respuesta: `accessToken`, `refreshToken`, `expiresIn`, `rol`, `nombre` opcional
  y `tokenType` opcional (Bearer). No se exige un uid que el contrato no devuelve.
- El rol viene de la respuesta del backend. No se infiere del correo ni se elige en el formulario.
- 401 en ingreso: credenciales incorrectas. 403 con `ACCESO_POR_PORTAL_CLIENTE`:
  “Tu acceso es por solventa4bits.com”. 403 con `CUENTA_SIN_ROL`: mensaje de cuenta
  sin rol. Otros errores no se confunden con portal equivocado.
- Al navegar o pedir un recurso interno, refresco si faltan menos de 30 segundos
  para vencer, compartido entre solicitudes concurrentes.
  Un 401 en un recurso interno permite un refresco y un solo reintento.
- Un 403 de un recurso interno devuelve al inicio del rol; un 401 definitivo
  borra sesión y vuelve al login.
- El Bearer solo se agrega a `/v1/backoffice/*` y `/v1/socio/*` del BFF configurado;
  no se agrega a los endpoints de sesión ni a las rutas del cliente u otros dominios.
- Los tokens viven únicamente en memoria: recargar la página requiere iniciar
  sesión otra vez. Salir borra todos los datos locales; no hay endpoint de logout
  remoto en el contrato. Una respuesta tardía de refresco no restaura la sesión.

### Conectar al backend

La base de API es `/web`, igual que fe-web. En local, el proxy de Angular elimina
ese prefijo y reenvía al BFF en `http://localhost:8081`.

```powershell
# Ejecutar en fe-backoffice, con bff-web levantado y cuentas internas ya creadas:
npm start -- --port 4201

# Para usar otro BFF local (requiere reiniciar ng serve):
$env:BFF_PROXY_TARGET = 'http://localhost:8082'
npm start -- --port 4201
```

`npm run build:dev` construye para la API de desarrollo
`https://dev.solventa4bits.com/web`. El build normal conserva `/web` para un
despliegue con API bajo el mismo origen. La base se configura en
`src/app/core/config/api-base-url*.ts`; no incluye `/v1`.

No hay cuentas ficticias ni contraseñas incluidas en la aplicación. Para verificar
contra el entorno compartido se necesitan cuentas Admin y Socio sembradas y el
BFF desplegado con este contrato. AC-5 corresponde al endpoint de alta del backend;
este alcance no agrega una pantalla de creación de usuarios.

E02B y el enlace desde el portal del cliente siguen pendientes en `fe-web`, por
decisión de alcance. Los guards controlan la navegación; la API autoriza cada operación.
