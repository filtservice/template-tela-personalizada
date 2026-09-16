---
name: tela-personalizada-filt
description: Use quando o usuário quiser criar, alterar ou publicar uma tela personalizada do FILT sobre um cadastro personalizado dele. Conduz do início ao fim - descobre os campos pela API, monta as telas no padrão visual e confere o que a revisão automática reprova antes de publicar.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Tela personalizada do FILT

Conduz a construção de uma tela personalizada: um app web que roda dentro do ERP e
usa os dados da empresa pela API pública.

## O que você precisa pedir ao usuário

Só duas coisas, e a segunda muitas vezes nem é necessária:

1. **A chave de API** (obrigatória). Sem ela não há acesso a nada. Ela se cria no ERP,
   em *Configurações → Chaves de API*, e **o valor aparece uma única vez**, na criação —
   o sistema guarda só o hash. Peça para o usuário colar no `.env`, nunca no código.
2. **O nome do cadastro** que ele criou (ex.: `CONTROLE_DE_EPIS`). Aceite como ele
   escrever: com ou sem o prefixo `U_`, em maiúsculas ou minúsculas — a API normaliza.
   **Se ele não souber o nome, não pergunte duas vezes: liste para ele** (passo 1).

Nunca peça a ele os campos, os tipos ou os nomes das colunas. Isso você descobre.

## Passo 1 — Descubra os campos (faça isso ANTES de escrever qualquer formulário)

```bash
# token (em desenvolvimento o proxy local injeta a chave; veja o README)
TOKEN=$(curl -s -X POST http://localhost:4200/api/public/v1/auth/token | jq -r .access_token)

# quais cadastros existem neste cliente — use se o usuário não souber o nome
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4200/api/public/v1/personalizados | jq

# o contrato de um deles
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:4200/api/public/v1/personalizados/CONTROLE_DE_EPIS/propriedades | jq
```

A resposta traz, por campo: a `chave` que vai no payload e nos filtros, o `tipo`, se é
`obrigatorio`, os limites de validação, `somenteLeitura`, e — em campos `REFERENCIA` —
a entidade apontada e o endpoint de `lookup` para o autocomplete.

**Use a `chave` exatamente como ela vem.** Ela deriva do nome da coluna, não do rótulo:
o campo rotulado "Data entrega" tem chave `dataEntregaU`. Deduzir do rótulo produz
`dataDeEntregaU` e a API recusa com `VALIDACAO`. Nunca invente nome de campo.

Se o cadastro tiver **tabela filha**, ela aparece na listagem com `entidadePai`. No
contrato da filha, o vínculo vem como um campo normal com `vinculoPai: true`:
obrigatório no POST, imutável no PATCH e filtrável no GET.

## Passo 2 — Prepare o projeto

Se ainda não existe projeto, parta do modelo oficial:

```bash
git clone https://github.com/filtservice/template-tela-personalizada.git minha-tela
cd minha-tela
rm -rf .git && git init
npm install
cp .env.example .env     # preencha FILT_API_URL e FILT_API_KEY
npm start
```

**Leia o `AGENTS.md` do projeto antes de codar.** Ele tem o contrato de uso da API
(PATCH merge, paginação, filtros, mestre-detalhe, erros), o padrão visual e as regras
do ambiente. Este arquivo não repete aquele conteúdo — consulte-o.

## Passo 3 — Construa as telas

Copie a página de exemplo (`src/app/pages/`) e adapte para o cadastro do usuário. Uma
rota por tela em `app.routes.ts`, entrada no menu em `app.html`.

Monte o formulário a partir do que o passo 1 devolveu: campo obrigatório vira validação,
os limites viram `maxlength`/`min`/`max`, `somenteLeitura` não vai no payload, e
`REFERENCIA` usa autocomplete contra o `lookup` do próprio contrato.

Siga o padrão visual do template (card, grid com zebra, drawer de filtros, header de
formulário) — é o que faz a tela parecer parte do ERP sem ninguém pedir.

## Passo 4 — Confira o que a revisão automática reprova

Toda versão publicada passa por uma revisão automatizada antes de entrar no ar. Rode
esta conferência **antes** de publicar, porque reprovar custa uma viagem inteira:

- **credencial no código** — chave de API, token ou senha em qualquer arquivo do build;
- **`eval` ou execução dinâmica** de código;
- **chamada para domínio externo** — a tela fala com a API do ERP, e só;
- **tentativa de sair do iframe** (`window.top`, `window.parent`, redirecionar o pai);
- **coleta indevida de dados** do usuário ou da sessão.

A lista completa e o raciocínio estão no `AGENTS.md`. Escreva o código já dentro dessas
regras em vez de corrigir depois.

## Passo 5 — Publique

```bash
npm run build
```

Zipe o **conteúdo** de `dist/app/browser` (o `index.html` na raiz do zip) e suba em
*Personalização → Projetos Personalizados → seu projeto → Publicar*.

Aprovada, a versão é promovida e a tela aparece no menu "Telas Personalizadas".
Reprovada, o parecer explica o motivo e a versão anterior continua no ar. Dá para
voltar a uma versão anterior pela mesma tela.

## Onde está cada coisa

- **Contrato dos endpoints**: Swagger do ERP (`/api/v3/api-docs` devolve o JSON).
- **Como fazer**: `AGENTS.md` do projeto.
- **Campos do cadastro do usuário**: `/propriedades`, sempre ao vivo — nunca de memória.
