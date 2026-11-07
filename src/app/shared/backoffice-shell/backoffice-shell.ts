import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-backoffice-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './backoffice-shell.html',
  styleUrl: './backoffice-shell.scss',
})
export class BackofficeShell {
  protected readonly sesion = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly saliendo = signal(false);
  protected async salir(): Promise<void> {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    // No mantener visible la pantalla privada esperando la respuesta remota.
    const cierre = this.sesion.salir().catch(() => {
      /* La sesión local ya está cerrada aunque el cierre remoto falle. */
    });
    try {
      await this.router.navigateByUrl('/ingreso', { replaceUrl: true });
      await cierre;
    } finally {
      this.saliendo.set(false);
    }
  }
}
