import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErpApi } from '../erp-api.service';

/**
 * TELA DE EXEMPLO — copie esta e adapte para o seu cadastro.
 *
 * CRUD de um cadastro personalizado no formato de uma tela do FILT: listagem
 * (card + header com Novo e filtro + grid com Ações + paginação) e formulário
 * (voltar + título com badge do id + Salvar), sobre /public/v1/personalizados/{entidade}.
 *
 * Mostra os quatro casos que costumam dar trabalho:
 *   1. filtro na listagem (qualquer campo do dicionário vira query string);
 *   2. gravação parcial com PATCH (JSON Merge Patch: mande só o que mudou);
 *   3. campo REFERENCIA com autocomplete, alimentado por /referencias/{entidade};
 *   4. mestre-detalhe — os itens filhos, com o vínculo obrigatório na criação.
 *
 * PARA ADAPTAR, procure os comentários "ADAPTE" abaixo. Antes de mexer nos
 * campos, descubra as chaves reais do SEU cadastro:
 *
 *   GET /public/v1/personalizados                          → seus cadastros
 *   GET /public/v1/personalizados/{entidade}/propriedades   → campos, tipos, limites
 *
 * Não invente o nome da chave a partir do rótulo: "Data de entrega" vira
 * dataDeEntregaU, não dataEntregaU. Use exatamente o que vem em "chave".
 */
/**
 * ADAPTE: um campo por linha do dicionário do seu cadastro.
 * `id` e `versaoRegistro` são do sistema (vêm na leitura, não se enviam).
 * Campo REFERENCIA vem em par: o id (funcionarioU) e a descrição já resolvida
 * pela API (funcionarioUDescricao), que é o que você mostra na tela.
 */
interface RegistroEpi { id: number; versaoRegistro?: number; epiU?: string; funcionarioU?: number; funcionarioUDescricao?: string; }
interface ItemLookup { id: number; descricao: string; }
interface Pagina { conteudo: RegistroEpi[]; total: number; pagina: number; tamanho: number; }
/** Item filho (mestre-detalhe): o vínculo idUControleDeEpis é estrutural — coluna + FK na U_. */
interface RegistroItem {
  id: number;
  versaoRegistro?: number;
  idUControleDeEpis?: number;
  descricaoU?: string;
  quantidadeU?: number;
  dataEntregaU?: string;
}
interface PaginaItens { conteudo: RegistroItem[]; total: number; }

/** ADAPTE: o nome do seu cadastro, como vem em GET /public/v1/personalizados. */
const ENTIDADE = 'CONTROLE_DE_EPIS';
/** ADAPTE (ou remova, com o bloco de itens, se o seu cadastro não tiver filha). */
const ENTIDADE_ITENS = 'EPI_ITENS';
const TAMANHOS_PAGINA = [15, 30, 50, 100];

