import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-estado',
  imports: [RouterLink],
  template: `
    <h2>{{ titulo() }}</h2>
    <p>{{ descripcion() }}</p>
    <a class="primary" [routerLink]="ruta()">{{ accion() }}</a>
  `,
  styles: `
    :host {
      display: block;
      text-align: center;
      padding: 36px 16px 48px;
    }
    h2 {
      font-size: 18px;
      margin: 0;
    }
    p {
      margin: 6px 0 24px;
    }
    a {
      display: inline-block;
      padding: 14px 32px;
      text-decoration: none;
    }
  `,
})
export class Estado {
  readonly tipo = input.required<'vacio'>();
  readonly titulo = input.required<string>();
  readonly descripcion = input.required<string>();
  readonly ruta = input.required<string>();
  readonly accion = input.required<string>();
}
