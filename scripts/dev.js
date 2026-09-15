/**
 * Sobe o proxy de desenvolvimento e o ng serve juntos (npm start).
 * Sem dependencia externa: so o Node.
 */
const { spawn } = require('child_process');
const path = require('path');

const raiz = path.join(__dirname, '..');
const filhos = [];

function encerrar(codigo) {
  for (const p of filhos) {
    if (!p.killed) p.kill();
  }
  process.exit(codigo);
}

function subir(comando, argumentos, nome) {
  const p = spawn(comando, argumentos, { cwd: raiz, stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (codigo) => {
    console.log(`[dev] ${nome} terminou (${codigo}) - encerrando o restante.`);
    encerrar(codigo === null ? 0 : codigo);
  });
  filhos.push(p);
  return p;
}

process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));

subir(process.execPath, ['dev-proxy.js'], 'proxy');
subir('npx', ['ng', 'serve', '--proxy-config', 'proxy.conf.json'], 'ng serve');
