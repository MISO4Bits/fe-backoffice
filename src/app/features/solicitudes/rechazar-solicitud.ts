import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { motivoRechazo, PendienteAgente } from './solicitudes.models';

/** Diálogo propio de Solicitudes (B21A). No comparte implementación con Siniestros. */
@Component({
  selector: 'app-rechazar-solicitud',
  template: `<dialog
    #dialogo
    aria-labelledby="rechazo-titulo"
    aria-describedby="rechazo-descripcion"
    (cancel)="cancelar($event)"
  >
    <h2 id="rechazo-titulo">Rechazar la solicitud</h2>
    <p id="rechazo-descripcion">
      El cliente verá el texto del motivo. Los motivos salen de los pendientes de la solicitud.
    </p>
    <form (submit)="enviar($event)">
      <label for="motivo-rechazo">MOTIVO</label>
      <select
        id="motivo-rechazo"
        [value]="seleccion()"
        (change)="seleccion.set($any($event.target).value)"
        required
      >
        <option value="" disabled>Selecciona un motivo</option>
        @for (motivo of motivos(); track motivo) {
          <option [value]="motivo">{{ texto(motivo) }}</option>
        }
      </select>
      <div class="acciones">
        <button type="button" class="secondary" (click)="cerrar.emit()">Cancelar</button
        ><button class="primary" type="submit" [disabled]="!seleccion()">Rechazar</button>
      </div>
    </form>
  </dialog>`,
  styles: `
    dialog {
      width: min(460px, calc(100vw - 80px));
      border: 0;
      border-radius: 16px;
      padding: 32px;
      color: var(--mat-sys-on-surface);
      background: var(--mat-sys-on-primary);
    }
    dialog::backdrop {
      background: rgb(21 32 32 / 55%);
    }
    h2 {
      font-size: 20px;
      margin: 0 0 8px;
    }
    p {
      color: var(--mat-sys-on-surface-variant);
      font-size: 13px;
      margin: 0 0 32px;
    }
    label {
      font-size: 10px;
      display: block;
      margin-bottom: 4px;
    }
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      background: var(--mat-sys-on-primary);
      color: inherit;
    }
    .acciones {
      display: flex;
      gap: 16px;
      margin-top: 24px;
    }
    .acciones button {
      border-radius: 10px;
      min-height: 48px;
      padding: 12px 24px;
    }
    .primary {
      flex: 1;
    }
  `,
})
export class RechazarSolicitud implements AfterViewInit {
  readonly motivos = input.required<PendienteAgente[]>();
  readonly confirmar = output<PendienteAgente>();
  readonly cerrar = output<void>();
  readonly seleccion = signal<PendienteAgente | ''>('');
  readonly texto = motivoRechazo;
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  ngAfterViewInit(): void {
    this.dialogo().nativeElement.showModal();
  }
  cancelar(event: Event): void {
    event.preventDefault();
    this.cerrar.emit();
  }
  enviar(event: Event): void {
    event.preventDefault();
    const motivo = this.seleccion();
    if (motivo && this.motivos().includes(motivo)) this.confirmar.emit(motivo);
  }
}
