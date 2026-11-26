/* ============================================================
   AUTOSYNC — POSIÇÃO DA LOJA NO MAPA (painel do prestador)
   ============================================================
   Minimapa Leaflet dentro do formulário da loja. O prestador marca
   a posição clicando no mapa ou arrastando o pino, ou usa:
   - "Buscar endereço": UMA consulta ao Nominatim (OpenStreetMap),
     só quando clica no botão, a partir do campo Endereço;
   - "Usar minha localização": GPS do navegador (só HTTPS/localhost).
   A latitude/longitude vai junto quando ele clica em "Salvar loja".

   Se o Leaflet não carregar, o módulo fica inativo (ativo() = false)
   e o painel não envia latitude/longitude — o backend mantém a
   posição que já estava salva.
   ============================================================ */
const AutoSetupMapaLoja = (function () {
    "use strict";

    const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
    const INTERVALO_NOMINATIM_MS = 1500; // política de uso: no máximo 1 requisição/s

    let mapa = null;
    let pino = null;
    let ultimaBusca = 0;

    const $ = (id) => document.getElementById(id);

    function mensagem(texto) {
        $("mapaLojaStatus").textContent = texto;
    }

    function atualizarTexto() {
        if (!pino) {
            $("mapaLojaCoords").textContent = "Nenhuma posição marcada.";
            $("mapaLojaRemover").disabled = true;
            return;
        }
        const p = pino.getLatLng();
        $("mapaLojaCoords").textContent =
            "Posição marcada: " + p.lat.toFixed(5) + ", " + p.lng.toFixed(5) + " (salve a loja para gravar).";
        $("mapaLojaRemover").disabled = false;
    }

    function colocarPino(lat, lng, centralizar) {
        if (!mapa) return;
        if (pino) {
            pino.setLatLng([lat, lng]);
        } else {
            pino = L.marker([lat, lng], {
                draggable: true,
                keyboard: true,
                title: "Posição da loja (arraste para ajustar)",
                icon: L.divIcon({ className: "mapa-loja-pino", html: "<span></span>", iconSize: [30, 30], iconAnchor: [15, 30] })
            }).addTo(mapa);
            pino.on("dragend", atualizarTexto);
        }
        if (centralizar) mapa.setView([lat, lng], Math.max(mapa.getZoom(), 16));
        atualizarTexto();
    }

    function iniciar() {
        if (typeof window.L === "undefined" || !$("mapaLoja")) {
            if ($("mapaLojaBloco")) {
                $("mapaLojaBloco").querySelector(".mapa-loja-acoes").hidden = true;
                $("mapaLoja").hidden = true;
                mensagem("O mapa não pôde ser carregado agora. A posição já salva da sua loja não será alterada.");
            }
            return;
        }

        mapa = L.map("mapaLoja", { scrollWheelZoom: false }).setView([-14.2, -51.9], 4);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }).addTo(mapa);
        mapa.on("click", (e) => colocarPino(e.latlng.lat, e.latlng.lng, false));
        mapa.on("focus", () => mapa.scrollWheelZoom.enable());
        mapa.on("blur", () => mapa.scrollWheelZoom.disable());

        $("mapaLojaBuscar").addEventListener("click", buscarEndereco);
        $("mapaLojaMinhaPos").addEventListener("click", usarMinhaPosicao);
        $("mapaLojaRemover").addEventListener("click", () => {
            if (pino) { pino.remove(); pino = null; }
            atualizarTexto();
            mensagem("Pino removido. Salve a loja para tirá-la do mapa.");
        });

        // O container pode ter mudado de tamanho depois do layout inicial.
        setTimeout(() => mapa.invalidateSize(), 300);
        window.addEventListener("load", () => mapa.invalidateSize());
        atualizarTexto();
    }

    async function buscarEndereco() {
        const endereco = $("enderecoLoja").value.trim();
        const regiao = $("regiaoLoja").value.trim();
        const texto = endereco || regiao;
        if (texto.length < 5) {
            mensagem("Preencha o campo Endereço (rua, número, bairro, cidade/UF) antes de buscar.");
            $("enderecoLoja").focus();
            return;
        }
        if (Date.now() - ultimaBusca < INTERVALO_NOMINATIM_MS) {
            mensagem("Aguarde um instante antes de buscar de novo.");
            return;
        }
        ultimaBusca = Date.now();

        const botao = $("mapaLojaBuscar");
        botao.disabled = true;
        mensagem("Buscando o endereço no OpenStreetMap...");
        try {
            // Endereços no formato "Rua, nº — bairro, cidade/UF": troca o travessão e a barra por vírgula.
            const consulta = texto.replace(/\s*[—–]\s*/g, ", ").replace(/\//g, ", ");
            const params = new URLSearchParams({
                q: consulta, format: "jsonv2", limit: "1", countrycodes: "br", "accept-language": "pt-BR"
            });
            const resp = await fetch(NOMINATIM_URL + "?" + params.toString(), { headers: { Accept: "application/json" } });
            if (!resp.ok) throw new Error("HTTP " + resp.status);
            const dados = await resp.json();
            if (!dados.length) {
                mensagem("Endereço não encontrado. Clique no mapa para marcar a posição manualmente.");
                return;
            }
            colocarPino(Number(dados[0].lat), Number(dados[0].lon), true);
            mensagem("Endereço encontrado. Confira o pino e arraste se precisar ajustar.");
        } catch (e) {
            mensagem("A busca de endereço não está disponível agora. Clique no mapa para marcar a posição.");
        } finally {
            botao.disabled = false;
        }
    }

    function usarMinhaPosicao() {
        if (!navigator.geolocation || !window.isSecureContext) {
            mensagem("O navegador só libera a localização em HTTPS (ou localhost). Clique no mapa ou busque o endereço.");
            return;
        }
        const botao = $("mapaLojaMinhaPos");
        botao.disabled = true;
        mensagem("Obtendo sua localização...");
        navigator.geolocation.getCurrentPosition((pos) => {
            botao.disabled = false;
            colocarPino(pos.coords.latitude, pos.coords.longitude, true);
            mensagem("Pino colocado na sua posição atual. Confira se é mesmo a loja.");
        }, () => {
            botao.disabled = false;
            mensagem("Não foi possível obter sua localização. Clique no mapa ou busque o endereço.");
        }, { enableHighAccuracy: true, timeout: 10000 });
    }

    /** Preenche com a posição salva (chamado ao carregar a loja). */
    function definirPosicao(lat, lng) {
        if (!mapa) return;
        if (typeof lat === "number" && typeof lng === "number") {
            colocarPino(lat, lng, true);
        } else if (pino) {
            pino.remove();
            pino = null;
            atualizarTexto();
        }
    }

    /** { latitude, longitude } — ambos null quando não há pino. */
    function obterPosicao() {
        if (!pino) return { latitude: null, longitude: null };
        const p = pino.getLatLng();
        return { latitude: Number(p.lat.toFixed(6)), longitude: Number(p.lng.toFixed(6)) };
    }

    function ativo() {
        return mapa !== null;
    }

    // O <script> fica no fim do <body>, depois do formulário: os elementos já existem.
    iniciar();

    return { definirPosicao, obterPosicao, ativo };
})();

if (typeof window !== "undefined") window.AutoSetupMapaLoja = AutoSetupMapaLoja;
