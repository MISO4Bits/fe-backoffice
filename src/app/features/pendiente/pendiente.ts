import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-pendiente',
  template: `<h1>{{ titulo }}</h1>
    <p class="page-intro">Esta pantalla estará disponible próximamente.</p>`,
})
export class Pendiente {
  protected readonly titulo = inject(ActivatedRoute).snapshot.data['titulo'] as string;
}
