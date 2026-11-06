/* ============================================================
   AUTOSETUP
   JAVASCRIPT DA INTERFACE (MVP funcional)
   ============================================================

   Este arquivo agora faz 3 coisas:

   1. Carrega o veículo do "banco de dados" (data/veiculos.js)
      e preenche a ficha técnica na tela.
   2. Ao escolher uma categoria no modal, pede os parâmetros da
      modificação (via prompt(), suficiente para o MVP) e chama
      o motor de regras (js/rules-engine.js).
   3. Renderiza o resultado (cascata, consequências, risco,
      legalidade e score) nas seções já existentes do HTML.

   O que ainda NÃO está aqui (fica para depois do MVP):
   - Persistência (tudo é reiniciado ao recarregar a página)
   - Formulário de verdade no modal (usamos prompt() por agora)
   - Múltiplas modificações combinadas na mesma simulação
   - Chamada a uma IA (system_prompt.txt) para casos não
     cobertos por regra determinística
   ============================================================ */

/* ============================================================
   AUTOSETUP
   JAVASCRIPT DA INTERFACE (MVP funcional)
   ============================================================

   Este arquivo agora faz 4 coisas:

   1. Busca o veículo na API do backend (js/api.js -> FastAPI ->
      banco SQLite), em vez de usar um array fixo no frontend.
   2. Preenche a ficha técnica na tela assim que a resposta chega.
   3. Ao escolher uma categoria no modal, pede os parâmetros da
      modificação (via prompt(), suficiente para o MVP) e chama
      o motor de regras (js/rules-engine.js).
   4. Renderiza o resultado (cascata, consequências, risco,
      legalidade e score) nas seções já existentes do HTML.

   O que ainda NÃO está aqui (fica para depois do MVP):
   - services/cascade.py e services/legality.py ainda não existem
     no backend, então o cálculo de cascata/risco/legalidade
     continua rodando no frontend (rules-engine.js). Migrar isso
     para o backend é o próximo passo combinado.
   - Persistência de modificações (tudo é reiniciado ao recarregar
     a página)
   - Formulário de verdade no modal (usamos prompt() por agora)
   ============================================================ */

const usuarioLogado = AutoSetupAuth.exigirLogin("consumidor");
// Se não houver usuário logado (ou for um prestador), exigirLogin já
// redireciona. O restante do arquivo só roda de fato quando há um
// consumidor válido — por isso o if() logo abaixo.

let veiculoAtual = null;
let contadorModificacoes = 0;

const CHAVE_VEICULO = "autosync_veiculo_id";
const ID_VEICULO_PADRAO = 1; // Onix (usado só até a pessoa escolher outro)
let listaVeiculos = [];

function veiculoEscolhidoId() {
    const salvo = Number(localStorage.getItem(CHAVE_VEICULO));
    return salvo || ID_VEICULO_PADRAO;
}


/* ============================================================
   ELEMENTOS DA INTERFACE
   ============================================================ */

const addModificationButton = document.getElementById("addModificationButton");
const modificationModal = document.getElementById("modificationModal");
const closeModalButton = document.getElementById("closeModalButton");
const modificationOptions = document.querySelectorAll(".modification-options button");


/* ============================================================
   PERFIL / LOGOUT
   ============================================================ */

if (usuarioLogado) {

    const profileButton = document.getElementById("profileButton");
    profileButton.textContent = usuarioLogado.nome
        .split(" ")
        .map(function (parte) { return parte[0]; })
        .slice(0, 2)
        .join("")
        .toUpperCase();

    profileButton.addEventListener("click", function () {
        const confirmarSaida = confirm(`Sair da conta de ${usuarioLogado.nome}?`);
        if (confirmarSaida) {
            AutoSetupAuth.sair();
            window.location.href = "login.html";
        }
    });

}


/* ============================================================
   CARREGAR VEÍCULO A PARTIR DA API (backend + banco de dados)
   ============================================================ */

