# Verificación visual de BITS-363

final result: passed

Referencias: capturas proporcionadas en la conversación para E01, E01A, E02,
E01S, B10 y Socio 01. E02B pertenece a fe-web y queda fuera de este cambio.

## Método y evidencia

Verificación local con Chromium mediante Playwright, autorizada por el usuario.
Servidor Angular en `http://127.0.0.1:4200/ingreso`.

- Escritorio: viewport de 1440 × 900 CSS px, deviceScaleFactor 1.
- Móvil: viewport de 390 × 844 CSS px, deviceScaleFactor 1.
- Referencias: capturas embebidas en el chat, escaladas por el cliente.
  Se excluyeron el marco gris y los títulos externos de Figma al comparar
  proporciones con las capturas de implementación. No se realizó un diff por píxel.
- Capturas finales en `.angular/bits363-qa/`: `e01-desktop.png`,
  `e01a-desktop.png`, `e02-desktop.png`, `e01s-desktop.png`, `b10-desktop.png`,
  `socio01-desktop.png`, `e01-mobile.png`, `e01a-mobile.png`, `b10-mobile.png`
  y `socio01-mobile.png`. Son artefactos locales ignorados por Git.
- Script local de comprobación: `.angular/bits363-qa.cjs`.

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

- El proveedor sin integración informa que el ingreso aún no está disponible.
- E01A muestra el banner y los dos campos inválidos.
- E02 muestra portal equivocado sin marcar los campos como credenciales inválidas.
- Admin llega al Tablero y ve Tablero, Solicitudes y Siniestros.
- Socio llega a Nueva venta y ve solo Venta.
- Una ruta de otro rol redirige al inicio del rol autenticado.
- Salir vuelve al ingreso para ambos roles; el acceso directo sin sesión se rechaza.
- No se registraron errores de JavaScript ni de consola durante el recorrido.

Los éxitos y errores de autenticación se simularon únicamente desde el script
de navegador, usando las herramientas de depuración del build de desarrollo.
No se incorporaron credenciales de prueba ni un bypass de autenticación a la app.
La verificación real contra el backend y la persistencia/refresco de sesión
siguen pendientes del contrato aprobado de David.
