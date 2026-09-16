# Instruções para agentes de IA

Este projeto é uma **tela personalizada do FILT**: um app web estático, escrito pelo
cliente, hospedado pela Viasoft e aberto de dentro do ERP. Ele lê e grava dados pela
API pública do FILT.

Leia este arquivo antes de escrever código. As regras abaixo não são estilo — são o
que faz a tela funcionar publicada e passar na revisão automática.

## 1. Descubra os campos antes de escrever qualquer tela

Nunca deduza o nome de um campo a partir do rótulo. A chave vem do **nome da coluna**,
não do rótulo, e as duas coisas divergem com facilidade: um campo rotulado
"Data entrega" tem chave `dataEntregaU` — quem lê o rótulo e escreve o natural
`dataDeEntregaU` recebe `{"codigo":"VALIDACAO","mensagem":"Filtro desconhecido..."}`.
Uma letra de diferença custa a requisição inteira.

**O usuário não precisa te dizer os campos.** Peça só a chave de API e, se ele souber,
o nome do cadastro — pode ser com ou sem o prefixo `U_`, em maiúsculas ou minúsculas,
que a API normaliza. Se ele não souber o nome, liste os cadastros e mostre a ele.

Consulte sempre, antes de montar form, grid ou filtro:

```bash
# quais cadastros existem neste cliente
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/public/v1/personalizados" | jq

# campos de um cadastro: chave, tipo, obrigatoriedade, limites, referência
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/public/v1/personalizados/CONTROLE_DE_EPIS/propriedades" | jq
```

Use o valor de `chave` exatamente como vem. O que o endpoint devolve por campo:

| Campo | Significado |
|---|---|
| `chave` | o que vai no payload e nos filtros |
| `tipo` | TEXTO, NUMERO, DATA, REFERENCIA, LONG |
| `obrigatorio` | exigido na criação |
| `tamanho`, `precisao`, `escala`, `valorMinimo`, `valorMaximo` | validação do form |
| `somenteLeitura` | vem na leitura, é recusado no payload (`id`, `versaoRegistro`) |
| `vinculoPai` | vínculo mestre-detalhe: obrigatório ao criar, imutável no PATCH |
| `referencia` | `{entidade, campoDescricao, lookup}` — o `lookup` é o endpoint do autocomplete |

O contrato completo dos endpoints está no Swagger do ERP (`/swagger-ui`).

## 2. Como falar com a API

Use sempre o serviço `ErpApi` (`src/app/erp-api.service.ts`). Ele já resolve o token,
o caminho base e o formato de erro. Não crie outro cliente HTTP, não chame `fetch`
direto e **nunca** escreva uma URL absoluta de outro domínio.

```ts
const pagina = await this.api.get<Pagina>(`personalizados/${ENTIDADE}`, {
  page: '0', size: '15', epiU: 'capacete',     // qualquer campo vira filtro
});
await this.api.post(`personalizados/${ENTIDADE}`, { epiU: 'Capacete classe B' });
await this.api.patch(`personalizados/${ENTIDADE}/${id}`, { epiU: 'novo nome' });
await this.api.delete(`personalizados/${ENTIDADE}/${id}`);
```

Detalhes que mudam o código:

- **PATCH é JSON Merge Patch**: mande só o que mudou. Chave ausente preserva o valor,
  `null` limpa o campo. Não reenvie o registro inteiro.
- **Campo REFERENCIA** guarda o id. A leitura devolve também `<campo>Descricao` já
  resolvido — mostre a descrição, grave o id, e alimente o autocomplete com o `lookup`.
- **Mestre-detalhe**: o vínculo (ex.: `idUControleDeEpis`) é obrigatório ao criar o
  filho, não pode ser alterado depois, e filtra a listagem dos itens de um pai.
- **Paginação**: `page` e `size`; a resposta traz `conteudo` e `total`.
- **Erros**: o corpo vem como `{codigo, mensagem}` e a mensagem é útil — quando você
  manda um campo que não existe, ela lista os aceitos. Mostre-a ao usuário.

## 3. O que faz a revisão automática REPROVAR

Toda versão publicada passa por uma revisão automática antes de ir ao ar. Estes itens
reprovam — não os escreva:

- **credencial no código**: chave de API, senha ou token literal no fonte. A chave
  vive no servidor e é injetada no proxy; em desenvolvimento, no `.env` local;
- **execução dinâmica de código**: `eval`, `new Function`, `innerHTML` com conteúdo
  vindo de fora;
- **comunicação com domínio externo**: qualquer `fetch`/`XMLHttpRequest` para fora do
  próprio app. Os dados vêm pelo `ErpApi`, ponto;
- **tentar sair do iframe**: mexer em `window.top`, `window.parent`, `document.domain`;
- **coleta indevida**: ler `localStorage`/cookies do ERP, rastrear o usuário.

Dependência externa estática (uma fonte do Google Fonts, por exemplo) não reprova
sozinha, mas é observada — prefira evitar.

## 4. Padrão visual

A tela abre dentro do ERP e deve parecer parte dele. As classes do FILT já estão em
`src/styles.css`: `card-filt`, `card-header`, `grid-filt` (zebra), `btn-primario`,
`btn-icone`, `drawer-filtro`, `form-header`. Reaproveite-as em vez de criar estilo
novo, e siga a estrutura da tela de exemplo: listagem com header (Novo + filtro),
grid com coluna de Ações e paginação; formulário com voltar, título com o id e Salvar.

## 5. Regras do ambiente

- **Rotas com hash** (`#/minha-tela`): o app é publicado em
  `/{slug}/{PROJETO}/{versao}/` e a versão muda a cada publicação. Não troque para
  rotas sem hash nem use caminho absoluto em link ou asset.
- **Só conteúdo estático**: html, js, css, imagens, fontes. Não há servidor seu aqui —
  nada de Node em produção, nada de API própria.
- **Token em memória**: o `ErpApi` já cuida disso. Não grave token em `localStorage`.
- **Não troque o `dev-proxy.js` pelo proxy do `ng serve`**: o dev server do Angular
  aproveita só as opções simples do `proxy.conf` e **descarta funções** como
  `onProxyReq`/`configure` — elas não rodam, e a requisição segue sem a chave e com o
  `Origin`, o que dá 401/403. O proxy próprio existe por isso.

## 6. Como rodar e publicar

```bash
npm install
cp .env.example .env     # preencha FILT_API_URL e FILT_API_KEY
npm start                # sobe o dev-proxy + o Angular em http://localhost:4200
npm run build            # gera dist/ — o conteúdo de dist/app/browser é o que se publica
```

Publicar: ERP → Personalização → Projetos Personalizados → seu projeto → selecione o
zip do build → Publicar. A versão fica aguardando a revisão automática; aprovada, ela
entra no ar e a tela aparece no menu "Telas Personalizadas".

Detalhes em `README.md`.
