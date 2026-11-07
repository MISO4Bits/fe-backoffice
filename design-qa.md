# Verificación visual de BITS-363

final result: passed

Referencias: capturas proporcionadas en la conversación para E01, E01A, E02,
E01S, B10 y Socio 01. E02B pertenece a fe-web y queda fuera de este cambio.

## Método y evidencia

Verificación local con Chromium mediante Playwright, autorizada por el usuario.
Servidor Angular en `http://127.0.0.1:4200/ingreso`.

Actualización de integración: servidor aislado en `http://127.0.0.1:4202/ingreso`
con proxy a bff-web local en 8082. Se ejecutó el código real de rutas, sesiones,
validación de roles y emisión de JWT del BFF con adaptadores en memoria y tres
cuentas temporales (Admin, Socio y sin rol). No se modificaron los fuentes del BFF.

- Escritorio: viewport de 1440 × 900 CSS px, deviceScaleFactor 1.
- Móvil: viewport de 390 × 844 CSS px, deviceScaleFactor 1.
- Referencias: capturas embebidas en el chat, escaladas por el cliente.
  Se excluyeron el marco gris y los títulos externos de Figma al comparar
  proporciones con las capturas de implementación. No se realizó un diff por píxel.
- Capturas de la integración actualizada en `.angular/bits363-integration/`: `e01-desktop.png`,
  `e01a-desktop.png`, `e02-desktop.png`, `e01s-desktop.png`, `b10-desktop.png`,
  `socio01-desktop.png`, `e01-mobile.png`, `e01a-mobile.png`, `b10-mobile.png`
  y `socio01-mobile.png`, más `cuenta-sin-rol.png`. Son artefactos locales ignorados por Git.
- Script de la integración: `.angular/bits363-integration.cjs`.
  Resultado y estados HTTP en `.angular/bits363-integration/result.json`.

## Comparación visual

Se revisaron las vistas completas y los campos, banners, menús y tarjetas a
detalle. Se reutilizaron Plus Jakarta Sans y Dancing Script locales y los
tokens del tema compartido con fe-web. Los textos y estados coinciden con las
referencias; los campos comienzan vacíos en la aplicación y solo se llenan
para las capturas. Los fondos y colores operativos usan el sistema de tokens.
Los iconos proceden de los recursos existentes y Material Symbols, con licencia incluida.

Se corrigieron la altura del encabezado privado, la altura de las tarjetas del
Tablero, el icono de acceso a las bandejas y el espaciado de Nueva venta.
Las capturas móviles muestran controles y tarjetas apilados sin recortes ni
desbordamiento horizontal. No se detectaron problemas P0, P1 o P2 pendientes.

## Interacciones verificadas

- El login realiza POST al endpoint de sesiones de Backoffice del BFF.
- E01A muestra el banner y los dos campos inválidos.
- E02 muestra portal equivocado sin marcar los campos como credenciales inválidas.
- Admin llega al Tablero y ve Tablero, Solicitudes y Siniestros.
- Socio llega a Nueva venta y ve solo Venta.
- Una ruta de otro rol redirige al inicio del rol autenticado.
- Salir vuelve al ingreso para ambos roles; el acceso directo sin sesión se rechaza.
- El refresco real devuelve 200 y conserva la cuenta y el rol.
- El recurso interno de siniestros devuelve 200 para Admin y 403 para Socio.
  El interceptor devuelve al Socio a Venta sin cerrar su sesión.
- Una cuenta sin rol recibe el mensaje correspondiente, distinto de portal equivocado.
- No se registraron excepciones de JavaScript. Los 401/403 de las pruebas negativas
  son respuestas esperadas de la API.

El recorrido actualizado no intercepta respuestas HTTP ni reemplaza el proveedor
de autenticación del frontend. Se adelantó el vencimiento local del token solo
para disparar el refresco sin esperar el TTL completo; la respuesta se obtuvo
del BFF. Las cuentas temporales y los scripts permanecen en `.angular`, ignorado
por Git; no se incorporaron credenciales de prueba ni bypasses a la app.

La integración añade pruebas HTTP con `HttpTestingController` para los errores,
rotación concurrente, expiración, un solo reintento ante 401, rechazo por rol,
aislamiento del Bearer y respuestas tardías tras cierre o cambio de sesión.
La suite de componentes/rutas y HTTP tiene 44 pruebas aprobadas.

Pendiente externo: validar contra el BFF desplegado con cuentas reales y su
configuración de gateway. Por alcance acordado, no se modificó fe-web (E02B).
La sesión permanece en memoria como en fe-web; recargar requiere nuevo ingreso.
