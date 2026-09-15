import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withHashLocation: as rotas viram .../#/epis. O app e publicado em
    // /{slug}/{PROJETO}/{versao}/ e a versao muda a cada publicacao — com hash,
    // navegar e recarregar funcionam sem o servidor precisar saber das rotas.
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withFetch()),
  ],
};
