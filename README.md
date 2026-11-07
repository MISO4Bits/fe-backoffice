# fe-backoffice

Este repo contiene el código del cliente web de backoffice.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/fe-backoffice-base/browser` |
| `npm test -- --watch=false` | Pruebas unitarias (Vitest) con cobertura; falla bajo 80 % |
| `npm run lint` | ESLint |
| `npm run format:check` | Verifica el formato (Prettier); `npm run format` lo corrige |
| `npm run tokens:build` | Regenera `src/styles/_tokens.scss` desde `design/figma-tokens.json` |

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

- La URL de la API por ambiente (hoy el build de `deploy` no apunta a ningún BFF): se agrega con una
  configuración `dev` de Angular con reemplazo de archivo, como en `fe-web`.
- Pruebas e2e (Playwright), cuando haya pantallas que probar.