@Component({
  selector: 'app-epis-page',
  imports: [FormsModule],
  template: `
    @if (erro()) { <div class="erro">{{ erro() }}</div> }

    <!-- ==================== LISTAGEM ==================== -->
    @if (mostrarLista()) {
      <div class="card-filt">
        <div class="card-header">
          <div class="titulo">
            <span class="icone"><svg width="22" height="22" viewBox="0 0 256 256" fill="none" stroke="var(--vs-primary)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M128 24 32 72v112l96 48 96-48V72Z"/><path d="M32 72l96 48 96-48M128 120v112"/></svg></span>
            <h2>Controle de EPIs</h2>
          </div>
          <div class="acoes-header">
            <button class="btn-primario" (click)="novo()">Novo</button>
            <button class="btn-icone" (click)="mostrarFiltro.set(!mostrarFiltro())" title="Filtrar">
              <svg width="14" height="14" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><path d="M42 48h172a8 8 0 0 1 6 13l-66 74a8 8 0 0 0-2 5v56l-48 24v-80a8 8 0 0 0-2-5L36 61a8 8 0 0 1 6-13Z"/></svg>
            </button>
          </div>
        </div>

        <table class="grid-filt">
          <thead>
            <tr>
              <th class="col-id">Código <span class="sort-icone">&#8645;</span></th>
              <th>EPI <span class="sort-icone">&#8645;</span></th>
              <th>Funcionário <span class="sort-icone">&#8645;</span></th>
              <th class="col-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            @if (carregando()) {
              <tr><td colspan="4" class="vazio">Carregando…</td></tr>
            } @else {
              @for (r of registros(); track r.id) {
                <tr (click)="editar(r)">
                  <td class="col-id">{{ r.id }}</td>
                  <td>{{ r.epiU }}</td>
                  <td>{{ r.funcionarioUDescricao || (r.funcionarioU ?? '') }}</td>
                  <td class="col-acoes">
                    <button class="btn-acao" (click)="confirmarExclusao(r); $event.stopPropagation()" title="Excluir">
                      <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M216 56H40M104 104v64M152 104v64M200 56v152a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8V56M168 56V40a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v16"/></svg>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="vazio">Nenhum registro encontrado.</td></tr>
              }
            }
          </tbody>
        </table>

        <div class="paginacao">
          <span>{{ faixaExibida() }} de {{ total() }}</span>
          <span class="paginador">
            <button [disabled]="pagina() === 0" (click)="irPara(0)">«</button>
            <button [disabled]="pagina() === 0" (click)="irPara(pagina() - 1)">‹</button>
            <span class="pagina-atual">{{ pagina() + 1 }}</span>
            <button [disabled]="pagina() + 1 >= totalPaginas()" (click)="irPara(pagina() + 1)">›</button>
            <button [disabled]="pagina() + 1 >= totalPaginas()" (click)="irPara(totalPaginas() - 1)">»</button>
          </span>
          <span class="linhas-pagina">Linhas por página
            <select [ngModel]="tamanhoPagina()" (ngModelChange)="mudarTamanho($event)" name="tamanhoPagina">
              @for (t of tamanhos; track t) { <option [ngValue]="t">{{ t }}</option> }
            </select>
          </span>
        </div>
      </div>

      @if (mostrarFiltro()) {
        <div class="drawer-fundo" (click)="mostrarFiltro.set(false)"></div>
        <aside class="drawer">
          <div class="drawer-header">
            <h3>Filtros</h3>
            <button class="drawer-fechar" (click)="mostrarFiltro.set(false)" title="Fechar">✕</button>
          </div>
          <div class="drawer-corpo">
            <label>
              Código
              <input type="number" [(ngModel)]="filtroCodigo" name="filtroCodigo"
                     (keyup.enter)="aplicarFiltro()" />
            </label>
            <label>
              EPI
              <input type="text" [(ngModel)]="filtro" name="filtro"
                     (keyup.enter)="aplicarFiltro()" />
            </label>
          </div>
          <div class="drawer-rodape">
            <button class="btn-link" (click)="limparFiltro(); mostrarFiltro.set(false)">Limpar</button>
            <button class="btn-primario" (click)="aplicarFiltro(); mostrarFiltro.set(false)">Filtrar</button>
          </div>
        </aside>
      }

      @if (excluindo()) {
        <div class="modal-fundo">
          <div class="modal">
            <h3>Excluir registro</h3>
            <p>Confirma a exclusão do EPI <strong>{{ excluindo()!.epiU }}</strong> (código {{ excluindo()!.id }})?</p>
            <div class="modal-acoes">
              <button class="btn-secundario" (click)="excluindo.set(null)">Cancelar</button>
              <button class="btn-perigo" (click)="excluir()">Excluir</button>
            </div>
          </div>
        </div>
      }
    }

    <!-- ==================== FORMULÁRIO ==================== -->
    @if (!mostrarLista()) {
      <div class="form-header">
        <button class="btn-voltar" (click)="voltar()" title="Voltar">
          <svg width="17" height="17" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><path d="M224 128H40M112 56l-72 72 72 72"/></svg>
        </button>
        <h2>Controle de EPI
          @if (emEdicao()) { <span class="badge-id">{{ emEdicao()!.id }}</span> }
        </h2>
        <div class="form-header-acoes">
          @if (emEdicao()) { <button class="btn-primario" (click)="novo()">Novo</button> }
          <button class="btn-primario" (click)="salvar()" [disabled]="salvando() || !epi().trim()">
            {{ salvando() ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>

      <div class="card-filt card-form">
        <div class="secao-titulo">Controle de EPI</div>
        <form (ngSubmit)="salvar()" class="form-filt">
          <div class="linha">
            <div class="grupo col-4">
              <label for="epi">EPI <span class="obrigatorio">*</span></label>
              <input id="epi" type="text" [(ngModel)]="epi" name="epi" required maxlength="255"
                     placeholder="Ex.: Capacete classe B"
                     title="Descrição do equipamento de proteção individual" />
            </div>
            <div class="grupo col-4 lookup-grupo">
              <label for="funcionario">Funcionário</label>
              <div class="autocomplete">
                <input id="funcionario" type="text" name="funcionario" autocomplete="off"
                       [ngModel]="textoFuncionario()"
                       (ngModelChange)="aoDigitarFuncionario($event)"
                       (blur)="aoSairFuncionario()" />
                <button type="button" class="autocomplete-botao" tabindex="-1"
                        (mousedown)="$event.preventDefault()" (click)="abrirTodosFuncionarios()">
                  <svg width="12" height="12" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M48 96l80 80 80-80"/></svg>
                </button>
              </div>
              @if (opcoesFuncionario().length) {
                <ul class="lookup-opcoes">
                  @for (o of opcoesFuncionario(); track o.id) {
                    <li (mousedown)="selecionarFuncionario(o); $event.preventDefault()">{{ o.descricao }}</li>
                  }
                </ul>
              }
            </div>
            @if (emEdicao()) {
              <div class="grupo col-2 desabilitado">
                <label for="versao">Versão do registro</label>
                <input id="versao" type="text" [ngModel]="emEdicao()!.versaoRegistro" name="versao" disabled />
              </div>
            }
          </div>
          <p class="hint">Cadastro personalizado do tenant (tabela <code>U_CONTROLE_DE_EPIS</code>),
            gravado via <code>{{ emEdicao() ? 'PATCH' : 'POST' }} /public/v1/personalizados/{{ entidade }}</code>.</p>
        </form>
      </div>

      <!-- ============ ITENS (mestre-detalhe: U_EPI_ITENS, FK estrutural) ============ -->
      <div class="card-filt card-itens">
        <div class="secao-titulo secao-itens">
          <span>Itens do EPI</span>
          @if (emEdicao()) {
            <button class="btn-primario" (click)="abrirItem()">Adicionar</button>
          }
        </div>
        @if (!emEdicao()) {
          <p class="hint hint-itens">Salve o registro para incluir itens.</p>
        } @else {
          <table class="grid-filt">
            <thead>
              <tr>
                <th class="col-id">Código</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Data de entrega</th>
                <th class="col-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              @if (carregandoItens()) {
                <tr><td colspan="5" class="vazio">Carregando…</td></tr>
              } @else {
                @for (i of itens(); track i.id) {
                  <tr (click)="abrirItem(i)">
                    <td class="col-id">{{ i.id }}</td>
                    <td>{{ i.descricaoU }}</td>
                    <td>{{ i.quantidadeU ?? '' }}</td>
                    <td>{{ formatarData(i.dataEntregaU) }}</td>
                    <td class="col-acoes">
                      <button class="btn-acao" (click)="confirmarExclusaoItem(i); $event.stopPropagation()" title="Excluir">
                        <svg width="15" height="15" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"><path d="M216 56H40M104 104v64M152 104v64M200 56v152a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8V56M168 56V40a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v16"/></svg>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="vazio">Nenhum item incluído.</td></tr>
                }
              }
            </tbody>
          </table>
        }
      </div>

      <!-- modal de item: cada Salvar persiste na hora (POST/PATCH individual) -->
      @if (itemModal()) {
        <div class="modal-fundo">
          <div class="modal modal-item">
            <h3>{{ itemModal()!.id ? 'Alterar item' : 'Novo item' }}
              @if (itemModal()!.id) { <span class="badge-id">{{ itemModal()!.id }}</span> }
            </h3>
            <form (ngSubmit)="salvarItem()">
              <div class="grupo">
                <label for="itemDescricao">Descrição <span class="obrigatorio">*</span></label>
                <input id="itemDescricao" type="text" [(ngModel)]="itemDescricao" name="itemDescricao"
                       required maxlength="255" placeholder="Ex.: Entrega inicial" />
              </div>
              <div class="linha">
                <div class="grupo col-metade">
                  <label for="itemQuantidade">Quantidade</label>
                  <input id="itemQuantidade" type="number" [(ngModel)]="itemQuantidade" name="itemQuantidade" min="0" />
                </div>
                <div class="grupo col-metade">
                  <label for="itemDataEntrega">Data de entrega</label>
                  <input id="itemDataEntrega" type="date" [(ngModel)]="itemDataEntrega" name="itemDataEntrega" />
                </div>
              </div>
              <div class="modal-acoes">
                <button type="button" class="btn-secundario" (click)="fecharItem()">Cancelar</button>
                <button type="submit" class="btn-primario" [disabled]="salvandoItem() || !itemDescricao().trim()">
                  {{ salvandoItem() ? 'Salvando…' : 'Salvar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (excluindoItem()) {
        <div class="modal-fundo">
          <div class="modal">
            <h3>Excluir item</h3>
            <p>Confirma a exclusão do item <strong>{{ excluindoItem()!.descricaoU }}</strong> (código {{ excluindoItem()!.id }})?</p>
            <div class="modal-acoes">
              <button class="btn-secundario" (click)="excluindoItem.set(null)">Cancelar</button>
              <button class="btn-perigo" (click)="excluirItem()">Excluir</button>
            </div>
          </div>
        </div>
      }
    }

    @if (sucesso()) { <div class="toast-sucesso">{{ sucesso() }}</div> }
  `,
  styles: [`
    /* ---------- card e header da listagem (padrão FILT) ---------- */
    .card-filt {
      background: #fff;
      border: 1px solid var(--vs-border-default);
      border-radius: 8px;
      overflow: hidden;
    }
    /* o card da grid precisa de overflow hidden (cantos do rodape); o do formulario
       nao pode ter, senao corta o painel do autocomplete (analogo ao appendTo=body) */
    .card-form { overflow: visible; }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
    }
    .titulo { display: flex; align-items: center; gap: 10px; }
    .titulo .icone { font-size: 18px; }
    .titulo h2 { margin: 0; font-size: 18px; }
    .acoes-header { display: flex; gap: 8px; }

    .btn-primario {
      padding: 8px 20px;
      border: none;
      border-radius: 6px;
      background: var(--vs-primary-light);
      color: var(--vs-content-primary);
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
    }
    .btn-primario:hover:not(:disabled) { background: var(--vs-primary); }
    .btn-primario:disabled { opacity: 0.5; cursor: default; }
    .btn-secundario {
      padding: 8px 16px;
      border: 1px solid var(--vs-border-default);
      border-radius: 6px;
      background: #fff;
      color: var(--vs-content-primary);
      font-family: inherit;
      cursor: pointer;
    }
    .btn-perigo {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: #d64545;
      color: #fff;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
    }
    .btn-icone {
      width: 38px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--vs-border-default);
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      color: var(--vs-content-secondary);

      svg { width: 14px; height: 14px; flex-shrink: 0; }
    }
    .btn-icone:hover {
      background: var(--vs-primary-light);
      border-color: var(--vs-primary-light);
      color: var(--vs-content-primary);
    }

    /* ---------- drawer de filtros (padrão FILT: painel lateral direito) ---------- */
    .drawer-fundo {
      position: fixed; inset: 0;
      background: rgba(31, 39, 46, 0.35);
      z-index: 40;
    }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 420px; max-width: 90vw;
      background: #fff;
      z-index: 45;
      box-shadow: -6px 0 24px rgba(0, 0, 0, 0.18);
      display: flex; flex-direction: column;
      animation: drawer-entra 160ms ease-out;
    }
    @keyframes drawer-entra { from { transform: translateX(30px); opacity: 0.6; } to { transform: none; opacity: 1; } }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px 8px;
    }
    .drawer-header h3 { margin: 0; font-size: 19px; }
    .drawer-fechar {
      background: none; border: none; cursor: pointer;
      font-size: 15px; color: var(--vs-content-secondary); padding: 4px;
    }
    .drawer-corpo { padding: 4px 20px; flex: 1; overflow-y: auto; }
    .drawer-corpo label { max-width: none; font-weight: 400; font-size: 13px; color: var(--vs-content-secondary); }
    .drawer-rodape {
      display: flex; justify-content: flex-end; align-items: center; gap: 14px;
      padding: 14px 20px;
    }
    .btn-link {
      background: none; border: none; cursor: pointer;
      color: var(--vs-green-dark); font-weight: 700; font-size: 14px; font-family: inherit;
    }

    /* ---------- grid (padrão app-grid) ---------- */
    .grid-filt {
      width: 100%;
      min-width: 0;
      border-collapse: collapse;
      margin: 0;
    }
    .grid-filt th {
      background: var(--vs-bg-neutral-2);
      border: none;
      border-top: 1px solid var(--vs-border-default);
      border-bottom: 1px solid var(--vs-border-default);
      font-size: 13px;
      padding: 10px 18px;
      text-align: left;
    }
    .grid-filt td {
      border: none;
      border-bottom: 1px solid var(--vs-bg-neutral-2);
      padding: 12px 18px;
      font-size: 13.5px;
    }
    .grid-filt tbody tr:nth-child(even) { background: var(--vs-bg-neutral-1); }
    .grid-filt tbody tr:hover { background: var(--vs-bg-neutral-2); cursor: pointer; }
    .grid-filt tbody td { border-bottom: none; }
    .sort-icone { color: var(--vs-content-secondary); font-size: 11px; margin-left: 2px; }
    .col-id { width: 110px; }
    .col-acoes { width: 80px; text-align: right; }
    .btn-acao {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 6px;
      color: var(--vs-content-secondary);
    }
    .btn-acao:hover { color: var(--vs-content-primary); }
    .vazio { text-align: center; color: var(--vs-content-secondary); padding: 24px !important; }

    .paginacao {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 18px;
      background: var(--vs-bg-neutral-1);
      font-size: 13px;
      color: var(--vs-content-secondary);
    }
    .paginador { display: inline-flex; align-items: center; gap: 2px; }
    .paginador button {
      background: var(--vs-bg-neutral-2);
      border: 1px solid var(--vs-border-default);
      color: var(--vs-content-primary);
      font-weight: 600;
      padding: 2px 10px;
      cursor: pointer;
    }
    .paginador button:first-child { border-radius: 50px 0 0 50px; }
    .paginador button:last-child { border-radius: 0 50px 50px 0; }
    .paginador button:disabled { opacity: 0.45; cursor: default; }
    .linhas-pagina select {
      display: inline-block;
      width: auto;
      margin: 0 0 0 6px;
      padding: 2px 6px;
      font-size: 13px;
      border: 1px solid var(--vs-border-default);
      border-radius: 4px;
      background: #fff;
    }
    .pagina-atual {
      padding: 2px 12px;
      background: var(--vs-primary-light);
      font-weight: 700;
      border-radius: 4px;
    }

    /* ---------- formulário (padrão header-form) ---------- */
    .form-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .form-header h2 { margin: 0; font-size: 20px; display: flex; align-items: center; gap: 10px; }
    .form-header-acoes { margin-left: auto; display: flex; gap: 8px; }
    .btn-voltar {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--vs-border-default);
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      color: var(--vs-content-primary);

      svg { width: 17px; height: 17px; flex-shrink: 0; }
    }
    .badge-id {
      background: var(--vs-bg-neutral-2);
      color: var(--vs-content-secondary);
      font-size: 13px;
      font-weight: 600;
      padding: 2px 12px;
      border-radius: 999px;
    }
    .secao-titulo {
      padding: 14px 18px;
      border-bottom: 1px solid var(--vs-border-default);
      font-weight: 700;
      font-size: 15px;
    }
    .form-filt { padding: 6px 18px 16px; }
    .linha { display: flex; gap: 16px; flex-wrap: wrap; }
    .grupo { margin: 12px 0 0; }
    .grupo label { font-size: 12.5px; font-weight: 600; color: var(--vs-content-secondary); margin: 0 0 4px; display: block; }
    .grupo input { margin: 0; }
    .col-4 { flex: 0 1 420px; }
    .col-2 { flex: 0 1 180px; }
    .obrigatorio { color: #d64545; }
    .lookup-grupo { position: relative; }
    .lookup-opcoes {
      position: absolute;
      z-index: 20;
      list-style: none;
      margin: 2px 0 0;
      padding: 4px 0;
      width: 100%;
      max-height: 220px;
      overflow-y: auto;
      background: #fff;
      border: 1px solid var(--vs-border-default);
      border-radius: 6px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    }
    .lookup-opcoes li { padding: 8px 12px; cursor: pointer; font-size: 14px; }
    .lookup-opcoes li:hover { background: var(--vs-bg-neutral-1); }
    .autocomplete {
      display: flex;
      align-items: stretch;
    }
    .autocomplete input {
      flex: 1;
      border-radius: 6px 0 0 6px;
      border-right: none;
    }
    .autocomplete-botao {
      width: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--vs-border-default);
      border-radius: 0 6px 6px 0;
      background: var(--vs-bg-neutral-1);
      color: var(--vs-content-secondary);
      cursor: pointer;

      svg { width: 12px; height: 12px; flex-shrink: 0; }
    }
    .autocomplete-botao:hover { background: var(--vs-primary-light); color: var(--vs-content-primary); border-color: var(--vs-primary-light); }
    .desabilitado input { background: var(--vs-bg-neutral-1); color: var(--vs-content-secondary); }

    /* ---------- seção de itens (grade filha, padrão FILT) ---------- */
    .card-itens { margin-top: 16px; }
    .secao-itens {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .hint-itens { padding: 16px 18px; margin: 0; color: var(--vs-content-secondary); }
    .modal-item { width: 460px; max-width: 92vw; }
    .modal-item .grupo { margin-top: 12px; }
    .modal-item .grupo input { width: 100%; }
    .modal-item .linha { display: flex; gap: 16px; }
    .col-metade { flex: 1; }

    /* ---------- modal e toast ---------- */
    .modal-fundo {
      position: fixed; inset: 0;
      background: rgba(31, 39, 46, 0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 50;
    }
    .modal {
      background: #fff;
      border-radius: 8px;
      padding: 20px 24px;
      max-width: 420px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    }
    .modal h3 { margin: 0 0 8px; }
    .modal-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    .toast-sucesso {
      position: fixed; top: 18px; right: 18px;
      background: var(--vs-green-dark);
      color: #fff;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.25);
      z-index: 60;
    }
  `],
})
export class EpisPage implements OnInit {
  private api = inject(ErpApi);

