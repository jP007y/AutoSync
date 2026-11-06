/* ============================================================
   AUTOSYNC — PERFIL PÚBLICO DO PRESTADOR
   ============================================================
   Página pública (sem login). Lê ?id= da URL e mostra: dados do
   empreendimento, formação e especialidades, serviços por categoria
   e as publicações de serviços já realizados em carros de clientes.
   ============================================================ */
(function () {
    "use strict";
    const U = AutoSyncUtil, esc = U.esc;
    const container = document.getElementById("conteudoPerfil");

    // O botão do cabeçalho leva ao painel certo conforme quem está logado
    const usuario = window.AutoSetupAuth ? AutoSetupAuth.obterUsuarioLogado() : null;
    const voltar = document.getElementById("linkVoltarPainel");
    if (usuario && usuario.tipo === "prestador") voltar.href = "painel-prestador.html";
    if (!usuario) { voltar.textContent = "Entrar"; voltar.href = "login.html"; }

    function soDigitos(t) { return String(t || "").replace(/\D/g, ""); }

    function linhaContato(loja) {
        const partes = [];
        if (loja.contato) {
            const d = soDigitos(loja.contato);
            partes.push(`<a href="tel:${esc(d)}">📞 ${esc(loja.contato)}</a>`);
            if (d.length >= 10) {
                const num = d.length <= 11 ? "55" + d : d;
                partes.push(`<a href="https://wa.me/${num}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
            }
        }
        if (loja.endereco) {
            partes.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loja.endereco)}" target="_blank" rel="noopener">📍 ${esc(loja.endereco)}</a>`);
        }
        if (loja.horario) partes.push(`<span>🕘 ${esc(loja.horario)}</span>`);
        return partes.length ? `<div class="perfil-contato-linha">${partes.join("")}</div>` : "";
    }

    function blocoProfissional(loja) {
        const itens = [];
        if (loja.responsavel) itens.push(`<div><dt>Responsável técnico</dt><dd>${esc(loja.responsavel)}</dd></div>`);
        if (loja.formacao) itens.push(`<div><dt>Formação</dt><dd>${esc(loja.formacao)}</dd></div>`);
        if (loja.experienciaAnos) itens.push(`<div><dt>Experiência</dt><dd>${loja.experienciaAnos} anos no mercado</dd></div>`);
        if ((loja.especialidades || []).length) {
            itens.push(`<div><dt>Especialidades</dt><dd><div class="badges">${loja.especialidades.map(function (e) { return `<span class="badge">${esc(e)}</span>`; }).join("")}</div></dd></div>`);
        }
        if (!itens.length) return "";
        return `<section class="perfil-card"><h2>Profissional</h2><dl class="perfil-prof">${itens.join("")}</dl></section>`;
    }

    function blocoServicos(loja) {
        const serv = loja.servicos || {};
        const chaves = (loja.categorias || []).filter(function (c) { return serv[c]; });
        if (!chaves.length) return "";
        return `<section class="perfil-card"><h2>Serviços, valores e prazos</h2><div class="servico-grid">` +
            chaves.map(function (c) {
                const s = serv[c];
                return `<div class="servico-card"><h3>${esc(U.categoriaLabel(c))}</h3>
                    <p>${esc(s.descricao || "")}</p>
                    ${s.preco ? `<div class="linha"><b>Valores:</b> ${esc(s.preco)}</div>` : ""}
                    ${s.prazo ? `<div class="linha"><b>Prazo:</b> ${esc(s.prazo)}</div>` : ""}</div>`;
            }).join("") + `</div></section>`;
    }

    async function carregar() {
        const id = Number(new URLSearchParams(window.location.search).get("id"));
        if (!id) { container.innerHTML = '<p class="vazio">Nenhum perfil informado (esperado: perfil-loja.html?id=…).</p>'; return; }

        let loja;
        try { loja = await AutoSetupApi.obterLojaPublica(id); }
        catch (erro) { container.innerHTML = `<p class="vazio">Não foi possível carregar este perfil: ${esc(erro.message)}</p>`; return; }
        if (!loja) { container.innerHTML = '<p class="vazio">Este perfil não existe ou foi removido.</p>'; return; }

        document.title = "AutoSync | " + loja.nome;
        AutoSetupApi.registrarAcessoLoja(loja.id);

        const cats = (loja.categorias || []).map(function (c) { return `<span class="badge">${esc(U.categoriaLabel(c))}</span>`; }).join("");
        const csv = loja.emiteCSV ? '<span class="badge csv">Emite CSV</span>' : '<span class="badge neutro">Não emite CSV</span>';

        container.innerHTML = `
            <section class="perfil-hero">
                <h1>${esc(loja.nome)}</h1>
                <div class="dir-regiao">${esc(loja.regiao)}</div>
                <div class="badges">${cats}${csv}</div>
                ${linhaContato(loja)}
                ${loja.observacao ? `<p class="perfil-obs">${esc(loja.observacao)}</p>` : ""}
            </section>
            ${blocoProfissional(loja)}
            ${loja.descricao ? `<section class="perfil-card"><h2>Como trabalhamos</h2><p class="texto">${esc(loja.descricao)}</p></section>` : ""}
            ${blocoServicos(loja)}
            ${(loja.fotos || []).length ? `<section class="perfil-card"><h2>Fotos do espaço</h2><div class="perfil-galeria">${loja.fotos.map(function (f) { return `<img src="${esc(f)}" alt="Foto de ${esc(loja.nome)}" loading="lazy">`; }).join("")}</div></section>` : ""}
            <section class="perfil-card" id="publicacoes"><h2>Serviços realizados</h2><p class="vazio">Carregando…</p></section>
        `;
        carregarPublicacoes(loja);
    }

    async function carregarPublicacoes(loja) {
        const alvo = document.getElementById("publicacoes");
        let posts;
        try { posts = await AutoSetupApi.listarPublicacoes(loja.id); }
        catch (e) { alvo.innerHTML = '<h2>Serviços realizados</h2><p class="vazio">Não foi possível carregar as publicações.</p>'; return; }

        if (!posts.length) { alvo.innerHTML = '<h2>Serviços realizados</h2><p class="vazio">Este prestador ainda não publicou nenhum serviço.</p>'; return; }

        const cats = Array.from(new Set(posts.map(function (p) { return p.categoria; }).filter(Boolean)));
        let filtro = null;

        function desenhar() {
            const lista = posts.filter(function (p) { return !filtro || p.categoria === filtro; });
            alvo.innerHTML = `<h2>Serviços realizados</h2>` +
                (cats.length > 1 ? `<div class="dir-filtros" style="margin-top:0">${cats.map(function (c) {
                    return `<button type="button" class="chip-filtro" data-cat="${esc(c)}" aria-pressed="${filtro === c}">${esc(U.categoriaLabel(c))}</button>`;
                }).join("")}</div>` : "") +
                `<div class="pub-grid">${lista.map(function (p) {
                    return `<article class="pub-card">
                        ${p.imagem ? U.imgTag(p.imagem, p.titulo) : ""}
                        <div class="pub-body">
                            <div class="badges">
                                ${p.categoria ? `<span class="badge">${esc(U.categoriaLabel(p.categoria))}</span>` : ""}
                                ${p.veiculo ? `<span class="badge neutro">🚗 ${esc(p.veiculo)}</span>` : ""}
                            </div>
                            <h3>${esc(p.titulo)}</h3>
                            <p>${esc(p.conteudo)}</p>
                            <span class="pub-data">${esc(U.formatarData(p.criadoEm))}</span>
                        </div></article>`;
                }).join("")}</div>`;
            alvo.querySelectorAll("[data-cat]").forEach(function (b) {
                b.addEventListener("click", function () { filtro = filtro === b.dataset.cat ? null : b.dataset.cat; desenhar(); });
            });
        }
        desenhar();
    }

    carregar();
})();