async function carregarVeiculo() {

    // Enquanto carrega, evita que o usuário tente adicionar uma
    // modificação sem ter veículo carregado ainda.
    addModificationButton.disabled = true;

    try {
        listaVeiculos = await AutoSetupApi.listarVeiculos();
        const primeiraVisita = !localStorage.getItem(CHAVE_VEICULO);

        let escolhido = listaVeiculos.find(function (v) { return v.id === veiculoEscolhidoId(); })
            || listaVeiculos[0];
        veiculoAtual = escolhido;

        preencherFichaTecnica(veiculoAtual);
        addModificationButton.disabled = false;

        // Primeira vez: pede para a pessoa escolher entre os 3 carros.
        if (primeiraVisita) {
            abrirModalVeiculos();
        } else {
            abrirModificacaoDaUrl();
        }
    } catch (erro) {
        mostrarErroDeCarregamento(erro.message);
    }
}

/* Vindo do Raio-X 3D, a URL traz ?mod=categoria: abre direto o fluxo
   daquela modificação, como se o usuário tivesse clicado no modal. */
function abrirModificacaoDaUrl() {
    const categoria = new URLSearchParams(window.location.search).get("mod");
    if (!categoria) return;
    history.replaceState(null, "", window.location.pathname + window.location.hash);
    const botao = document.querySelector('.modification-options button[data-mod-key="' + categoria + '"]');
    if (botao) botao.click();
}

function mostrarErroDeCarregamento(mensagem) {
    document.getElementById("vehicleImage").innerHTML = '<span class="vehicle-image-label">Veículo indisponível</span>';
    document.getElementById("vehicleTitle").textContent = "Não foi possível carregar o veículo";
    document.getElementById("vehicleAno").textContent = "—";
    document.getElementById("vehicleMotor").textContent = "—";
    document.getElementById("vehiclePotencia").textContent = "—";
    document.getElementById("vehicleCambio").textContent = "—";

    console.error("Falha ao carregar veículo:", mensagem);

    const secaoVeiculo = document.getElementById("veiculo");
    let aviso = document.getElementById("vehicleLoadError");
    if (!aviso) {
        aviso = document.createElement("p");
        aviso.id = "vehicleLoadError";
        aviso.className = "card-description";
        aviso.style.color = "#ef4444";
        secaoVeiculo.appendChild(aviso);
    }
    aviso.textContent = mensagem;
}


/* ============================================================
   PREENCHER FICHA TÉCNICA DO VEÍCULO (a partir da resposta da API)
   ============================================================ */

function preencherFichaTecnica(veiculo) {

    const nome = `${veiculo.marca} ${veiculo.modelo}`;

    // Foto do carro (usa .jpg se existir; senão a ilustração .svg)
    const capa = document.getElementById("vehicleImage");
    capa.innerHTML =
        AutoSyncUtil.imgTag(veiculo.imagem, nome) +
        `<span class="vehicle-image-label" id="vehicleImageLabel">${AutoSyncUtil.esc(nome)}</span>`;

    document.getElementById("vehicleTitle").textContent =
        `${nome} ${veiculo.versao || ""}`.trim();

    document.getElementById("vehicleResumo").textContent = veiculo.resumo || "";

    document.getElementById("vehicleAno").textContent =
        veiculo.anoModelo;

    document.getElementById("vehicleMotor").textContent =
        veiculo.motor.descricao;

    document.getElementById("vehiclePotencia").textContent =
        veiculo.motor.potenciaCvEtanol === veiculo.motor.potenciaCvGasolina
            ? `${veiculo.motor.potenciaCvEtanol} cv`
            : `${veiculo.motor.potenciaCvEtanol} cv (E) / ${veiculo.motor.potenciaCvGasolina} cv (G)`;

    document.getElementById("vehicleCambio").textContent =
        veiculo.transmissao.opcoes.join(" ou ");
}

if (usuarioLogado) {
    carregarVeiculo();
}


/* ============================================================
   ABRIR / FECHAR MODAL
   ============================================================ */

addModificationButton.addEventListener("click", function () {
    modificationModal.classList.add("is-open");
});

closeModalButton.addEventListener("click", function () {
    modificationModal.classList.remove("is-open");
});

modificationModal.addEventListener("click", function (event) {
    if (event.target === modificationModal) {
        modificationModal.classList.remove("is-open");
    }
});


