/* ============================================================
   AUTOSYNC — PEÇAS DE EXEMPLO (modo offline)
   ============================================================

   Usado SOMENTE quando o backend não responde (ex.: site aberto
   pelo GitHub Pages). A interface mostra estes dados com o aviso
   "dados de exemplo": não são lojas, ofertas nem preços reais.

   Os nomes das peças espelham o catálogo do backend
   (backend/services/compatibility.py). Os prestadores são
   genéricos ("Prestador exemplo") e não têm contato.
   ============================================================ */

window.AUTOSETUP_PECAS_EXEMPLO = (function () {

    const CATALOGO = {
        suspensao: [
            ["kit_coilover", "Kit coilover regulável", "peca", "Suspensão", "Altura final do solo de no mínimo 100 mm (Res. CONTRAN 916/2022)"],
            ["molas_esportivas", "Molas esportivas", "peca", "Suspensão", "Altura final do solo de no mínimo 100 mm"],
            ["amortecedores", "Amortecedores compatíveis com a nova altura", "peca", "Suspensão", "Altura final do solo de no mínimo 100 mm"],
            ["alinhamento_3d", "Alinhamento 3D e balanceamento", "servico", "Geometria", "Obrigatório logo após alterar a altura"],
        ],
        rodasPneus: [
            ["rodas", "Rodas", "peca", "Rodas/Pneus", "Conjunto roda+pneu com diâmetro externo equivalente ao original (±3%)"],
            ["pneus", "Pneus de medida equivalente", "peca", "Rodas/Pneus", "Diâmetro externo dentro de ±3% do original (Res. CONTRAN 292/2008)"],
            ["montagem_balanceamento", "Montagem e balanceamento", "servico", "Suspensão/Freios", "Conferir folga com para-lamas e pinças de freio"],
        ],
        escapamento: [
            ["silencioso_esportivo", "Silencioso / ponteira esportiva", "peca", "Escapamento", "Ruído não pode superar o original de fábrica (CONAMA 252/1999)"],
            ["medicao_ruido", "Medição de ruído (decibelímetro)", "servico", "Ruído/Emissões", "Comprova que o ruído não superou o original"],
        ],
        freios: [
            ["discos_pastilhas", "Discos e pastilhas de maior desempenho", "peca", "Freios", "Alteração no sistema de freios exige CSV"],
            ["fluido_dot4", "Fluido de freio DOT 4", "peca", "Freios", "Troca completa do fluido junto com o upgrade"],
            ["laudo_csv", "Inspeção e CSV", "servico", "Documentação", "Certificado de Segurança Veicular em instituição credenciada"],
        ],
        motor: [
            ["remap_ecu", "Remapeamento de ECU", "servico", "Motor", "Alteração de potência exige regularização (CTB art. 123)"],
            ["filtro_esportivo", "Filtro de ar esportivo", "peca", "Motor", "Alteração de potência exige regularização (CTB art. 123)"],
        ],
        eletrica: [
            ["farois_led", "Lâmpadas / faróis LED homologados", "peca", "Elétrica", "Cor e intensidade dentro da Res. CONTRAN 227/2007"],
            ["instalacao_eletrica", "Instalação elétrica e regulagem de faróis", "servico", "Elétrica", "Regulagem de facho após a troca"],
        ],
    };

    /** Mesmo formato de GET /pecas/recomendadas (campo `pecas`). */
    function pecasPara(categorias) {
        const lista = categorias && categorias.length ? categorias : Object.keys(CATALOGO);
        const pecas = [];
        lista.forEach(function (categoria) {
            (CATALOGO[categoria] || []).forEach(function (p) {
                pecas.push({
                    chave: p[0], nome: p[1], tipo: p[2], categoria: categoria, atende: p[3], especificacao: p[4],
                    anuncios: [{
                        id: "exemplo-" + p[0],
                        tipo: p[2] === "servico" ? "instalacao" : "venda_instalacao",
                        titulo: p[1] + " (exemplo)",
                        descricao: "Anúncio ilustrativo para demonstrar como a peça aparece no marketplace.",
                        faixaPreco: null,
                        exemplo: true,
                        compativelComVeiculo: false,
                        veiculosCompativeis: [],
                        loja: { id: null, nome: "Prestador exemplo", regiao: "Região de exemplo", contato: null },
                    }],
                    lojasDaCategoria: [],
                });
            });
        });
        return pecas;
    }

    return { CATALOGO, pecasPara };
})();
