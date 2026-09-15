import { Routes } from '@angular/router';
import { EpisPage } from './pages/epis.page';

/**
 * Uma rota por tela. O app é servido num subcaminho (/{slug}/{PROJETO}/{versao}/),
 * então use sempre caminhos relativos — nada de href absoluto começando em "/".
 */
export const routes: Routes = [
  { path: 'epis', component: EpisPage, title: 'Controle de EPIs — Minha Tela Personalizada' },
  { path: '', pathMatch: 'full', redirectTo: 'epis' },
  { path: '**', redirectTo: 'epis' },
];
