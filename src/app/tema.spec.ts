import { afterEach, describe, expect, it } from 'vitest';
import { MENSAGEM_TEMA, aplicarTema, iniciarTema, temaDaMensagem } from './tema';

/**
 * Contrato com o ERP (nimitz, ExtensaoExternaComponent): ao carregar a tela e a cada troca de
 * tema, o ERP envia por postMessage {tipo: 'filt:tema', escuro: boolean}. A tela não lê o ERP
 * (o iframe é isolado e a revisão reprova acesso à janela pai) — só escuta.
 */
describe('tema claro/escuro', () => {
  afterEach(() => document.documentElement.removeAttribute('data-tema'));

  it('o tipo da mensagem é o combinado com o ERP', () => {
    expect(MENSAGEM_TEMA).toBe('filt:tema');
  });

  it('temaDaMensagem aceita só o formato do contrato', () => {
    expect(temaDaMensagem({ tipo: 'filt:tema', escuro: true })).toBe(true);
    expect(temaDaMensagem({ tipo: 'filt:tema', escuro: false })).toBe(false);
    expect(temaDaMensagem({ tipo: 'filt:tema', escuro: 'sim' })).toBeNull();
    expect(temaDaMensagem({ tipo: 'outra', escuro: true })).toBeNull();
    expect(temaDaMensagem('filt:tema')).toBeNull();
    expect(temaDaMensagem(null)).toBeNull();
  });

  it('aplicarTema marca o documento para o CSS', () => {
    aplicarTema(true);
    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');
    aplicarTema(false);
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });

  it('iniciarTema começa pelo tema do sistema e segue as mensagens do ERP', () => {
    const ouvintes: ((e: MessageEvent) => void)[] = [];
    const janela = {
      matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: dark)' }),
      addEventListener: (_t: string, f: (e: MessageEvent) => void) => ouvintes.push(f),
    } as unknown as Window;

    iniciarTema(janela);
    expect(document.documentElement.getAttribute('data-tema')).toBe('escuro');

    ouvintes.forEach(f => f({ data: { tipo: 'filt:tema', escuro: false } } as MessageEvent));
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');

    ouvintes.forEach(f => f({ data: { tipo: 'qualquer', escuro: true } } as MessageEvent));
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });

  it('sem matchMedia (ambiente restrito) começa no claro', () => {
    iniciarTema({ addEventListener: () => {} } as unknown as Window);
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
  });
});
