import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ErrorIngreso, FalloIngreso } from '../../core/auth/auth.gateway';
import { SessionService } from '../../core/auth/session.service';

const MENSAJES: Record<ErrorIngreso, string> = {
  credenciales: 'Correo o contraseña incorrectos',
  portal: 'Tu acceso es por solventa4bits.com',
  limite: 'Demasiados intentos. Inténtalo más tarde.',
  'no-disponible': 'No pudimos iniciar sesión. Inténtalo nuevamente.',
  'sin-rol': 'Tu cuenta no tiene un rol habilitado para el Backoffice. Contacta al administrador.',
};

/** Basado en src/app/features/login de fe-web: mismos campos y validaciones. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly sesion = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly esperando = signal(false);
  protected readonly error = signal('');
  protected readonly credencialesInvalidas = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected limpiarError(): void {
    this.error.set('');
    this.credencialesInvalidas.set(false);
  }

  protected async ingresar(): Promise<void> {
    if (this.form.invalid || this.esperando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.limpiarError();
    this.esperando.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.sesion.ingresar(email.trim(), password);
      await this.router.navigateByUrl(this.sesion.inicio());
    } catch (error) {
      const motivo = error instanceof FalloIngreso ? error.motivo : 'no-disponible';
      this.error.set(MENSAJES[motivo]);
      this.credencialesInvalidas.set(motivo === 'credenciales');
    } finally {
      this.esperando.set(false);
    }
  }
}
