# Validación BITS-361 / BITS-231

## Referencias y alcance

- HU principal BITS-231 y subtarea BITS-361 aportadas en la conversación.
- Capturas Socio 01, 01N, 01C, 01A, 01B, 03 y 04.
- Contrato y código del PR bff-web #30, commit `633bd04`.
- Acuerdos: si documento y correo no coinciden (también si uno da 404), se bloquea;
  municipio es texto libre; HU/AC prevalecen sobre Figma.

## Evidencia automática

- 92 pruebas unitarias/de componentes/HTTP aprobadas.
- Cobertura: statements 96,23 %, branches 87,02 %, functions 93,84 %, lines 97,95 %.
- Lint y formato verificados; builds de producción y desarrollo verificados.
- Navegador: Chromium, 1440 × 900 y 390 × 844 CSS px, escala 1.
- API en una copia exportada a `.angular/bits361-bff-633bd04`, con adaptadores en
  memoria. No se cambió el checkout, la rama, el PR ni el código del repositorio bff-web.

El script `.angular/bits361-browser.cjs` usa los endpoints HTTP del BFF. Comprueba
búsqueda consistente e inconsistente, cliente nuevo, conflicto 409, precio,
doble envío, emisión incierta, reintento idempotente, cliente inactivo, edad y Salir.
Para la emisión incierta se deja que el BFF emita y se reemplaza únicamente la
primera respuesta al navegador por 503; el reintento mantiene el cuerpo y la clave
y recupera el mismo número de póliza. Los artefactos están en
`.angular/bits361-results/result.json` y sus capturas PNG, ignorados por Git.

## Comparación visual

final result: passed

Se compararon las capturas con las referencias del chat, excluyendo el marco de
Figma y normalizando la escala del lienzo a 1440 × 900. Se revisaron fuentes,
espaciados, colores, controles, contenido, mensajes por campo y distribución de
tarjetas. Se corrigió la validación visual de documentos formateados y la altura
de los bloques de Datos de la venta. En móvil las columnas se apilan sin
desbordamiento horizontal. No quedan problemas P0/P1/P2 detectados.

Diferencias deliberadas: municipio de texto; valores, número y vigencia proceden
del BFF; no se copia la cifra inconsistente de Tu casa del prototipo ni se fija
una tasa en el frontend. La tarjeta Vida no puede desmarcarse. Las fechas usan
el formato local de Colombia. Las pantallas se abren sin datos personales precargados.

## Correspondencia con los AC

| AC  | Evidencia y límite                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Búsqueda por criterio, comparación por ID y bloqueo de inconsistencias; vista enmascarada.                                                                      |
| 2   | Alta precargada, nombres completos, validación y 409 por campo. Generación/envío de contraseña son responsabilidad del backend.                                 |
| 3   | Una pantalla con crédito, inmueble, coberturas y prima del backend. No hay consulta de Open Finance/Data ni valor del inmueble.                                 |
| 4   | Validaciones de monto/cuota/plazo/campos y tratamiento de FUERA_DE_RANGO; no se recalcula la edad de un cliente existente en frontend.                          |
| 5   | Confirmación EMITIDA y clave idempotente, incluso con primera respuesta perdida. Número y vigencia reales se verificaron en el BFF con datos en memoria.        |
| 6   | Solo se llaman rutas de Socio; no hay llamadas de lectura/escritura al journey del cliente. Falta verificar la conservación real en svc-core con datos previos. |
| 7   | Estado inactivo en búsqueda y error CLIENTE_NO_ACTIVO al cotizar/emitir bloquean sin cerrar la sesión del Socio.                                                |

No sustituye la validación del BFF desplegado con cuentas reales, svc-core,
svc-cotizacion y entrega de correos/documentos. Las tasas de los adaptadores fake
son de prueba; no certifican la igualdad de tarifas reales entre canales.
