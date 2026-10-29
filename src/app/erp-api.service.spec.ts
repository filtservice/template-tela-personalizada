import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ErpApi } from './erp-api.service';

const TOKEN = '/api/public/v1/auth/token';
const LISTA = '/api/public/v1/personalizados/X';
const tick = () => new Promise(r => setTimeout(r, 0));

function montar() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(ErpApi), http: TestBed.inject(HttpTestingController) };
}

async function emitir(http: HttpTestingController, token: string, expiresIn: number) {
  await tick();
  http.expectOne(TOKEN).flush({ access_token: token, expires_in: expiresIn });
  await tick();
}

const invalido = { status: 401, statusText: 'Unauthorized' };

describe('ErpApi', () => {
  // O oauth reaproveita o token enquanto ele vale e informa o tempo que RESTA: um token
  // emitido com poucos segundos de vida vence no meio do salvar e volta 401 invalid_token.
  it('token vencido no caminho: renova e repete a chamada uma vez', async () => {
    const { api, http } = montar();
    const p = api.get<{ ok: boolean }>('personalizados/X');
    await emitir(http, 'velho', 5);
    const r1 = http.expectOne(LISTA);
    expect(r1.request.headers.get('Authorization')).toBe('Bearer velho');
    r1.flush({ error: 'invalid_token' }, invalido);
    await emitir(http, 'novo', 299);
    const r2 = http.expectOne(LISTA);
    expect(r2.request.headers.get('Authorization')).toBe('Bearer novo');
    r2.flush({ ok: true });
    expect(await p).toEqual({ ok: true });
    http.verify();
  });

  it('POST recusado por token vencido também é repetido (não chegou a ser processado)', async () => {
    const { api, http } = montar();
    const p = api.post<{ id: number }>('personalizados/X', { a: 1 });
    await emitir(http, 'velho', 5);
    http.expectOne(LISTA).flush({ error: 'invalid_token' }, invalido);
    await emitir(http, 'novo', 299);
    const r2 = http.expectOne(LISTA);
    expect(r2.request.body).toEqual({ a: 1 });
    r2.flush({ id: 9 });
    expect(await p).toEqual({ id: 9 });
    http.verify();
  });

  it('repete só uma vez: o segundo 401 sobe como erro', async () => {
    const { api, http } = montar();
    const p = api.get('personalizados/X');
    const erro = p.catch((e: { status: number }) => e) as Promise<{ status: number }>;
    await emitir(http, 'velho', 5);
    http.expectOne(LISTA).flush({ error: 'invalid_token' }, invalido);
    await emitir(http, 'novo', 299);
    http.expectOne(LISTA).flush({ error: 'invalid_token' }, invalido);
    expect((await erro).status).toBe(401);
    await tick();
    http.verify();
  });

  it('erro de negócio não é repetido', async () => {
    const { api, http } = montar();
    const erro = api.post("personalizados/X", {}).catch((e: { status: number }) => e) as Promise<{ status: number }>;
    await emitir(http, 'tok', 299);
    http.expectOne(LISTA).flush({ codigo: 'VALIDACAO', mensagem: 'Informe ao menos um campo.' }, { status: 400, statusText: 'Bad Request' });
    expect((await erro).status).toBe(400);
    await tick();
    http.verify();
  });
});
