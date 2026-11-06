/* ============================================================
   AUTOSETUP — COMUNICAÇÃO FRONTEND ↔ BACKEND
   ============================================================

   Agora este arquivo faz de verdade o que os comentários antigos
   diziam que faria "no futuro": chamadas HTTP para a API Python
   (backend/api/main.py).

   IMPORTANTE:
   - A API precisa estar rodando localmente antes de abrir a
     página (veja backend/README ou os comandos que já usamos:
     `uvicorn api.main:app --reload --port 8000` dentro de
     backend/).
   - Por enquanto só existe leitura (GET) de veículos. Endpoints
     de avaliação de modificação (cascata/risco/legalidade) ainda
     rodam no frontend (js/rules-engine.js) — a migração deles
     para o backend (services/cascade.py, services/legality.py)
     é o próximo passo combinado.
   ============================================================ */

const AutoSetupApi = (function () {

    // Se um dia isso for pra produção, troque por uma URL fixa
    // do servidor (ex: "https://api.seudominio.com").
    // O endereço da API é descoberto a partir de onde a página foi aberta,
    // para funcionar também no celular (via QR Code, pelo IP do computador):
    //  - aberto pelo próprio backend (porta 8000, /site/...): mesma origem
    //  - aberto por outro servidor (ex: porta 5500): mesmo host, porta 8000
    //  - aberto direto do disco (file://): localhost:8000
    const BASE_URL = (function () {
        const loc = window.location;
        if (loc.protocol === "file:") return "http://localhost:8000";
        if (loc.port === "8000" || loc.pathname.indexOf("/site/") === 0) return loc.origin;
        return loc.protocol + "//" + loc.hostname + ":8000";
    })();

    /**
     * Busca a ficha técnica de um veículo pelo id.
     * Lança um erro com mensagem amigável se a API não responder
     * (por exemplo, se o backend não estiver rodando).
     */
    async function buscarVeiculo(id) {
        let resposta;

        try {
            resposta = await fetch(`${BASE_URL}/veiculos/${id}`);
        } catch (erroDeRede) {
            throw new Error(
                "Não foi possível conectar à API do AutoSync. " +
                "Verifique se o backend está rodando em " + BASE_URL + "."
            );
        }

        if (resposta.status === 404) {
            throw new Error(`Veículo com id ${id} não encontrado no banco de dados.`);
        }

        if (!resposta.ok) {
            throw new Error(`Erro ao buscar veículo (HTTP ${resposta.status}).`);
        }

        return resposta.json();
    }

    /**
     * Lista todos os veículos cadastrados. Usado, por exemplo,
     * para popular um seletor de "Alterar veículo" no futuro.
     */
    async function listarVeiculos() {
        let resposta;

        try {
            resposta = await fetch(`${BASE_URL}/veiculos`);
        } catch (erroDeRede) {
            throw new Error(
                "Não foi possível conectar à API do AutoSync. " +
                "Verifique se o backend está rodando em " + BASE_URL + "."
            );
        }

        if (!resposta.ok) {
            throw new Error(`Erro ao listar veículos (HTTP ${resposta.status}).`);
        }

        return resposta.json();
    }

    /**
     * Lista lojas/parceiros recomendados, opcionalmente filtrando
     * por categoria de modificação e/ou região.
     *
     * @param {Object} filtros
     * @param {string} [filtros.categoria] - ex: "suspensao"
     * @param {string} [filtros.regiao] - ex: "São Paulo"
     */
    async function buscarLojas(filtros = {}) {
        const params = new URLSearchParams();
        if (filtros.categoria) params.set("categoria", filtros.categoria);
        if (filtros.regiao) params.set("regiao", filtros.regiao);

        const query = params.toString() ? `?${params.toString()}` : "";

        let resposta;
        try {
            resposta = await fetch(`${BASE_URL}/lojas${query}`);
        } catch (erroDeRede) {
            throw new Error(
                "Não foi possível conectar à API do AutoSync. " +
                "Verifique se o backend está rodando em " + BASE_URL + "."
            );
        }

        if (!resposta.ok) {
            throw new Error(`Erro ao buscar lojas (HTTP ${resposta.status}).`);
        }

        return resposta.json();
    }

    /**
     * Busca a loja cadastrada por um prestador (lança erro se
     * ele ainda não tiver cadastrado nenhuma — HTTP 404).
     */
    async function obterLojaDoPrestador(prestadorId) {
        const resposta = await fetch(`${BASE_URL}/prestadores/${prestadorId}/loja`);
        if (resposta.status === 404) return null;
        if (!resposta.ok) throw new Error(`Erro ao buscar loja (HTTP ${resposta.status}).`);
        return resposta.json();
    }

    /**
     * Cria ou atualiza a loja de um prestador (o backend decide
     * qual dos dois, já que cada prestador tem no máximo 1 loja).
     */
    async function salvarLojaDoPrestador(prestadorId, dadosLoja) {
        const resposta = await fetch(`${BASE_URL}/prestadores/${prestadorId}/loja`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dadosLoja),
        });
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(corpo.detail || "Não foi possível salvar a loja.");
        return corpo;
    }

    /** Busca as métricas (total de acessos) do prestador. */
    async function obterEstatisticasPrestador(prestadorId) {
        const resposta = await fetch(`${BASE_URL}/prestadores/${prestadorId}/estatisticas`);
        if (!resposta.ok) throw new Error(`Erro ao buscar estatísticas (HTTP ${resposta.status}).`);
        return resposta.json();
    }

    /**
     * Registra 1 acesso a uma loja. Chamado pelo frontend do
     * consumidor sempre que uma loja aparece na recomendação.
     * Falha silenciosa: se der erro, não deve travar a navegação
     * do consumidor por causa de uma métrica.
     */
    async function registrarAcessoLoja(lojaId) {
        try {
            await fetch(`${BASE_URL}/lojas/${lojaId}/acesso`, { method: "POST" });
        } catch (e) {
            console.warn("Não foi possível registrar acesso à loja", lojaId, e.message);
        }
    }

    /**
     * Perfil público completo de uma loja (usado na página de
     * portfólio perfil-loja.html). Diferente de buscarLojas, que
     * é uma lista filtrada — este busca uma loja específica.
     */
    async function obterLojaPublica(lojaId) {
        const resposta = await fetch(`${BASE_URL}/lojas/${lojaId}`);
        if (resposta.status === 404) return null;
        if (!resposta.ok) throw new Error(`Erro ao buscar loja (HTTP ${resposta.status}).`);
        return resposta.json();
    }

    /** Lista as publicações (posts do portfólio) de uma loja. */
    async function listarPublicacoes(lojaId) {
        const resposta = await fetch(`${BASE_URL}/lojas/${lojaId}/publicacoes`);
        if (!resposta.ok) throw new Error(`Erro ao buscar publicações (HTTP ${resposta.status}).`);
        return resposta.json();
    }

    /** Cria uma nova publicação na loja do prestador logado. */
    async function criarPublicacao(prestadorId, dadosPublicacao) {
        const resposta = await fetch(`${BASE_URL}/prestadores/${prestadorId}/publicacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dadosPublicacao),
        });
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(corpo.detail || "Não foi possível criar a publicação.");
        return corpo;
    }

    /** Exclui uma publicação do prestador logado. */
    async function excluirPublicacao(prestadorId, publicacaoId) {
        const resposta = await fetch(
            `${BASE_URL}/prestadores/${prestadorId}/publicacoes/${publicacaoId}`,
            { method: "DELETE" }
        );
        if (!resposta.ok) throw new Error(`Erro ao excluir publicação (HTTP ${resposta.status}).`);
        return resposta.json();
    }

    /** Lista todas as lojas (sem filtro) — usada pelo diretório de oficinas. */
    async function listarLojas() {
        return buscarLojas({});
    }

    /** IPs de rede do computador que roda o backend (para o QR Code). */
    async function obterRede() {
        const resposta = await fetch(`${BASE_URL}/rede`);
        if (!resposta.ok) throw new Error(`Erro ao consultar a rede (HTTP ${resposta.status}).`);
        return resposta.json();
    }

    return {
        listarLojas,
        obterRede,
        buscarVeiculo,
        listarVeiculos,
        buscarLojas,
        obterLojaDoPrestador,
        salvarLojaDoPrestador,
        obterEstatisticasPrestador,
        registrarAcessoLoja,
        obterLojaPublica,
        listarPublicacoes,
        criarPublicacao,
        excluirPublicacao,
        BASE_URL,
    };

})();

if (typeof window !== "undefined") {
    window.AutoSetupApi = AutoSetupApi;
}