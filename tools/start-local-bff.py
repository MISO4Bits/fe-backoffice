"""Arranque local de bff-web con Admin y Socio en memoria; no modifica Identity Platform."""

import argparse
import asyncio
from pathlib import Path
import secrets
import sys

sys.dont_write_bytecode = True

USUARIOS = (
    ("admin@solventa4bits.com", "ADMIN", "Admin local"),
    ("socio@solventa4bits.com", "SOCIO", "Socio local"),
)
CLAVE_LOCAL = "PruebaLocal363!"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--bff-path", type=Path, default=Path(__file__).resolve().parents[2] / "bff-web")
    parser.add_argument("--check", action="store_true", help="Verifica las cuentas sin iniciar el servidor")
    args = parser.parse_args()
    if not (args.bff_path / "app" / "api" / "app.py").is_file():
        parser.error("No se encontró bff-web. Indica su carpeta con --bff-path.")
    sys.path.insert(0, str(args.bff_path.resolve()))
    try:
        import uvicorn
        from app.api.app import create_app
        from app.config import Settings
    except ImportError as error:
        parser.error(f"Usa el Python del entorno .venv de bff-web con sus dependencias instaladas: {error}")

    app = create_app(Settings(
        _env_file=None,
        _secrets_dir=str(Path(__file__).resolve().parent),
        adapters="fake",
        environment="local",
        session_secret=secrets.token_urlsafe(32),
        otel_enabled=False,
        cors_origins="http://localhost:4201",
    ))
    for correo, rol, nombre in USUARIOS:
        app.state.deps.identity.sembrar_personal(correo, CLAVE_LOCAL, rol, nombre)

    if args.check:
        async def comprobar():
            import httpx
            try:
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                    for correo, rol, _ in USUARIOS:
                        response = await client.post("/v1/backoffice/sesiones", json={"email": correo, "password": CLAVE_LOCAL})
                        if response.status_code != 200 or response.json().get("rol") != rol:
                            raise RuntimeError(f"No se pudo verificar el usuario local con rol {rol}")
                        print(f"Ingreso {rol}: OK")
            finally:
                await app.state.deps.aclose()
        asyncio.run(comprobar())
        return

    print("\nBFF LOCAL: adaptadores en memoria, sin servicios reales.")
    for correo, rol, _ in USUARIOS:
        print(f"  {rol}: {correo}")
    print(f"  Contraseña para ambos: {CLAVE_LOCAL}")
    print("Las cuentas adicionales creadas por Postman se pierden al reiniciar.\n", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
