import { Component } from '@angular/core';

@Component({
  selector: 'app-nueva-venta',
  template: ` <h1>Nueva venta</h1>
    <p class="page-intro">Busca al cliente por su documento o su correo.</p>
    <section class="sale-card" aria-labelledby="datos-cliente">
      <h2 id="datos-cliente">DOCUMENTO O CORREO DEL CLIENTE</h2>
      <div class="sale-fields">
        <div class="field">
          <label for="tipo-documento">Tipo de documento</label
          ><select id="tipo-documento" disabled>
            <option>C.C.</option>
          </select>
        </div>
        <div class="field">
          <label for="numero-documento">Número de documento</label
          ><input id="numero-documento" placeholder="1.020.340.001" disabled />
        </div>
        <span class="or">o</span>
        <div class="field">
          <label for="correo-cliente">Correo electrónico</label
          ><input id="correo-cliente" type="email" placeholder="sofia.r@correo.com" disabled />
        </div>
        <button class="primary" type="button" disabled>Continuar</button>
      </div>
      <p class="hint">Basta con uno de los dos.</p>
    </section>`,
  styles: `
    .sale-card {
      background: var(--mat-sys-on-primary);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 24px 24px 16px;
      margin-top: 24px;
    }
    h2 {
      margin: 0 0 16px;
      font-size: 10px;
      line-height: 12px;
      color: var(--mat-sys-primary);
      font-weight: 600;
    }
    .sale-fields {
      display: grid;
      grid-template-columns: 180px 1fr 24px 1.4fr 196px;
      align-items: center;
      gap: 16px;
    }
    .hint {
      margin: 12px 0 0;
      font-size: 12px;
      line-height: 16px;
      color: var(--mat-sys-outline);
    }
    .or {
      text-align: center;
      color: var(--mat-sys-outline);
    }
    @media (max-width: 1100px) {
      .sale-fields {
        grid-template-columns: 1fr 2fr;
      }
      .or {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 600px) {
      .sale-fields {
        grid-template-columns: 1fr;
      }
      .sale-card {
        padding: 24px 16px;
      }
    }
  `,
})
export class NuevaVenta {}
