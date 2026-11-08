import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tablero',
  imports: [RouterLink],
  template: ` <h1>Lo que hay por decidir</h1>
    <p class="page-intro">Corte al 3 de noviembre de 2026, 8:00 a. m.</p>
    <div class="summary-grid">
      <section class="summary-card" aria-labelledby="solicitudes-titulo">
        <h2 id="solicitudes-titulo">SOLICITUDES EN REVISIÓN</h2>
        <p class="count">5</p>
        <a routerLink="/solicitudes"
          >Ver la bandeja <span class="chevron" aria-hidden="true"></span
        ></a>
      </section>
      <section class="summary-card" aria-labelledby="siniestros-titulo">
        <h2 id="siniestros-titulo">SINIESTROS EN ESTUDIO</h2>
        <p class="count">5</p>
        <a routerLink="/siniestros"
          >Ver la bandeja <span class="chevron" aria-hidden="true"></span
        ></a>
      </section>
    </div>`,
  styles: `
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
      margin-top: 24px;
    }
    .summary-card {
      background: var(--mat-sys-on-primary);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 24px;
    }
    h2 {
      margin: 0;
      font-size: 12px;
      line-height: 16px;
      color: var(--mat-sys-outline);
      font-weight: 600;
    }
    .count {
      font-size: 40px;
      line-height: 48px;
      margin: 4px 0 12px;
      font-weight: 700;
    }
    a {
      color: var(--mat-sys-primary);
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .chevron {
      display: inline-block;
      width: 16px;
      height: 16px;
      background: currentColor;
      mask: url('/assets/icons/chevron-right.svg') center / contain no-repeat;
    }
    @media (max-width: 700px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Tablero {}