  entidade = ENTIDADE;
  tamanhos = TAMANHOS_PAGINA;
  tamanhoPagina = signal(15);

  mostrarLista = signal(true);
  mostrarFiltro = signal(false);
  registros = signal<RegistroEpi[]>([]);
  total = signal(0);
  pagina = signal(0);
  carregando = signal(true);
  salvando = signal(false);
  erro = signal('');
  sucesso = signal('');
  epi = signal('');
  filtro = signal('');
  filtroCodigo = signal<number | null>(null);
  emEdicao = signal<RegistroEpi | null>(null);
  excluindo = signal<RegistroEpi | null>(null);
  textoFuncionario = signal('');
  opcoesFuncionario = signal<ItemLookup[]>([]);
  funcionarioSelecionado = signal<ItemLookup | null>(null);
  private timerLookup: ReturnType<typeof setTimeout> | null = null;

  /* itens (mestre-detalhe): cada operação persiste na hora, individualmente */
  itens = signal<RegistroItem[]>([]);
  carregandoItens = signal(false);
  itemModal = signal<RegistroItem | null>(null);
  itemDescricao = signal('');
  itemQuantidade = signal<number | null>(null);
  itemDataEntrega = signal('');
  salvandoItem = signal(false);
  excluindoItem = signal<RegistroItem | null>(null);

