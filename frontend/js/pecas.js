/* ============================================================
   AUTOSYNC — SEÇÃO "PEÇAS RECOMENDADAS E COMPATÍVEIS"
   ============================================================

   Liga as modificações simuladas ao marketplace:
   - cada modificação simulada (app.js) adiciona a categoria dela;
   - busca em GET /pecas/recomendadas as peças que essa categoria
     exige, com a especificação compatível com o veículo e os
     anúncios dos prestadores que vendem/instalam cada peça;
   - sem backend (ex.: GitHub Pages), usa data/pecas-exemplo.js
     com aviso claro de que são dados de exemplo.

   Sem carrinho nem pagamento: só listagem, compatibilidade e
   contato com o prestador.

   Depende de: js/util.js (AutoSyncUtil), js/api.js (AutoSetupApi),
   data/pecas-exemplo.js (AUTOSETUP_PECAS_EXEMPLO).
   ============================================================ */

const AutoSetupPecas = (function () {

    let veiculo = null;
    const categoriasSimuladas = [];
    let catalogoCompleto = false;   // "Ver catálogo completo" (sem simulação)
    let modoExemplo = false;        // backend indisponível
    let pecas = [];
    let filtroCategoria = "";
    let requisicao = 0;             // descarta respostas antigas

    const TIPO_ANUNCIO = {
        venda: "Vende",
        instalacao: "Instala",
        venda_instalacao: "Vende e instala",
    };

    const $ = function (id) { return document.getElementById(id); };

    function el(tag, classe, texto) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (texto !== undefined && texto !== null) e.textContent = texto;
        return e;
    }

    /** Telefone vira link de WhatsApp; URL e @ de rede social também viram link. */
    function linkContato(contato) {
        if (!contato) return null;
        const texto = String(contato).trim();
        if (/^https?:\/\//i.test(texto)) return texto;
        if (texto.charAt(0) === "@") return "https://instagram.com/" + encodeURIComponent(texto.slice(1));
        const digitos = texto.replace(/\D/g, "");
        if (digitos.length >= 10 && digitos.length <= 11) return "https://wa.me/55" + digitos;
        if (digitos.length >= 12 && digitos.length <= 13) return "https://wa.me/" + digitos;
        return null;
    }

    function nomeVeiculo() {
        return veiculo ? veiculo.marca + " " + veiculo.modelo : "seu veículo";
    }

    function categoriasPedidas() {
        return catalogoCompleto ? [] : categoriasSimuladas.slice();
    }

    /* --------------------------------------------------------
       Carregamento (API ou exemplo)
       -------------------------------------------------------- */

    function usarExemplo() {
        modoExemplo = true;
        pecas = window.AUTOSETUP_PECAS_EXEMPLO
            ? window.AUTOSETUP_PECAS_EXEMPLO.pecasPara(categoriasPedidas())
            : [];
        const aviso = $("pecasAviso");
        aviso.hidden = false;
        aviso.textContent = "Servidor indisponível — exibindo DADOS DE EXEMPLO. " +
            "Os prestadores abaixo são ilustrativos: não são lojas, ofertas nem preços reais.";
    }

    async function carregar() {
        if (!catalogoCompleto && !categoriasSimuladas.length) return;

        // Veículo ainda carregando: definirVeiculo() chama carregar() de novo.
        if (!modoExemplo && !veiculo) {
            $("pecasMeta").textContent = "Aguardando o veículo...";
            return;
        }

        const minha = ++requisicao;
        $("pecasMeta").textContent = "Buscando peças...";

        if (!modoExemplo) {
            try {
                const resposta = await AutoSetupApi.buscarPecasRecomendadas(veiculo.id, categoriasPedidas());
                if (minha !== requisicao) return;
                pecas = resposta.pecas || [];
                $("pecasAviso").hidden = true;
            } catch (erro) {
                if (minha !== requisicao) return;
                console.error("Falha ao buscar peças:", erro.message);
                usarExemplo();
            }
        } else {
            usarExemplo();
        }

        if (filtroCategoria && !pecas.some(function (p) { return p.categoria === filtroCategoria; })) {
            filtroCategoria = "";
        }
        renderizar();
    }

    /* --------------------------------------------------------
       Renderização
       -------------------------------------------------------- */

    function renderizarChips() {
        const area = $("pecasChips");
        area.replaceChildren();
        const categorias = [];
        pecas.forEach(function (p) { if (categorias.indexOf(p.categoria) < 0) categorias.push(p.categoria); });

        [""].concat(categorias).forEach(function (cat) {
            const b = el("button", "pecas-chip" + (filtroCategoria === cat ? " ativo" : ""),
                cat ? AutoSyncUtil.categoriaLabel(cat) : "Todas");
            b.type = "button";
            b.addEventListener("click", function () {
                filtroCategoria = cat;
                renderizar();
            });
            area.appendChild(b);
        });
    }

    function botaoContato(loja) {
        const href = modoExemplo ? null : linkContato(loja.contato);
        if (!href) {
            const b = el("button", "secondary-button pecas-contato", modoExemplo ? "Contato indisponível (exemplo)" : "Contato não informado");
            b.type = "button";
            b.disabled = true;
            return b;
        }
        const a = el("a", "primary-button pecas-contato", "Entrar em contato");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.addEventListener("click", function () {
            if (loja.id) AutoSetupApi.registrarAcessoLoja(loja.id);
        });
        return a;
    }

    function linkPerfil(loja) {
        if (modoExemplo || !loja.id) return null;
        const a = el("a", "pecas-perfil", "Ver perfil");
        a.href = "perfil-loja.html?id=" + encodeURIComponent(loja.id);
        return a;
    }

    function renderizarAnuncio(anuncio) {
        const item = el("li", "pecas-oferta");

        const topo = el("div", "pecas-oferta-topo");
        topo.appendChild(el("strong", "", anuncio.loja ? anuncio.loja.nome : "Prestador"));
        if (anuncio.exemplo) topo.appendChild(el("span", "pecas-selo pecas-selo-exemplo", "Exemplo"));
        item.appendChild(topo);

        const linha = el("div", "pecas-oferta-tags");
        linha.appendChild(el("span", "pecas-selo", TIPO_ANUNCIO[anuncio.tipo] || anuncio.tipo));
        if (anuncio.compativelComVeiculo) {
            linha.appendChild(el("span", "pecas-selo pecas-selo-ok", "Compatível com " + nomeVeiculo()));
        } else if (!(anuncio.veiculosCompativeis || []).length) {
            linha.appendChild(el("span", "pecas-selo pecas-selo-neutro", "Consultar compatibilidade"));
        }
        if (anuncio.loja && anuncio.loja.emiteCSV) linha.appendChild(el("span", "pecas-selo pecas-selo-neutro", "Emite CSV"));
        item.appendChild(linha);

        item.appendChild(el("p", "pecas-oferta-titulo", anuncio.titulo));
        if (anuncio.descricao) item.appendChild(el("p", "pecas-oferta-desc", anuncio.descricao));
        if (anuncio.loja && anuncio.loja.regiao) item.appendChild(el("p", "pecas-oferta-desc", anuncio.loja.regiao));
        if (anuncio.faixaPreco) {
            item.appendChild(el("p", "pecas-preco", "Preço informado pelo prestador: " + anuncio.faixaPreco));
        }

        const acoes = el("div", "pecas-acoes");
        const perfil = linkPerfil(anuncio.loja || {});
        if (perfil) acoes.appendChild(perfil);
        acoes.appendChild(botaoContato(anuncio.loja || {}));
        item.appendChild(acoes);
        return item;
    }

    function renderizarLojaDaCategoria(loja) {
        const item = el("li", "pecas-loja");
        const info = el("div");
        info.appendChild(el("strong", "", loja.nome));
        info.appendChild(el("p", "", loja.regiao + (loja.emiteCSV ? " · Emite CSV" : "")));
        item.appendChild(info);

        const acoes = el("div", "pecas-acoes");
        const perfil = linkPerfil(loja);
        if (perfil) acoes.appendChild(perfil);
        const href = linkContato(loja.contato);
        if (href) {
            const a = el("a", "pecas-perfil", "Contato");
            a.href = href;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.addEventListener("click", function () { AutoSetupApi.registrarAcessoLoja(loja.id); });
            acoes.appendChild(a);
        }
        item.appendChild(acoes);
        return item;
    }

    function renderizarPeca(peca, soCompativeis) {
        const card = el("article", "product pecas-card");

        const topo = el("div", "pecas-card-topo");
        topo.appendChild(el("span", "pecas-selo pecas-selo-cat", AutoSyncUtil.categoriaLabel(peca.categoria)));
        topo.appendChild(el("span", "pecas-selo", peca.tipo === "servico" ? "Serviço" : "Peça"));
        card.appendChild(topo);

        const conteudo = el("div", "product-content");
        conteudo.appendChild(el("h3", "", peca.nome));
        conteudo.appendChild(el("p", "pecas-motivo", "Necessário por: " + peca.atende));
        conteudo.appendChild(el("p", "pecas-espec", peca.especificacao));

        const anuncios = (peca.anuncios || []).filter(function (a) {
            return !soCompativeis || a.compativelComVeiculo;
        });

        if (anuncios.length) {
            conteudo.appendChild(el("span", "pecas-subtitulo", "Quem vende ou instala"));
            const ul = el("ul", "pecas-ofertas");
            anuncios.forEach(function (a) { ul.appendChild(renderizarAnuncio(a)); });
            conteudo.appendChild(ul);
        } else {
            conteudo.appendChild(el("p", "pecas-sem-oferta", soCompativeis
                ? "Nenhum anúncio marcado como compatível com " + nomeVeiculo() + "."
                : "Nenhum prestador anunciou esta peça ainda."));
        }

        const lojas = soCompativeis ? [] : (peca.lojasDaCategoria || []);
        if (lojas.length) {
            const detalhes = el("details", "pecas-lojas");
            detalhes.appendChild(el("summary", "",
                lojas.length + " oficina(s) que atendem " + AutoSyncUtil.categoriaLabel(peca.categoria).toLowerCase()));
            const ul = el("ul");
            lojas.forEach(function (l) { ul.appendChild(renderizarLojaDaCategoria(l)); });
            detalhes.appendChild(ul);
            conteudo.appendChild(detalhes);
        }

        card.appendChild(conteudo);
        return card;
    }

    function renderizar() {
        const lista = $("pecasLista");
        const soCompativeis = $("pecasSoCompativeis").checked && !modoExemplo;
        $("pecasSoCompativeis").disabled = modoExemplo;

        $("pecasFiltros").hidden = false;
        renderizarChips();

        const visiveis = pecas.filter(function (p) { return !filtroCategoria || p.categoria === filtroCategoria; });
        lista.replaceChildren();

        if (!visiveis.length) {
            lista.appendChild(el("p", "pecas-sem-oferta", "Nenhuma peça para este filtro."));
        } else {
            visiveis.forEach(function (p) { lista.appendChild(renderizarPeca(p, soCompativeis)); });
        }

        const totalAnuncios = visiveis.reduce(function (s, p) { return s + (p.anuncios || []).length; }, 0);
        $("pecasMeta").textContent = modoExemplo
            ? visiveis.length + " peça(s) · exemplo"
            : visiveis.length + " peça(s) · " + totalAnuncios + " anúncio(s)";
    }

    /* --------------------------------------------------------
       API pública (usada por app.js)
       -------------------------------------------------------- */

    function definirVeiculo(v) {
        veiculo = v;
        if (catalogoCompleto || categoriasSimuladas.length) carregar();
    }

    function adicionarCategoria(categoria) {
        if (categoriasSimuladas.indexOf(categoria) < 0) categoriasSimuladas.push(categoria);
        catalogoCompleto = false;
        filtroCategoria = "";
        carregar();
    }

    function mostrarExemplo() {
        modoExemplo = true;
        catalogoCompleto = categoriasSimuladas.length === 0;
        carregar();
    }

    function iniciar() {
        const botao = $("pecasVerCatalogo");
        if (botao) {
            botao.addEventListener("click", function () {
                catalogoCompleto = true;
                carregar();
            });
        }
        $("pecasSoCompativeis").addEventListener("change", renderizar);
    }

    if (document.getElementById("pecas")) iniciar();

    return { definirVeiculo, adicionarCategoria, mostrarExemplo };

})();

if (typeof window !== "undefined") {
    window.AutoSetupPecas = AutoSetupPecas;
}