/* ============================================================
   COLETA DE PARÂMETROS POR CATEGORIA (MVP: prompt())
   ============================================================

   Cada categoria sabe pedir os parâmetros mínimos necessários
   para o motor de regras calcular a cascata. Retorna `null` se
   o usuário cancelar, para abortar a simulação.
   ============================================================ */

/* ============================================================
   FORMULÁRIO DE PARÂMETROS DA MODIFICAÇÃO
   ============================================================

   Em vez de um prompt() pedindo "um número", cada categoria mostra
   um formulário que explica O QUE significa cada valor, qual é o
   valor original do carro, o limite legal (quando existe) e um
   resumo em tempo real do que o número digitado significa.
   `abrirFormulario(categoria, veiculo)` devolve uma Promise com os
   parâmetros para o motor de regras, ou null se a pessoa cancelar.
   ============================================================ */

const REGRAS_LEGAIS = (typeof AUTOSETUP_REGULAMENTACAO !== "undefined") ? AUTOSETUP_REGULAMENTACAO : null;

function numero(v) { const n = Number(String(v).replace(",", ".")); return isNaN(n) ? null : n; }

const formularios = {

    suspensao: function (veiculo) {
        const original = veiculo.suspensao.alturaLivreSoloOriginalMm;
        const minimo = REGRAS_LEGAIS ? REGRAS_LEGAIS.suspensao.regras.alturaMinimaSoloMm_PBTAte3500 : 100;
        return {
            titulo: "Rebaixar ou elevar a suspensão",
            intro: "Informe a altura que o carro terá depois da modificação.",
            campos: [{
                id: "novaAlturaSoloMm",
                rotulo: "Altura livre do solo depois da modificação",
                unidade: "mm",
                padrao: original - 20,
                referencia: `Original de fábrica: <b>${original} mm</b> · Mínimo legal: <b>${minimo} mm</b>`,
                ajuda: "É a distância entre o ponto mais baixo do carro (normalmente o cárter ou a barra estabilizadora) e o chão. " +
                       "Quanto MENOR o número, mais baixo fica o carro. Exemplo: se hoje são " + original +
                       " mm e você digitar " + (original - 30) + ", o carro será rebaixado em 30 mm."
            }],
            atalhos: [
                { rotulo: "Rebaixar 20 mm (leve)", valores: { novaAlturaSoloMm: original - 20 } },
                { rotulo: "Rebaixar 35 mm (esportivo)", valores: { novaAlturaSoloMm: original - 35 } },
                { rotulo: "Rebaixar 60 mm (extremo)", valores: { novaAlturaSoloMm: original - 60 } },
                { rotulo: "Elevar 20 mm", valores: { novaAlturaSoloMm: original + 20 } }
            ],
            resumo: function (v) {
                const nova = numero(v.novaAlturaSoloMm);
                if (nova === null || nova <= 0) return { tom: "erro", html: "Digite a altura final em milímetros." };
                const dif = original - nova;
                const direcao = dif > 0 ? `rebaixado em <b>${dif} mm</b>` : dif < 0 ? `elevado em <b>${-dif} mm</b>` : "sem alteração";
                if (nova < minimo) return { tom: "erro", html: `Com <b>${nova} mm</b> do chão o carro fica ${direcao} e <b>abaixo do mínimo legal de ${minimo} mm</b>.` };
                return { tom: dif > 30 ? "atencao" : "ok", html: `O carro ficará a <b>${nova} mm</b> do chão (${direcao} em relação aos ${original} mm de fábrica).` };
            },
            montar: function (v) { return { novaAlturaSoloMm: numero(v.novaAlturaSoloMm) }; }
        };
    },

    rodasPneus: function (veiculo) {
        const original = veiculo.rodasPneus.diametroExternoOriginalMm;
        const medida = veiculo.rodasPneus.medidaPneuOriginal || "185/65 R15";
        const m = medida.match(/(\d+)\/(\d+)\s*R(\d+)/i) || [null, 185, 65, 15];
        const tolerancia = REGRAS_LEGAIS ? REGRAS_LEGAIS.rodasPneus.regras.toleranciaVariacaoDiametroPercentual : 3;
        const diametro = function (v) {
            const l = numero(v.largura), p = numero(v.perfil), a = numero(v.aro);
            if (!l || !p || !a) return null;
            return Math.round(2 * l * p / 100 + a * 25.4);
        };
        return {
            titulo: "Trocar rodas e pneus",
            intro: "Informe a medida do novo pneu (a que está impressa na lateral dele, ex.: " + medida + ").",
            campos: [
                { id: "largura", rotulo: "Largura do pneu", unidade: "mm", padrao: Number(m[1]), grupo: true,
                  ajuda: "Primeiro número da medida (ex.: 185). Pneus mais largos aumentam a aderência, mas podem roçar no para-lama." },
                { id: "perfil", rotulo: "Perfil (altura do pneu)", unidade: "%", padrao: Number(m[2]), grupo: true,
                  ajuda: "Segundo número (ex.: 65). É a altura da lateral em % da largura. Perfil menor = pneu mais 'baixo'." },
                { id: "aro", rotulo: "Aro da roda", unidade: "pol", padrao: Number(m[3]), grupo: true,
                  ajuda: "Número depois do R (ex.: 15). É o tamanho da roda em polegadas." }
            ],
            referencia: `Original: <b>${medida}</b> → diâmetro externo do conjunto <b>${original} mm</b> · Tolerância usada: <b>±${tolerancia}%</b>`,
            ajudaGeral: "O que importa para a lei e para o velocímetro é o <b>diâmetro externo</b> do conjunto roda + pneu, calculado automaticamente a partir da medida.",
            atalhos: [
                { rotulo: "Mesma medida de fábrica", valores: { largura: Number(m[1]), perfil: Number(m[2]), aro: Number(m[3]) } },
                { rotulo: "Aro +1", valores: { largura: Number(m[1]) + 10, perfil: Math.max(25, Number(m[2]) - 10), aro: Number(m[3]) + 1 } },
                { rotulo: "Aro +2 (perfil baixo)", valores: { largura: Number(m[1]) + 20, perfil: Math.max(25, Number(m[2]) - 20), aro: Number(m[3]) + 2 } }
            ],
            resumo: function (v) {
                const d = diametro(v);
                if (!d) return { tom: "erro", html: "Preencha largura, perfil e aro." };
                const dif = ((d - original) / original) * 100;
                const txt = `Diâmetro externo do novo conjunto: <b>${d} mm</b> (${dif >= 0 ? "+" : ""}${dif.toFixed(1)}% em relação aos ${original} mm de fábrica).`;
                if (Math.abs(dif) > tolerancia) return { tom: "erro", html: txt + ` Fora da tolerância de ±${tolerancia}%: o velocímetro e a legalidade são afetados.` };
                return { tom: Math.abs(dif) > tolerancia / 2 ? "atencao" : "ok", html: txt + " Dentro da tolerância." };
            },
            montar: function (v) { return { novoDiametroExternoMm: diametro(v) }; }
        };
    },

    escapamento: function (veiculo) {
        const original = veiculo.escapamento.diametroSaidaOriginalMm;
        return {
            titulo: "Trocar o escapamento",
            intro: "Informe o diâmetro do novo escapamento.",
            campos: [{
                id: "novoDiametroMm",
                rotulo: "Diâmetro do tubo de saída do escapamento",
                unidade: "mm",
                padrao: Math.round(original * 1.2),
                referencia: `Original de fábrica: <b>${original} mm</b>`,
                ajuda: "É o diâmetro interno do tubo do escape. Tubos muito maiores que o original reduzem a contrapressão e " +
                       "podem fazer o motor perder força em baixa rotação — principalmente em motores pequenos. Como referência: " +
                       "50 mm ≈ 2\", 63 mm ≈ 2,5\", 76 mm ≈ 3\"."
            }],
            atalhos: [
                { rotulo: "Mesmo diâmetro de fábrica", valores: { novoDiametroMm: original } },
                { rotulo: "+10 mm", valores: { novoDiametroMm: original + 10 } },
                { rotulo: "+25 mm", valores: { novoDiametroMm: original + 25 } },
                { rotulo: "Dobrar (muito grande)", valores: { novoDiametroMm: original * 2 } }
            ],
            resumo: function (v) {
                const novo = numero(v.novoDiametroMm);
                if (!novo || novo <= 0) return { tom: "erro", html: "Digite o diâmetro em milímetros." };
                const pct = ((novo - original) / original) * 100;
                const txt = `Diâmetro de <b>${novo} mm</b> (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% em relação aos ${original} mm de fábrica).`;
                if (pct > 40) return { tom: "erro", html: txt + " Superdimensionado: tende a perder torque em baixa rotação." };
                return { tom: pct > 20 ? "atencao" : "ok", html: txt + (pct > 20 ? " Aumento moderado: o ganho será pequeno." : " Variação leve.") };
            },
            montar: function (v) { return { novoDiametroMm: numero(v.novoDiametroMm) }; }
        };
    },

    // Categorias que não pedem número no MVP: o formulário só explica o que será analisado.
    motor: function () {
        return {
            titulo: "Modificação no motor",
            intro: "Nesta versão não é preciso informar valores.",
            campos: [],
            ajudaGeral: "A análise considera o efeito de preparações no motor (remapeamento, filtro, intercooler) sobre " +
                        "consumo, temperatura, emissões e garantia. Para valores medidos (cv/torque), use as oficinas recomendadas.",
            atalhos: [], resumo: function () { return null; }, montar: function () { return {}; }
        };
    },
    freios: function () {
        return {
            titulo: "Modificação nos freios",
            intro: "Nesta versão não é preciso informar valores.",
            campos: [],
            ajudaGeral: "A análise considera troca de discos, pastilhas e pinças e como isso afeta frenagem, desgaste e segurança.",
            atalhos: [], resumo: function () { return null; }, montar: function () { return {}; }
        };
    },
    eletrica: function () {
        return {
            titulo: "Modificação elétrica",
            intro: "Nesta versão não é preciso informar valores.",
            campos: [],
            ajudaGeral: "A análise considera iluminação (LED), módulos e chicotes: sobrecarga do sistema de 12 V, fusíveis e regulagem de faróis.",
            atalhos: [], resumo: function () { return null; }, montar: function () { return {}; }
        };
    }
};

