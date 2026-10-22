/**
 * Tema claro/escuro da tela, igual ao do ERP.
 *
 * A tela roda isolada num iframe e não pode ler o ERP (a revisão automática reprova acesso a
 * window.parent/window.top). Quem sabe o tema é o ERP, que avisa por postMessage — ao abrir a
 * tela e a cada troca no botão de tema — com {tipo: 'filt:tema', escuro: boolean}. Até a
 * mensagem chegar (e em desenvolvimento, fora do ERP), vale o tema do sistema operacional.
 *
 * A mensagem não é conferida pela origem de propósito: carrega só um booleano de aparência,
 * então quem quer que a envie no máximo troca as cores da tela — nada é lido nem gravado.
 * O CSS (src/styles.css) aplica os tokens do escuro em :root[data-tema="escuro"].
 */
export const MENSAGEM_TEMA = 'filt:tema';

/** O valor de `escuro` se a mensagem segue o contrato; null em qualquer outro caso. */
export function temaDaMensagem(dados: unknown): boolean | null {
  if (typeof dados !== 'object' || dados === null) {
    return null;
  }
  const m = dados as { tipo?: unknown; escuro?: unknown };
  return m.tipo === MENSAGEM_TEMA && typeof m.escuro === 'boolean' ? m.escuro : null;
}

export function aplicarTema(escuro: boolean, doc: Document = document): void {
  doc.documentElement.setAttribute('data-tema', escuro ? 'escuro' : 'claro');
}

/** Chamado uma vez, antes do bootstrap (src/main.ts). */
export function iniciarTema(janela: Window = window): void {
  const sistemaEscuro = typeof janela.matchMedia === 'function'
    && janela.matchMedia('(prefers-color-scheme: dark)').matches;
  aplicarTema(sistemaEscuro);
  janela.addEventListener('message', (evento: MessageEvent) => {
    const escuro = temaDaMensagem(evento.data);
    if (escuro !== null) {
      aplicarTema(escuro);
    }
  });
}
