import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * Onde este app fala com o ERP.
 *
 * Publicado, o app é servido em /{slug}/{PROJETO}/{versao}/ e o proxy do próprio
 * host das extensões atende em /{slug}/{PROJETO}/api — mesma origem, então não há
 * CORS e a chave de API nunca chega ao browser: quem a injeta é o servidor.
 *
 * Em desenvolvimento (ng serve) quem faz esse papel é o proxy.conf.js, que
 * encaminha /api para o ERP e injeta a sua chave. Ver README.md.
 */
function baseDaApi(): string {
  if (isDevMode()) {
    return '/api';
  }
  const segmentos = window.location.pathname.split('/').filter(Boolean);
  return `/${segmentos[0]}/${segmentos[1]}/api`;
}

const BASE_API = baseDaApi();

/**
 * Cliente da API pública do FILT.
 *
 * O token é efêmero (expira em minutos) e fica só em memória — não grave em
 * localStorage nem em cookie. A chave de API não aparece aqui de propósito:
 * publicar credencial no bundle é motivo de reprovação na revisão automática.
 */
@Injectable({ providedIn: 'root' })
export class ErpApi {
  private http = inject(HttpClient);
  private token: string | null = null;
  private expiraEm = 0;

  /** Renova com 30s de folga para a requisição não morrer com o token vencendo no caminho. */
  private async obterToken(): Promise<string> {
    if (this.token && Date.now() < this.expiraEm) {
      return this.token;
    }
    const r = await firstValueFrom(
      this.http.post<{ access_token: string; expires_in: number }>(
        BASE_API + '/public/v1/auth/token', null)
    );
    this.token = r.access_token;
    this.expiraEm = Date.now() + (r.expires_in - 30) * 1000;
    return this.token;
  }

  /**
   * Executa a chamada com o token e, se ela voltar 401, renova o token e repete UMA vez.
   * O oauth reaproveita o token enquanto ele vale e devolve em `expires_in` o tempo que
   * RESTA — um token emitido com poucos segundos de vida pode vencer entre a emissão e a
   * chamada (ex.: no meio de um salvar que faz várias em sequência). A requisição recusada
   * com 401 não foi processada pela API, então repetir é seguro mesmo em POST/PATCH/DELETE.
   */
  private async comToken<T>(chamar: (token: string) => Promise<T>): Promise<T> {
    try {
      return await chamar(await this.obterToken());
    } catch (e) {
      if (!(e instanceof HttpErrorResponse) || e.status !== 401) {
        throw e;
      }
      this.token = null;
      return chamar(await this.obterToken());
    }
  }

  /** path sem a barra inicial e sem /public/v1 — ex.: 'personalizados/CONTROLE_DE_EPIS' */
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.comToken(token => firstValueFrom(this.http.get<T>(`${BASE_API}/public/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    })));
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.comToken(token => firstValueFrom(this.http.post<T>(`${BASE_API}/public/v1/${path}`, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })));
  }

  /** PATCH é JSON Merge Patch: mande só o que muda — ausente preserva, null limpa. */
  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.comToken(token => firstValueFrom(this.http.patch<T>(`${BASE_API}/public/v1/${path}`, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })));
  }

  async delete(path: string): Promise<void> {
    await this.comToken(token => firstValueFrom(this.http.delete<void>(`${BASE_API}/public/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })));
  }

  /**
   * Mensagem do corpo de erro padrão da API ({codigo, mensagem}). Vale mostrar ao
   * usuário: quando você manda um campo que não existe, ela lista os campos aceitos.
   */
  mensagemDe(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const corpo = err.error;
      if (corpo?.mensagem) {
        return `${corpo.codigo ?? err.status}: ${corpo.mensagem}`;
      }
      return `HTTP ${err.status}: ${err.message}`;
    }
    return String(err);
  }
}