const paramModal = document.getElementById("paramModal");
const paramForm = document.getElementById("paramForm");
let paramResolver = null;

function fecharParamModal(valor) {
    paramModal.classList.remove("is-open");
    if (paramResolver) { const r = paramResolver; paramResolver = null; r(valor); }
}

function abrirFormulario(categoria, veiculo) {
    const def = formularios[categoria] ? formularios[categoria](veiculo) : formularios.motor();
    const rot = rotulos[categoria] || { nome: categoria };
    const esc = AutoSyncUtil.esc;

    document.getElementById("paramLabel").textContent = rot.nome.toUpperCase();
    document.getElementById("paramTitle").textContent = def.titulo;
    document.getElementById("paramIntro").textContent = def.intro;

    const camposEl = document.getElementById("paramCampos");
    let html = "";
    if (def.referencia) html += `<div class="param-ref">${def.referencia}</div>`;
    if (def.ajudaGeral) html += `<p class="param-help">${def.ajudaGeral}</p>`;

    const agrupados = def.campos.some(function (c) { return c.grupo; });
    const blocos = def.campos.map(function (c) {
        const campo = `
            <div class="param-field">
                <label for="p_${c.id}">${esc(c.rotulo)}</label>
                ${c.referencia ? `<div class="param-ref">${c.referencia}</div>` : ""}
                <p class="param-help">${esc(c.ajuda)}</p>
                <div class="param-input-row">
                    <input id="p_${c.id}" name="${c.id}" type="number" inputmode="decimal" step="any" value="${c.padrao}">
                    <span class="param-unit">${esc(c.unidade)}</span>
                </div>
            </div>`;
        return campo;
    });
    html += agrupados ? `<div class="param-grid">${blocos.join("")}</div>` : blocos.join("");
    camposEl.innerHTML = html;

    const presetsEl = document.getElementById("paramPresets");
    presetsEl.innerHTML = "";
    (def.atalhos || []).forEach(function (a) {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = a.rotulo;
        b.addEventListener("click", function () {
            Object.keys(a.valores).forEach(function (id) { document.getElementById("p_" + id).value = a.valores[id]; });
            atualizarResumo();
        });
        presetsEl.appendChild(b);
    });

    const resumoEl = document.getElementById("paramResumo");
    function valores() {
        const v = {};
        def.campos.forEach(function (c) { v[c.id] = document.getElementById("p_" + c.id).value; });
        return v;
    }
    function atualizarResumo() {
        const r = def.resumo(valores());
        if (!r) { resumoEl.style.display = "none"; return; }
        resumoEl.style.display = "block";
        resumoEl.className = "param-resumo tom-" + r.tom;
        resumoEl.innerHTML = r.html;
    }
    camposEl.oninput = atualizarResumo;
    atualizarResumo();

    paramForm.onsubmit = function (e) {
        e.preventDefault();
        const r = def.resumo(valores());
        if (r && r.html.indexOf("Digite") === 0 || (r && r.html.indexOf("Preencha") === 0)) return;
        fecharParamModal(def.montar(valores()));
    };

    paramModal.classList.add("is-open");
    return new Promise(function (resolve) { paramResolver = resolve; });
}

