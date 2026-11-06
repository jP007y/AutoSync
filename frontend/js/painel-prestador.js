/* ============================================================
   AUTOSETUP — PAINEL DO PRESTADOR
   ============================================================

   Depende de (carregados antes, via <script> em
   painel-prestador.html):
     - js/api.js   -> window.AutoSetupApi
     - js/auth.js  -> window.AutoSetupAuth
   ============================================================ */

const usuario = AutoSetupAuth.exigirLogin("prestador");
// exigirLogin já redireciona se não for um prestador logado.
// Se `usuario` for null aqui, o redirecionamento já está em
// andamento — não faz sentido continuar executando este script.

if (usuario) {

    document.getElementById("saudacao").textContent = `Olá, ${usuario.nome}!`;

    document.getElementById("botaoSair").addEventListener("click", function () {
        AutoSetupAuth.sair();
        window.location.href = "login.html";
    });


    /* ========================================================
       CARREGAR ESTATÍSTICAS
       ======================================================== */

    async function carregarEstatisticas() {
        try {
            const stats = await AutoSetupApi.obterEstatisticasPrestador(usuario.id);
            document.getElementById("statAcessos").textContent = stats.totalAcessos;
            document.getElementById("statStatus").textContent =
                stats.lojaCadastrada ? "Ativo" : "Sem loja cadastrada";
        } catch (erro) {
            document.getElementById("statAcessos").textContent = "—";
            document.getElementById("statStatus").textContent = "Erro ao carregar";
            console.error("Falha ao carregar estatísticas:", erro.message);
        }
    }


    /* ========================================================
       FOTOS DO EMPREENDIMENTO (upload local -> base64)
       ======================================================== */

    let fotosAtuais = []; // array de strings base64 (data URI)
    let lojaIdAtual = null; // preenchido assim que a loja existente carrega

    function renderizarFotosPreview() {
        const preview = document.getElementById("fotosPreview");
        preview.innerHTML = "";

        fotosAtuais.forEach(function (foto, indice) {
            const item = document.createElement("div");
            item.className = "painel-foto-item";
            item.innerHTML = `
                <img src="${foto}" alt="Foto ${indice + 1}">
                <button type="button" class="painel-foto-remover" title="Remover">✕</button>
            `;
            item.querySelector("button").addEventListener("click", function () {
                fotosAtuais.splice(indice, 1);
                renderizarFotosPreview();
            });
            preview.appendChild(item);
        });
    }

    function arquivoParaBase64(arquivo) {
        return new Promise(function (resolve, reject) {
            const leitor = new FileReader();
            leitor.onload = function () { resolve(leitor.result); };
            leitor.onerror = reject;
            leitor.readAsDataURL(arquivo);
        });
    }

    document.getElementById("inputFotos").addEventListener("change", async function (evento) {
        const arquivos = Array.from(evento.target.files);
        for (const arquivo of arquivos) {
            try {
                const base64 = await arquivoParaBase64(arquivo);
                fotosAtuais.push(base64);
            } catch (erro) {
                console.error("Falha ao ler imagem:", erro);
            }
        }
        renderizarFotosPreview();
        evento.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    });


    /* ========================================================
       CARREGAR LOJA EXISTENTE (SE HOUVER) NO FORMULÁRIO
       ======================================================== */

    async function carregarLojaNoFormulario() {
        let loja;
        try {
            loja = await AutoSetupApi.obterLojaDoPrestador(usuario.id);
        } catch (erro) {
            console.error("Falha ao carregar loja:", erro.message);
            return;
        }

        if (!loja) return; // prestador ainda não cadastrou loja — formulário fica em branco

        lojaIdAtual = loja.id;

        document.getElementById("nomeLoja").value = loja.nome || "";
        document.getElementById("regiaoLoja").value = loja.regiao || "";
        document.getElementById("emiteCSV").checked = !!loja.emiteCSV;
        document.getElementById("contatoLoja").value = loja.contato || "";
        document.getElementById("observacaoLoja").value = loja.observacao || "";
        document.getElementById("descricaoLoja").value = loja.descricao || "";
        document.getElementById("responsavelLoja").value = loja.responsavel || "";
        document.getElementById("experienciaLoja").value = loja.experienciaAnos || "";
        document.getElementById("formacaoLoja").value = loja.formacao || "";
        document.getElementById("especialidadesLoja").value = (loja.especialidades || []).join(", ");
        document.getElementById("horarioLoja").value = loja.horario || "";
        document.getElementById("enderecoLoja").value = loja.endereco || "";
        servicosCache = loja.servicos || {};

        const linkPerfil = document.getElementById("linkMeuPerfil");
        linkPerfil.href = "perfil-loja.html?id=" + loja.id;
        linkPerfil.style.display = "inline-flex";

        fotosAtuais = (loja.fotos || []).slice();
        renderizarFotosPreview();

        const categoriasSalvas = loja.categorias || [];
        document.querySelectorAll("#categoriasContainer input[type=checkbox]").forEach(function (checkbox) {
            checkbox.checked = categoriasSalvas.includes(checkbox.value);
        });
        renderizarServicos();

        carregarPublicacoes();
    }


    /* ========================================================
       DETALHES POR CATEGORIA (descrição, valores, prazo)
       Um bloco para cada categoria marcada em "O que você oferece".
       ======================================================== */

    let servicosCache = {};   // { categoria: {descricao, preco, prazo} }
    const servicosContainer = document.getElementById("servicosContainer");
    const esc = AutoSyncUtil.esc;

    function categoriasMarcadas() {
        return Array.from(document.querySelectorAll("#categoriasContainer input[type=checkbox]:checked"))
            .map(function (c) { return c.value; });
    }

    function coletarServicos(categorias) {
        // Lê o que está digitado agora e devolve só as categorias marcadas
        guardarDigitado();
        const out = {};
        categorias.forEach(function (c) { if (servicosCache[c]) out[c] = servicosCache[c]; });
        return out;
    }

    function guardarDigitado() {
        servicosContainer.querySelectorAll("[data-cat]").forEach(function (bloco) {
            servicosCache[bloco.dataset.cat] = {
                descricao: bloco.querySelector("[data-campo=descricao]").value.trim(),
                preco: bloco.querySelector("[data-campo=preco]").value.trim(),
                prazo: bloco.querySelector("[data-campo=prazo]").value.trim(),
            };
        });
    }

    function renderizarServicos() {
        guardarDigitado();
        const marcadas = categoriasMarcadas();
        if (!marcadas.length) { servicosContainer.innerHTML = ""; return; }
        servicosContainer.innerHTML = '<p class="card-description" style="margin:12px 0 0">Detalhe o que você faz em cada categoria. Isso aparece no seu perfil público, com valores e prazos.</p>' +
            marcadas.map(function (c) {
                const v = servicosCache[c] || {};
                return `<div class="painel-servico" data-cat="${c}">
                    <h3>${esc(AutoSyncUtil.categoriaLabel(c))}</h3>
                    <div class="painel-field"><label>O que você faz nesta categoria</label>
                        <textarea data-campo="descricao" rows="2" placeholder="Ex: Troca de molas e amortecedores, kits coilover...">${esc(v.descricao || "")}</textarea></div>
                    <div class="painel-linha-2">
                        <div class="painel-field"><label>Valores</label>
                            <input type="text" data-campo="preco" placeholder="Ex: A partir de R$ 800" value="${esc(v.preco || "")}"></div>
                        <div class="painel-field"><label>Prazo</label>
                            <input type="text" data-campo="prazo" placeholder="Ex: 1 a 2 dias" value="${esc(v.prazo || "")}"></div>
                    </div></div>`;
            }).join("");
        atualizarCategoriasDePublicacao();
    }

    // O tipo de serviço de uma publicação só aceita categorias que a loja atende
    function atualizarCategoriasDePublicacao() {
        const marcadas = categoriasMarcadas();
        document.querySelectorAll("#categoriaPublicacao option").forEach(function (opt) {
            if (!opt.value) return;
            opt.hidden = marcadas.length > 0 && marcadas.indexOf(opt.value) === -1;
        });
    }

    document.querySelectorAll("#categoriasContainer input[type=checkbox]").forEach(function (cb) {
        cb.addEventListener("change", renderizarServicos);
    });


    /* ========================================================
       SALVAR (CRIAR OU ATUALIZAR) A LOJA
       ======================================================== */

    const lojaForm = document.getElementById("lojaForm");
    const botaoSalvarLoja = document.getElementById("botaoSalvarLoja");
    const lojaMensagem = document.getElementById("lojaMensagem");

    lojaForm.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const categoriasSelecionadas = Array.from(
            document.querySelectorAll("#categoriasContainer input[type=checkbox]:checked")
        ).map(function (checkbox) { return checkbox.value; });

        if (categoriasSelecionadas.length === 0) {
            lojaMensagem.textContent = "Selecione ao menos uma categoria que você atende.";
            lojaMensagem.className = "painel-mensagem erro";
            return;
        }

        const dadosLoja = {
            nome: document.getElementById("nomeLoja").value.trim(),
            regiao: document.getElementById("regiaoLoja").value.trim(),
            categorias: categoriasSelecionadas,
            emiteCSV: document.getElementById("emiteCSV").checked,
            contato: document.getElementById("contatoLoja").value.trim() || null,
            observacao: document.getElementById("observacaoLoja").value.trim() || null,
            descricao: document.getElementById("descricaoLoja").value.trim() || null,
            fotos: fotosAtuais,
            responsavel: document.getElementById("responsavelLoja").value.trim() || null,
            experienciaAnos: Number(document.getElementById("experienciaLoja").value) || null,
            formacao: document.getElementById("formacaoLoja").value.trim() || null,
            especialidades: document.getElementById("especialidadesLoja").value
                .split(",").map(function (t) { return t.trim(); }).filter(Boolean),
            horario: document.getElementById("horarioLoja").value.trim() || null,
            endereco: document.getElementById("enderecoLoja").value.trim() || null,
            servicos: coletarServicos(categoriasSelecionadas),
        };

        botaoSalvarLoja.disabled = true;
        lojaMensagem.textContent = "Salvando...";
        lojaMensagem.className = "painel-mensagem";

        try {
            const lojaSalva = await AutoSetupApi.salvarLojaDoPrestador(usuario.id, dadosLoja);
            lojaIdAtual = lojaSalva.id;
            lojaMensagem.textContent = "Loja salva com sucesso! Ela já aparece nas recomendações.";
            lojaMensagem.className = "painel-mensagem sucesso";
            carregarEstatisticas(); // atualiza "Situação do cadastro" para "Ativo"
            carregarPublicacoes();  // agora que já temos lojaIdAtual, libera a seção de publicações
        } catch (erro) {
            lojaMensagem.textContent = erro.message;
            lojaMensagem.className = "painel-mensagem erro";
        } finally {
            botaoSalvarLoja.disabled = false;
        }
    });


    /* ========================================================
       PUBLICAÇÕES (PORTFÓLIO)
       ======================================================== */

    async function carregarPublicacoes() {
        const listaContainer = document.getElementById("listaPublicacoes");

        if (!lojaIdAtual) {
            listaContainer.innerHTML = `<p class="card-description">Salve sua loja primeiro para poder publicar.</p>`;
            return;
        }

        let publicacoes;
        try {
            publicacoes = await AutoSetupApi.listarPublicacoes(lojaIdAtual);
        } catch (erro) {
            listaContainer.innerHTML = `<p class="card-description">Não foi possível carregar suas publicações.</p>`;
            return;
        }

        if (publicacoes.length === 0) {
            listaContainer.innerHTML = `<p class="card-description">Você ainda não publicou nada.</p>`;
            return;
        }

        listaContainer.innerHTML = "";
        publicacoes.forEach(function (post) {
            const item = document.createElement("div");
            item.className = "painel-publicacao-item";
            item.innerHTML = `
                <div>
                    <h4>${esc(post.titulo)}</h4>
                    <p style="color:#8b949e;font-size:12px;margin-bottom:4px">${post.veiculo ? "🚗 " + esc(post.veiculo) : ""}${post.categoria ? " · " + esc(AutoSyncUtil.categoriaLabel(post.categoria)) : ""}</p>
                    <p>${esc(post.conteudo)}</p>
                </div>
                <button type="button" class="painel-publicacao-excluir" data-id="${post.id}">Excluir</button>
            `;
            item.querySelector("button").addEventListener("click", async function () {
                if (!confirm("Excluir esta publicação?")) return;
                try {
                    await AutoSetupApi.excluirPublicacao(usuario.id, post.id);
                    carregarPublicacoes();
                } catch (erro) {
                    alert("Não foi possível excluir: " + erro.message);
                }
            });
            listaContainer.appendChild(item);
        });
    }

    const publicacaoForm = document.getElementById("publicacaoForm");
    const botaoPublicar = document.getElementById("botaoPublicar");
    const publicacaoMensagem = document.getElementById("publicacaoMensagem");

    publicacaoForm.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        if (!lojaIdAtual) {
            publicacaoMensagem.textContent = "Salve sua loja antes de publicar.";
            publicacaoMensagem.className = "painel-mensagem erro";
            return;
        }

        const arquivoImagem = document.getElementById("inputImagemPublicacao").files[0];
        let imagemBase64 = null;
        if (arquivoImagem) {
            try {
                imagemBase64 = await arquivoParaBase64(arquivoImagem);
            } catch (erro) {
                console.error("Falha ao ler imagem da publicação:", erro);
            }
        }

        const dadosPublicacao = {
            titulo: document.getElementById("tituloPublicacao").value.trim(),
            conteudo: document.getElementById("conteudoPublicacao").value.trim(),
            imagem: imagemBase64,
            veiculo: document.getElementById("veiculoPublicacao").value.trim() || null,
            categoria: document.getElementById("categoriaPublicacao").value || null,
        };

        botaoPublicar.disabled = true;
        publicacaoMensagem.textContent = "Publicando...";
        publicacaoMensagem.className = "painel-mensagem";

        try {
            await AutoSetupApi.criarPublicacao(usuario.id, dadosPublicacao);
            publicacaoMensagem.textContent = "Publicado com sucesso!";
            publicacaoMensagem.className = "painel-mensagem sucesso";
            publicacaoForm.reset();
            carregarPublicacoes();
        } catch (erro) {
            publicacaoMensagem.textContent = erro.message;
            publicacaoMensagem.className = "painel-mensagem erro";
        } finally {
            botaoPublicar.disabled = false;
        }
    });


    /* ========================================================
       INICIALIZAÇÃO
       ======================================================== */

    carregarEstatisticas();
    carregarLojaNoFormulario();
}