  ngOnInit() {
    this.carregar();
  }

  totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total() / this.tamanhoPagina()));
  }

  faixaExibida(): string {
    if (!this.total()) {
      return '0 - 0';
    }
    const inicio = this.pagina() * this.tamanhoPagina() + 1;
    return `${inicio} - ${inicio + this.registros().length - 1}`;
  }

  async carregar() {
    this.carregando.set(true);
    this.erro.set('');
    try {
      const params: Record<string, string> = {
        page: String(this.pagina()),
        size: String(this.tamanhoPagina()),
      };
      if (this.filtro().trim()) {
        params['epiU'] = this.filtro().trim();
      }
      if (this.filtroCodigo() != null) {
        params['id'] = String(this.filtroCodigo());
      }
      const r = await this.api.get<Pagina>(`personalizados/${ENTIDADE}`, params);
      this.registros.set(r.conteudo || []);
      this.total.set(r.total || 0);
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    } finally {
      this.carregando.set(false);
    }
  }

  aplicarFiltro() {
    this.pagina.set(0);
    this.carregar();
  }

  limparFiltro() {
    this.filtro.set('');
    this.filtroCodigo.set(null);
    this.aplicarFiltro();
  }

  mudarTamanho(tamanho: number) {
    this.tamanhoPagina.set(tamanho);
    this.pagina.set(0);
    this.carregar();
  }

  irPara(pagina: number) {
    this.pagina.set(pagina);
    this.carregar();
  }

  novo() {
    this.emEdicao.set(null);
    this.epi.set('');
    this.limparFuncionario();
    this.itens.set([]);
    this.mostrarLista.set(false);
  }

  editar(r: RegistroEpi) {
    this.emEdicao.set(r);
    this.epi.set(r.epiU || '');
    this.funcionarioSelecionado.set(r.funcionarioU
      ? { id: r.funcionarioU, descricao: r.funcionarioUDescricao || String(r.funcionarioU) }
      : null);
    this.opcoesFuncionario.set([]);
    this.textoFuncionario.set(this.funcionarioSelecionado()?.descricao || '');
    this.mostrarLista.set(false);
    this.carregarItens();
  }

  /**
   * Comportamento do p-autoComplete do FILT: a descrição vive no próprio input;
   * digitar dispara a busca no lookup genérico; a setinha lista as primeiras
   * opções sem digitar (dropdown); e vale o forceSelection — texto que não veio
   * de uma seleção é descartado no blur.
   */
  aoDigitarFuncionario(texto: string) {
    this.textoFuncionario.set(texto);
    if (this.timerLookup) {
      clearTimeout(this.timerLookup);
    }
    this.timerLookup = setTimeout(() => this.buscarFuncionarios(texto.trim()), 300);
  }

  abrirTodosFuncionarios() {
    this.buscarFuncionarios('');
  }

  private async buscarFuncionarios(busca: string) {
    try {
      const params: Record<string, string> = { size: '10' };
      if (busca) {
        params['busca'] = busca;
      }
      this.opcoesFuncionario.set(await this.api.get<ItemLookup[]>('referencias/PESSOA', params));
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    }
  }

  selecionarFuncionario(o: ItemLookup) {
    this.funcionarioSelecionado.set(o);
    this.textoFuncionario.set(o.descricao);
    this.opcoesFuncionario.set([]);
  }

  /** forceSelection: no blur, o input volta para a última seleção válida (ou limpa o vínculo). */
  aoSairFuncionario() {
    setTimeout(() => {
      this.opcoesFuncionario.set([]);
      const selecionado = this.funcionarioSelecionado();
      if (!this.textoFuncionario().trim()) {
        this.funcionarioSelecionado.set(null);
        this.textoFuncionario.set('');
        return;
      }
      if (selecionado && this.textoFuncionario() !== selecionado.descricao) {
        this.textoFuncionario.set(selecionado.descricao);
      } else if (!selecionado) {
        this.textoFuncionario.set('');
      }
    }, 150);
  }

  limparFuncionario() {
    this.funcionarioSelecionado.set(null);
    this.opcoesFuncionario.set([]);
    this.textoFuncionario.set('');
  }

  voltar() {
    this.mostrarLista.set(true);
    this.emEdicao.set(null);
    this.epi.set('');
    this.itens.set([]);
  }

  async salvar() {
    if (!this.epi().trim()) {
      return;
    }
    this.erro.set('');
    this.salvando.set(true);
    try {
      const corpo = { epiU: this.epi().trim(), funcionarioU: this.funcionarioSelecionado()?.id ?? null };
      let salvo: RegistroEpi;
      if (this.emEdicao()) {
        salvo = await this.api.patch<RegistroEpi>(`personalizados/${ENTIDADE}/${this.emEdicao()!.id}`, corpo);
        this.notificar('Registro alterado com sucesso.');
      } else {
        salvo = await this.api.post<RegistroEpi>(`personalizados/${ENTIDADE}`, corpo);
        this.notificar('Registro incluído com sucesso.');
      }
      // padrão FILT: o formulário permanece aberto após salvar, agora em modo edição
      // (badge do id + botão Novo); a grade é recarregada por trás para o voltar já vir atualizado
      this.emEdicao.set(salvo);
      this.epi.set(salvo.epiU || '');
      await this.carregar();
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    } finally {
      this.salvando.set(false);
    }
  }

  confirmarExclusao(r: RegistroEpi) {
    this.excluindo.set(r);
  }

  async excluir() {
    const r = this.excluindo();
    if (!r) {
      return;
    }
    this.erro.set('');
    try {
      await this.api.delete(`personalizados/${ENTIDADE}/${r.id}`);
      this.notificar('Registro excluído.');
      await this.carregar();
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    } finally {
      this.excluindo.set(null);
    }
  }

  private notificar(mensagem: string) {
    this.sucesso.set(mensagem);
    setTimeout(() => this.sucesso.set(''), 3500);
  }

  /* ------------------------------------------------------------------
   * itens (mestre-detalhe): U_EPI_ITENS filtrada pelo vínculo estrutural
   * idUControleDeEpis; POST/PATCH/DELETE individuais, cada um já persiste
   * ------------------------------------------------------------------ */

  formatarData(iso?: string): string {
    if (!iso) {
      return '';
    }
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  async carregarItens() {
    const pai = this.emEdicao();
    if (!pai) {
      this.itens.set([]);
      return;
    }
    this.carregandoItens.set(true);
    try {
      const r = await this.api.get<PaginaItens>(`personalizados/${ENTIDADE_ITENS}`,
        { size: '100', idUControleDeEpis: String(pai.id) });
      this.itens.set(r.conteudo || []);
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    } finally {
      this.carregandoItens.set(false);
    }
  }

  abrirItem(item?: RegistroItem) {
    this.itemModal.set(item ?? {} as RegistroItem);
    this.itemDescricao.set(item?.descricaoU || '');
    this.itemQuantidade.set(item?.quantidadeU ?? null);
    this.itemDataEntrega.set(item?.dataEntregaU || '');
  }

  fecharItem() {
    this.itemModal.set(null);
  }

  async salvarItem() {
    const pai = this.emEdicao();
    const item = this.itemModal();
    if (!pai || !item || !this.itemDescricao().trim()) {
      return;
    }
    this.erro.set('');
    this.salvandoItem.set(true);
    try {
      const corpo: Record<string, unknown> = {
        descricaoU: this.itemDescricao().trim(),
        quantidadeU: this.itemQuantidade(),
        dataEntregaU: this.itemDataEntrega() || null,
      };
      if (item.id) {
        await this.api.patch(`personalizados/${ENTIDADE_ITENS}/${item.id}`, corpo);
        this.notificar('Item alterado com sucesso.');
      } else {
        // o vínculo com o pai é estrutural e obrigatório — só vai no POST
        corpo['idUControleDeEpis'] = pai.id;
        await this.api.post(`personalizados/${ENTIDADE_ITENS}`, corpo);
        this.notificar('Item incluído com sucesso.');
      }
      this.fecharItem();
      await this.carregarItens();
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    } finally {
      this.salvandoItem.set(false);
    }
  }

  confirmarExclusaoItem(item: RegistroItem) {
    this.excluindoItem.set(item);
  }

  async excluirItem() {
    const item = this.excluindoItem();
    if (!item) {
      return;
    }
    this.erro.set('');
    try {
      await this.api.delete(`personalizados/${ENTIDADE_ITENS}/${item.id}`);
      this.notificar('Item excluído.');
      await this.carregarItens();
    } catch (e) {
      this.erro.set(this.api.mensagemDe(e));
    } finally {
      this.excluindoItem.set(null);
    }
  }
}