document.getElementById("closeParamModal").addEventListener("click", function () { fecharParamModal(null); });
document.getElementById("paramCancel").addEventListener("click", function () { fecharParamModal(null); });
paramModal.addEventListener("click", function (e) { if (e.target === paramModal) fecharParamModal(null); });


/* ============================================================
   ESCOLHER VEÍCULO (3 modelos)
   ============================================================ */

const vehicleModal = document.getElementById("vehicleModal");

function abrirModalVeiculos() {
    const cont = document.getElementById("vehicleOptions");
    const esc = AutoSyncUtil.esc;
    cont.innerHTML = "";
    listaVeiculos.forEach(function (v) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "vehicle-option" + (veiculoAtual && v.id === veiculoAtual.id ? " is-selected" : "");
        b.innerHTML = `
            ${AutoSyncUtil.imgTag(v.imagem, v.marca + " " + v.modelo)}
            <div class="vehicle-option-body">
                <span class="meta">${esc(v.marca)} · ${v.anoModelo}</span>
                <strong>${esc(v.modelo)} ${esc(v.versao || "")}</strong>
                <p>${esc(v.resumo || "")}</p>
                <div class="vehicle-option-chips">
                    <span>${v.motor.potenciaCvEtanol} cv</span>
                    <span>${esc(v.motor.aspiracao)}</span>
                    <span>aro ${v.rodasPneus.aroOriginalPolegadas}"</span>
                </div>
            </div>`;
        b.addEventListener("click", function () { escolherVeiculo(v.id); });
        cont.appendChild(b);
    });
    vehicleModal.classList.add("is-open");
}

