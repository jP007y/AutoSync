/* ============================================================
   AUTOSYNC — DIRETÓRIO DE OFICINAS / PRESTADORES
   Página pública (não exige login): lista todos os prestadores com
   filtros por categoria, CSV e busca por texto. Cada card abre o
   perfil completo (perfil-loja.html?id=...).
   ============================================================ */
(function () {
    "use strict";
    const U = AutoSyncUtil, esc = U.esc;
    const grade = document.getElementById("grade");
    const busca = document.getElementById("busca");
    const chipCSV = document.getElementById("chipCSV");
    const chipsEl = document.getElementById("chipsCategoria");

    let lojas = [];
    let capas = {};                // lojaId -> imagem da publicação mais recente
    let categoriaAtiva = null;

    // O botão "Painel" leva ao painel certo conforme quem está logado
    const usuario = window.AutoSetupAuth ? AutoSetupAuth.obterUsuarioLogado() : null;
    const voltar = document.getElementById("linkVoltarPainel");
    if (usuario && usuario.tipo === "prestador") voltar.href = "painel-prestador.html";
    if (!usuario) { voltar.textContent = "Entrar"; voltar.href = "login.html"; }

    Object.keys(U.CATEGORIAS).forEach(function (chave) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip-filtro"; b.textContent = U.CATEGORIAS[chave];
        b.dataset.cat = chave; b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
            categoriaAtiva = categoriaAtiva === chave ? null : chave;
            chipsEl.querySelectorAll(".chip-filtro").forEach(function (x) {
                x.setAttribute("aria-pressed", String(x.dataset.cat === categoriaAtiva));
            });
            desenhar();
        });
        chipsEl.appendChild(b);
    });

    chipCSV.addEventListener("click", function () {
        chipCSV.setAttribute("aria-pressed", String(chipCSV.getAttribute("aria-pressed") !== "true"));
        desenhar();
    });
    busca.addEventListener("input", desenhar);

    function textoBuscavel(l) {
        return [l.nome, l.regiao, l.responsavel, l.formacao, (l.especialidades || []).join(" "),
                (l.categorias || []).map(U.categoriaLabel).join(" ")].join(" ").toLowerCase();
    }

    function desenhar() {
        const termo = busca.value.trim().toLowerCase();
        const soCSV = chipCSV.getAttribute("aria-pressed") === "true";
        const filtradas = lojas.filter(function (l) {
            if (categoriaAtiva && (l.categorias || []).indexOf(categoriaAtiva) === -1) return false;
            if (soCSV && !l.emiteCSV) return false;
            if (termo && textoBuscavel(l).indexOf(termo) === -1) return false;
            return true;
        });

        if (!filtradas.length) {
            grade.innerHTML = '<p class="dir-vazio">Nenhum prestador encontrado com esses filtros.</p>';
            return;
        }

        grade.innerHTML = filtradas.map(function (l) {
            const cats = (l.categorias || []).map(function (c) { return `<span class="badge">${esc(U.categoriaLabel(c))}</span>`; }).join("");
            const csv = l.emiteCSV ? '<span class="badge csv">Emite CSV</span>' : "";
            const esp = (l.especialidades || []).slice(0, 2).map(function (e) { return `<span class="badge neutro">${esc(e)}</span>`; }).join("");
            const capa = capas[l.id] ? U.imgTag(capas[l.id], "Serviço realizado por " + l.nome) : "";
            return `
              <a class="dir-card" href="perfil-loja.html?id=${l.id}">
                <div class="dir-card-thumb">${capa}</div>
                <div class="dir-card-body">
                  <h3>${esc(l.nome)}</h3>
                  <div class="dir-regiao">${esc(l.regiao)}${l.experienciaAnos ? ` · ${l.experienciaAnos} anos de experiência` : ""}</div>
                  <div class="badges">${cats}${csv}</div>
                  ${l.responsavel ? `<div class="dir-pessoa">${esc(l.responsavel)}${l.formacao ? ` <span>· ${esc(l.formacao.split("·")[0].trim())}</span>` : ""}</div>` : ""}
                  ${esp ? `<div class="badges">${esp}</div>` : ""}
                  <span class="dir-ver">Ver perfil e trabalhos →</span>
                </div>
              </a>`;
        }).join("");
    }

    async function iniciar() {
        try {
            lojas = await AutoSetupApi.listarLojas();
        } catch (erro) {
            grade.innerHTML = `<p class="dir-vazio">${esc(erro.message)}</p>`;
            return;
        }
        desenhar();
        // Miniaturas: imagem da publicação mais recente de cada loja (carrega em paralelo)
        await Promise.all(lojas.map(async function (l) {
            try {
                const posts = await AutoSetupApi.listarPublicacoes(l.id);
                const comImg = posts.find(function (p) { return p.imagem; });
                if (comImg) capas[l.id] = comImg.imagem;
            } catch (e) { /* sem miniatura */ }
        }));
        desenhar();
    }
    iniciar();
})();
