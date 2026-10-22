import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { iniciarTema } from './app/tema';

// antes do bootstrap: a tela já nasce no tema certo (ver src/app/tema.ts)
iniciarTema();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