function escolherVeiculo(id) {
    const mudou = !veiculoAtual || veiculoAtual.id !== id;
    localStorage.setItem(CHAVE_VEICULO, String(id));
    vehicleModal.classList.remove("is-open");
    // A simulação é sempre por veículo: recarrega para zerar o painel.
    if (mudou) window.location.reload();
}

document.getElementById("changeVehicleButton").addEventListener("click", function () {
    if (listaVeiculos.length) abrirModalVeiculos();
});
document.getElementById("closeVehicleModal").addEventListener("click", function () {
    // Se ainda não escolheu nada, fechar vale como "ficar com o carro mostrado".
    if (!localStorage.getItem(CHAVE_VEICULO) && veiculoAtual) localStorage.setItem(CHAVE_VEICULO, String(veiculoAtual.id));
    vehicleModal.classList.remove("is-open");
});

const rotulos = {
    suspensao: { nome: "Suspensão", icone: "⚙" },
    motor: { nome: "Motor", icone: "🔥" },
    rodasPneus: { nome: "Rodas e pneus", icone: "🛞" },
    escapamento: { nome: "Escape", icone: "🔊" },
    freios: { nome: "Freios", icone: "🛑" },
    eletrica: { nome: "Elétrica", icone: "💡" }
};


/* ============================================================
   CLIQUE EM UMA CATEGORIA DO MODAL
   ============================================================ */

