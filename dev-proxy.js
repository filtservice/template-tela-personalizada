/**
 * Proxy de desenvolvimento — faz na sua maquina o que o servidor de extensoes faz
 * quando a tela esta publicada:
 *
 *   1. injeta a X-API-Key na emissao do token (a chave nunca vai ao navegador);
 *   2. remove o header Origin, que o browser manda mesmo em requisicao de mesma
 *      origem e que faz o gateway recusar com 403 vazio (localhost nao esta na
 *      lista de origens conhecidas);
 *   3. encaminha o resto para o ERP.
 *
 * Por que um servidor proprio em vez do proxy do ng serve: o dev server do Angular
 * aproveita apenas as opcoes simples do proxy.conf (target, pathRewrite) e DESCARTA
 * funcoes como onProxyReq/configure — elas nao rodam, e a requisicao segue sem a
 * chave e com o Origin. Aqui o controle e total e explicito.
 *
 * Sobe junto com o ng serve pelo `npm start`. Nao vai para producao.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const env = {};
const arquivoEnv = path.join(__dirname, '.env');
if (fs.existsSync(arquivoEnv)) {
  for (const linha of fs.readFileSync(arquivoEnv, 'utf8').split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const i = limpa.indexOf('=');
    if (i > 0) env[limpa.slice(0, i).trim()] = limpa.slice(i + 1).trim();
  }
}

const destino = process.env.FILT_API_URL || env.FILT_API_URL;
const chave = process.env.FILT_API_KEY || env.FILT_API_KEY;
const porta = Number(process.env.FILT_PROXY_PORT || 4400);

if (!destino || !chave) {
  console.error('\n[proxy] Configure o .env (copie de .env.example): '
    + 'FILT_API_URL e FILT_API_KEY sao obrigatorios.\n');
  process.exit(1);
}

const alvo = new URL(destino);
const transporte = alvo.protocol === 'https:' ? https : http;

/*
 * No FILT_API_URL vai o endereco do ERP, o mesmo que voce usa no navegador. A API
 * publica responde sob /api dentro dele (na raiz quem atende e o front do ERP, que
 * devolveria HTML no lugar de JSON), entao o prefixo e acrescentado aqui. Se voce
 * ja informar a URL com /api no fim, nao duplicamos.
 */
const base = alvo.pathname.replace(/\/$/, '');
const prefixo = /\/api$/.test(base) ? base : base + '/api';

http.createServer((req, res) => {
  const caminho = prefixo + req.url;

  const cabecalhos = { ...req.headers };
  delete cabecalhos.origin;    // o 403 vazio do gateway vem daqui
  delete cabecalhos.referer;
  delete cabecalhos.host;      // o destino precisa do proprio host
  cabecalhos.host = alvo.host;
  if (req.url.includes('/auth/token')) {
    cabecalhos['x-api-key'] = chave;
  }

  const requisicao = transporte.request({
    protocol: alvo.protocol,
    hostname: alvo.hostname,
    port: alvo.port || (alvo.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: caminho,
    headers: cabecalhos,
  }, (resposta) => {
    res.writeHead(resposta.statusCode || 502, resposta.headers);
    resposta.pipe(res);
  });

  requisicao.on('error', (erro) => {
    console.error('[proxy] falha ao chamar o ERP:', erro.message);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ codigo: 'PROXY', mensagem: erro.message }));
  });

  req.pipe(requisicao);
}).listen(porta, () => {
  console.log(`[proxy] http://localhost:${porta} -> ${alvo.origin}${alvo.pathname}`);
});
