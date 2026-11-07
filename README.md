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

## Integración de autenticación pendiente

El contrato de David sigue en revisión. No se asumen endpoints, códigos HTTP,
campos de tokens ni almacenamiento. La aplicación **no acepta credenciales
ficticias**: el proveedor por defecto informa que el ingreso aún no está disponible.
Los escenarios de éxito y error se ejercitan con un proveedor simulado solo en pruebas.

El punto de integración es `AUTH_GATEWAY` en `src/app/core/auth/auth.gateway.ts`.
El modelo `CuentaInterna` es interno del frontend y no define el contrato HTTP.
Cuando se apruebe el PR:

1. Implementar un adaptador `AuthGateway` y registrarlo en `app.config.ts`
   mediante `{ provide: AUTH_GATEWAY, useClass: ... }`.
2. Traducir la respuesta del servicio a `CuentaInterna`. El rol debe provenir
   del servicio, nunca de un selector o del correo ingresado.
3. Traducir los errores del contrato a `FalloIngreso`: `credenciales`, `portal`,
   `limite` o `no-disponible`. Un 403 genérico no basta para identificar portal equivocado.
4. Completar manejo de tokens/cookies, caducidad, refresco, restauración de sesión,
   errores 401/403 de recursos protegidos y cierre remoto conforme al contrato.
5. Verificar los recorridos con cuentas reales de Admin, Socio y cliente.

Por ahora la sesión vive en memoria: recargar la página vuelve al ingreso.
Los guards controlan la navegación del frontend; la API debe autorizar cada operación.
BITS-363 aún no queda cerrada hasta completar y verificar esa integración.