modificationOptions.forEach(function (button) {

    button.addEventListener("click", async function () {

        if (!veiculoAtual) {
            alert("Aguarde o carregamento do veículo antes de adicionar uma modificação.");
            return;
        }

        const categoria = button.dataset.modKey;

        // Fecha a lista de categorias e abre o formulário explicativo daquela categoria
        modificationModal.classList.remove("is-open");
        const params = await abrirFormulario(categoria, veiculoAtual);

        // Usuário cancelou o prompt: não faz nada.
        if (params === null) {
            return;
        }

        const resultado = AutoSetupEngine.avaliarModificacao(
            veiculoAtual,
            categoria,
            params
        );

        adicionarModificacaoNaLista(categoria, params);
        renderizarCascata(categoria, resultado.cascata);
        renderizarConsequencias(resultado.consequencias);
        renderizarRisco(resultado.risco);
        renderizarLegalidade(resultado.legalidade);
        renderizarScore(resultado.score);
        renderizarLojas(categoria);

        modificationModal.classList.remove("is-open");
    });

});


/* ============================================================
   RENDERIZAÇÃO — LISTA DE MODIFICAÇÕES
   ============================================================ */

function statusParaClasse(status) {
    if (status === "regular" || status === "controlado") return "status-compatible";
    if (status === "atencao") return "status-warning";
    return "status-danger"; // critico / irregular
}

function statusParaTexto(status) {
    switch (status) {
        case "regular":
        case "controlado":
            return "COMPATÍVEL";
        case "atencao":
            return "ATENÇÃO";
        default:
            return "IRREGULAR";
    }
}

function adicionarModificacaoNaLista(categoria, params) {

    const lista = document.getElementById("modificationList");
    const vazio = document.getElementById("modificationListEmpty");
    if (vazio) vazio.remove();

    const rotulo = rotulos[categoria] || { nome: categoria, icone: "🔧" };
    const resumoParams = Object.values(params).length
        ? Object.values(params).join(" / ")
        : "Parâmetros padrão";

    const artigo = document.createElement("article");
    artigo.className = "modification";
    artigo.innerHTML = `
        <div class="modification-info">
            <div class="mod-icon">${rotulo.icone}</div>
            <div>
                <h3>${rotulo.nome}</h3>
                <p>${resumoParams}</p>
            </div>
        </div>
        <span class="status status-compatible">SIMULADO</span>
    `;

    lista.prepend(artigo);

    contadorModificacoes += 1;
    document.getElementById("modCount").textContent =
        `${contadorModificacoes} modificaç${contadorModificacoes === 1 ? "ão" : "ões"}`;
}


/* ============================================================
   RENDERIZAÇÃO — CASCATA
   ============================================================ */

function renderizarCascata(categoria, cascata) {

    const container = document.getElementById("cascadeContainer");
    container.innerHTML = "";

    cascata.forEach(function (etapa, index) {

        const node = document.createElement("div");
        node.className = "cascade-node";
        node.innerHTML = `
            <div class="node-icon">🔗</div>
            <strong>${etapa.componente}</strong>
            <span>${etapa.detalhe}</span>
        `;
        container.appendChild(node);

        if (index < cascata.length - 1) {
            const seta = document.createElement("div");
            seta.className = "cascade-arrow";
            seta.textContent = "→";
            container.appendChild(seta);
        }
    });

    const rotulo = rotulos[categoria] || { nome: categoria };
    document.getElementById("cascadeMeta").textContent = `Simulação: ${rotulo.nome}`;
}


/* ============================================================
   RENDERIZAÇÃO — CONSEQUÊNCIAS
   ============================================================ */

function renderizarConsequencias(consequencias) {

    const container = document.getElementById("impactList");
    container.innerHTML = "";

    consequencias.forEach(function (item) {
        const artigo = document.createElement("article");
        artigo.className = "impact impact-orange";
        artigo.innerHTML = `
            <div class="impact-header">
                <strong>${item.titulo}</strong>
                <span>${item.impacto}</span>
            </div>
            <p>${item.descricao}</p>
        `;
        container.appendChild(artigo);
    });

    document.getElementById("impactMeta").textContent =
        `${consequencias.length} consequência${consequencias.length === 1 ? "" : "s"}`;
}


/* ============================================================
   RENDERIZAÇÃO — RISCO (SEGURANÇA)
   ============================================================ */

