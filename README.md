# Minha Tela Personalizada

Projeto-modelo de uma tela personalizada do FILT — um app web que roda dentro do ERP
e usa os dados da sua empresa pela API pública.

Comece renomeando: troque o `name` do `package.json` e o título em `src/index.html`,
`src/app/app.html` e `src/app/app.routes.ts` pelo nome da sua tela.

Não há nada de endereço para configurar: publicado, o app descobre sozinho onde falar
com a API (pelo caminho em que está servido); em desenvolvimento, quem resolve isso é
o proxy local, que você configura no `.env` logo abaixo.

## Começando

```bash
git clone https://github.com/filtservice/template-tela-personalizada.git minha-tela
cd minha-tela
rm -rf .git && git init          # o projeto passa a ser seu, com histórico próprio

npm install
cp .env.example .env             # preencha as duas variáveis
npm start
```

Abre em `http://localhost:4200` com a tela de exemplo funcionando contra o ERP.

O `npm start` sobe duas coisas: o **dev-proxy** e o servidor do Angular. O dev-proxy
faz na sua máquina o que o servidor de extensões faz quando a tela está publicada —
injeta a chave de API na emissão do token e remove o header `Origin`, que faria o
gateway recusar com 403. Vale abrir o `dev-proxy.js`: ele é curto e mostra exatamente
como a autenticação funciona.

### O `.env`

```
FILT_API_URL=https://app.filterp.com.br
FILT_API_KEY=sua-chave
```

A chave de API se cria no ERP, em **Configurações → Chaves de API**. Três pontos que
economizam tempo:

- **o valor aparece uma única vez**, na criação. O sistema guarda só o hash e não
  consegue mostrá-lo de novo — se perder, emita outra;
- crie uma chave **separada para desenvolvimento**, com os escopos `personalizado.*`;
- **o desenvolvimento é sempre contra o seu ERP de produção** — não há ambiente de
  homologação para clientes. Na prática, isso significa que tudo o que a tela gravar
  enquanto você desenvolve é dado real da sua empresa.

Como trabalhar com segurança apesar disso:

- **crie um cadastro personalizado só para testes** (em *Personalização → Tabelas
  Personalizadas*) e desenvolva contra ele. É a proteção mais efetiva: seus
  experimentos ficam numa tabela que não alimenta processo nenhum;
- **dê à chave de desenvolvimento só os escopos de que a tela precisa.** Se ela não
  precisa excluir, não conceda `personalizado.excluir` — assim um bug não apaga nada;
- só aponte para os cadastros de verdade quando a tela já estiver funcionando.

O `.env` está no `.gitignore` e nunca vai para o build. Em produção, quem injeta a
chave é o servidor que hospeda a tela — ela não passa pelo navegador.

## Como o projeto está organizado

```
src/app/erp-api.service.ts     cliente da API: token, caminho base, erros
src/app/pages/epis.page.ts     tela de exemplo — copie e adapte
src/app/app.routes.ts          uma rota por tela
src/app/app.html               menu lateral
src/styles.css                 estilos no padrão visual do FILT
dev-proxy.js                   proxy de desenvolvimento (só local)
proxy.conf.json                aponta o ng serve para o dev-proxy
scripts/dev.js                 sobe o proxy e o ng serve juntos (npm start)
AGENTS.md                      instruções para o seu assistente de IA
```

## Descobrindo os campos do seu cadastro

Os cadastros personalizados são criados no ERP (**Personalização → Tabelas
Personalizadas**) e ganham API automaticamente. Para saber o que a sua API aceita:

```bash
# 1) token (em desenvolvimento, o proxy injeta sua chave)
TOKEN=$(curl -s -X POST http://localhost:4200/api/public/v1/auth/token | jq -r .access_token)

# 2) seus cadastros
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4200/api/public/v1/personalizados | jq

# 3) os campos de um deles
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4200/api/public/v1/personalizados/CONTROLE_DE_EPIS/propriedades | jq
```

A resposta traz, para cada campo, a `chave` que vai no payload, o tipo, se é
obrigatório, os limites de validação e — em campos de referência — o endpoint de
lookup para o autocomplete.

> **Use a `chave` como ela vem.** Ela vem do nome da coluna, não do rótulo — e os dois
> divergem: um campo rotulado "Data entrega" tem chave `dataEntregaU`; escrever o
> natural `dataDeEntregaU` dá erro de validação.

Você só precisa saber o **nome do cadastro** — e pode informá-lo com ou sem o prefixo
`U_`, em maiúsculas ou minúsculas. Se não lembrar, a chamada do item 2 lista todos.

O contrato completo dos endpoints está no Swagger do ERP, em `/swagger-ui`.

## O básico da API

```ts
// listar, com filtro em qualquer campo e paginação
await api.get(`personalizados/CONTROLE_DE_EPIS`, { page: '0', size: '15', epiU: 'capacete' });

// criar
await api.post(`personalizados/CONTROLE_DE_EPIS`, { epiU: 'Capacete classe B' });

// alterar: mande só o que mudou (ausente preserva, null limpa)
await api.patch(`personalizados/CONTROLE_DE_EPIS/${id}`, { epiU: 'Capacete classe A' });

// excluir
await api.delete(`personalizados/CONTROLE_DE_EPIS/${id}`);
```

A tela de exemplo mostra os quatro casos que costumam dar trabalho: filtro, gravação
parcial, campo de referência com autocomplete e mestre-detalhe (os itens filhos).

## Publicando

```bash
npm run build
```

Zipe o **conteúdo** de `dist/app/browser` (o `index.html` tem que ficar na raiz do
zip) e suba em **Personalização → Projetos Personalizados → seu projeto → Publicar**.

A versão publicada passa por uma **revisão automática** antes de entrar no ar. Se for
aprovada, ela é promovida e a tela aparece no menu "Telas Personalizadas"; se for
reprovada, o parecer explica o motivo e a versão anterior continua no ar. Você também
pode voltar para uma versão anterior pela mesma tela.

O que reprova, em resumo: credencial no código, `eval`/execução dinâmica, chamada para
domínio externo, tentativa de sair do iframe e coleta indevida de dados do usuário. A
lista completa e o raciocínio estão no `AGENTS.md`.

## Coisas que valem saber

- **A tela só abre por dentro do ERP.** Acessar a URL publicada direto no navegador
  devolve 401 — o acesso depende da sua sessão no ERP.
- **As rotas usam hash** (`#/epis`) porque o app é publicado num caminho versionado
  que muda a cada publicação. Não mude isso.
- **Só conteúdo estático.** Não há servidor seu no ar: html, js, css, imagens e fontes.
- **Quem enxerga a tela** se configura no cadastro do projeto, no campo "Grupos com
  acesso": vazio, todos veem; com grupos, só quem pertence a eles.

## Licença

Este projeto-modelo é distribuído sob a licença [MIT](LICENSE) — você pode usar,
modificar e distribuir à vontade, inclusive em projeto de código fechado.

Dois esclarecimentos que costumam gerar dúvida:

- **A licença cobre este modelo, não o que você escrever a partir dele.** A tela que
  você desenvolver é sua; a Viasoft não reivindica nada sobre ela.
- **As bibliotecas têm licenças próprias.** O Angular e os demais pacotes do
  `package.json` seguem as licenças de seus respectivos autores.

O modelo é fornecido "como está", sem garantia — veja o texto completo em `LICENSE`.
