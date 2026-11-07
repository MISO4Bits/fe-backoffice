<<<<<<< HEAD
import { Component } from '@angular/core';
=======
import { Component, signal } from '@angular/core';
>>>>>>> develop
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
<<<<<<< HEAD
  styleUrl: './app.scss',
})
export class App {}
=======
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('fe-backoffice-base');
}
>>>>>>> develop