function renderizarRisco(risco) {

    const box = document.getElementById("riskStatusBox");
    const icon = document.getElementById("riskIcon");

    box.classList.remove("status-box-green", "status-box-orange", "status-box-red");

    if (risco.status === "controlado") {
        box.classList.add("status-box-green");
        icon.textContent = "✓";
    } else if (risco.status === "atencao") {
        box.classList.add("status-box-orange");
        icon.textContent = "!";
    } else {
        box.classList.add("status-box-red");
        icon.textContent = "✕";
    }

    document.getElementById("riskTitle").textContent = risco.titulo;
    document.getElementById("riskDesc").textContent = risco.descricao;
}


/* ============================================================
   RENDERIZAÇÃO — LEGALIDADE
   ============================================================ */

function renderizarLegalidade(legalidade) {

    const box = document.getElementById("legalStatusBox");
    const icon = document.getElementById("legalIcon");

    box.classList.remove("status-box-green", "status-box-orange", "status-box-red");

    if (legalidade.status === "regular") {
        box.classList.add("status-box-green");
        icon.textContent = "✓";
    } else if (legalidade.status === "atencao") {
        box.classList.add("status-box-orange");
        icon.textContent = "!";
    } else {
        box.classList.add("status-box-red");
        icon.textContent = "✕";
    }

    document.getElementById("legalTitle").textContent = legalidade.titulo;
    document.getElementById("legalDesc").textContent = legalidade.descricao;
    document.getElementById("legalExtra").textContent = legalidade.descricao;
}


/* ============================================================
   RENDERIZAÇÃO — SCORE
   ============================================================ */

function renderizarScore(score) {

    document.getElementById("scoreNumber").textContent = score.total;
    document.getElementById("scoreDescription").textContent = score.descricao;

    const idsPorLabel = {
        "Segurança": { valor: "scoreValueSeguranca", barra: "scoreBarSeguranca" },
        "Desempenho": { valor: "scoreValueDesempenho", barra: "scoreBarDesempenho" },
        "Manutenção": { valor: "scoreValueManutencao", barra: "scoreBarManutencao" }
    };

    score.bars.forEach(function (barra) {
        const ids = idsPorLabel[barra.label];
        if (!ids) return;
        document.getElementById(ids.valor).textContent = Math.round(barra.value);
        document.getElementById(ids.barra).style.width = `${barra.value}%`;
    });
}


/* ============================================================
   RENDERIZAÇÃO — OFICINAS RECOMENDADAS (busca no backend)
   ============================================================ */

async function renderizarLojas(categoria) {

    const mensagem = document.getElementById("workshopMessage");
    const lista = document.getElementById("workshopList");

    mensagem.textContent = "Buscando oficinas especializadas...";
    lista.innerHTML = "";

    let lojas;
    try {
        lojas = await AutoSetupApi.buscarLojas({ categoria });
    } catch (erro) {
        mensagem.textContent = "Não foi possível buscar oficinas agora.";
        console.error("Falha ao buscar lojas:", erro.message);
        return;
    }

    if (lojas.length === 0) {
        mensagem.textContent = "Nenhuma oficina cadastrada para esta categoria ainda.";
        return;
    }

    const rotulo = rotulos[categoria] || { nome: categoria };
    mensagem.textContent = `Oficinas especializadas em ${rotulo.nome.toLowerCase()}:`;

    lojas.forEach(function (loja) {
        const item = document.createElement("a");
        item.className = "workshop-item";
        item.href = `perfil-loja.html?id=${loja.id}`;
        item.innerHTML = `
            <strong>${loja.nome}</strong>
            <p>${loja.regiao}${loja.emiteCSV ? " · Emite CSV" : ""}</p>
            ${loja.observacao ? `<p class="workshop-obs">${loja.observacao}</p>` : ""}
            ${loja.contato ? `<p class="workshop-contato">${loja.contato}</p>` : ""}
            <p class="workshop-ver-perfil">Ver perfil completo →</p>
        `;
        lista.appendChild(item);

        // Cada loja que aparece na recomendação conta como 1 acesso
        // ao perfil dela, para alimentar o painel do prestador.
        // Falha silenciosa (ver AutoSetupApi.registrarAcessoLoja) —
        // não deve travar a experiência do consumidor.
        AutoSetupApi.registrarAcessoLoja(loja.id);
    });
}