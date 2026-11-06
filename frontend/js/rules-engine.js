/* ============================================================
   AUTOSETUP — MOTOR DE REGRAS (MVP)
   ============================================================

   Responsabilidade única deste arquivo:
   dado (1) a ficha técnica de um veículo, (2) um tipo de
   modificação e (3) os novos parâmetros propostos pelo usuário,
   calcular:

     - cascata: cadeia de sistemas afetados
     - consequencias: efeitos práticos esperados
     - risco: status de segurança (controlado/atencao/critico)
     - legalidade: status legal (regular/irregular) com base em
       AUTOSETUP_REGULAMENTACAO
     - score: nota geral + barras (Segurança/Desempenho/Manutenção)

   Este motor é 100% baseado em regras determinísticas (sem
   chamada a IA/API). Isso é intencional para o MVP: permite
   testar e validar o fluxo do produto de forma rápida,
   previsível e sem custo de API. A troca por uma avaliação via
   modelo de linguagem (usando o system_prompt.txt já existente)
   pode ser feita depois, mantendo o mesmo formato de saída.

   Depende de (devem ser carregados ANTES deste arquivo):
     - data/veiculos.js         -> window.AUTOSETUP_VEICULOS
     - data/regulamentacao.js   -> window.AUTOSETUP_REGULAMENTACAO
   ============================================================ */

const AutoSetupEngine = (function () {

    const REGRAS = (typeof window !== "undefined")
        ? window.AUTOSETUP_REGULAMENTACAO
        : require("../data/regulamentacao.js");

    /* --------------------------------------------------------
       Helpers de score
       -------------------------------------------------------- */

    function clamp(valor, min, max) {
        return Math.max(min, Math.min(max, valor));
    }

    function montarScore(seguranca, desempenho, manutencao, descricao) {
        const total = Math.round((seguranca + desempenho + manutencao) / 3);
        return {
            total,
            descricao,
            bars: [
                { label: "Segurança", value: clamp(seguranca, 0, 100) },
                { label: "Desempenho", value: clamp(desempenho, 0, 100) },
                { label: "Manutenção", value: clamp(manutencao, 0, 100) }
            ]
        };
    }

    /* --------------------------------------------------------
       Avaliação: SUSPENSÃO
       -------------------------------------------------------- */

    function avaliarSuspensao(veiculo, params) {
        const regra = REGRAS.suspensao;
        const alturaOriginal = veiculo.suspensao.alturaLivreSoloOriginalMm;
        const novaAltura = Number(params.novaAlturaSoloMm);
        const alturaMinima = regra.regras.alturaMinimaSoloMm_PBTAte3500;

        const rebaixamentoMm = alturaOriginal - novaAltura;
        const abaixoDoMinimo = novaAltura < alturaMinima;

        const cascata = [
            { componente: "Suspensão", detalhe: `Altura livre do solo alterada de ${alturaOriginal}mm para ${novaAltura}mm` },
            { componente: "Geometria", detalhe: "Ângulos de câmber e convergência tendem a mudar com o rebaixamento" },
            { componente: "Pneus", detalhe: "Tendência de desgaste irregular nas bordas do pneu" },
            { componente: "Manutenção", detalhe: "Alinhamento e balanceamento passam a ser necessários com mais frequência" }
        ];

        const consequencias = [
            { titulo: "Desgaste dos pneus", impacto: rebaixamentoMm > 30 ? "Alto" : "Moderado", descricao: "Alteração de geometria aumenta o desgaste irregular dos pneus." },
            { titulo: "Alinhamento", impacto: "Necessário", descricao: "Recomenda-se alinhamento e balanceamento logo após a instalação." },
            { titulo: "Atrito em manobras", impacto: abaixoDoMinimo ? "Alto" : "Baixo", descricao: abaixoDoMinimo ? "Risco de contato entre pneu/roda e carroceria ao esterçar." : "Folga dentro do esperado ao esterçar o volante." }
        ];

        const risco = abaixoDoMinimo
            ? { status: "critico", titulo: "Altura abaixo do limite legal", descricao: `Com ${novaAltura}mm, o veículo fica abaixo dos ${alturaMinima}mm mínimos exigidos.` }
            : (rebaixamentoMm > 30
                ? { status: "atencao", titulo: "Rebaixamento acentuado", descricao: "Dentro do limite legal, mas exige atenção redobrada ao alinhamento e ao piso." }
                : { status: "controlado", titulo: "Risco controlado", descricao: "Alteração dentro dos parâmetros esperados de segurança." });

        const legalidade = abaixoDoMinimo
            ? { status: "irregular", titulo: "Abaixo da altura mínima", descricao: `${regra.baseLegal} exige no mínimo ${alturaMinima}mm para o PBT deste veículo.` }
            : { status: "regular", titulo: "Dentro do limite legal", descricao: `Atende ${regra.baseLegal}, desde que emitido o CSV e atualizado o CRLV-e.` };

        const scoreSeguranca = abaixoDoMinimo ? 25 : clamp(95 - rebaixamentoMm, 40, 95);
        const scoreDesempenho = clamp(70 + rebaixamentoMm * 0.5, 60, 92);
        const scoreManutencao = clamp(90 - rebaixamentoMm * 0.8, 40, 90);

        return {
            cascata,
            consequencias,
            risco,
            legalidade,
            score: montarScore(scoreSeguranca, scoreDesempenho, scoreManutencao,
                abaixoDoMinimo
                    ? "Configuração fora do limite legal de altura mínima do solo."
                    : "Configuração dentro do limite legal, com impacto moderado em manutenção.")
        };
    }

    /* --------------------------------------------------------
       Avaliação: RODAS E PNEUS
       -------------------------------------------------------- */

    function avaliarRodasPneus(veiculo, params) {
        const regra = REGRAS.rodasPneus;
        const diametroOriginal = veiculo.rodasPneus.diametroExternoOriginalMm;
        const novoDiametro = Number(params.novoDiametroExternoMm);

        const diffPercentual = Math.abs((novoDiametro - diametroOriginal) / diametroOriginal) * 100;
        const dentroDaTolerancia = diffPercentual <= regra.regras.toleranciaVariacaoDiametroPercentual;

        const cascata = [
            { componente: "Rodas/Pneus", detalhe: `Diâmetro externo do conjunto alterado de ${diametroOriginal}mm para ${novoDiametro}mm` },
            { componente: "Velocímetro/Odômetro", detalhe: "Leitura de velocidade e quilometragem passa a ter um pequeno desvio" },
            { componente: "Suspensão/Freios", detalhe: "Folga com para-lamas e pinças de freio deve ser conferida" },
            { componente: "Manutenção", detalhe: "Calibragem e monitoramento de desgaste tornam-se mais importantes" }
        ];

        const consequencias = [
            { titulo: "Precisão do velocímetro", impacto: dentroDaTolerancia ? "Baixo" : "Alto", descricao: "Diâmetro diferente do original desvia a leitura de velocidade real." },
            { titulo: "Contato com carroceria", impacto: dentroDaTolerancia ? "Baixo" : "Alto", descricao: "Conjunto maior pode tocar para-lamas ou partes da suspensão." },
            { titulo: "Conforto e resposta", impacto: "Moderado", descricao: "Perfil de pneu diferente muda absorção de impacto e resposta de direção." }
        ];

        const risco = dentroDaTolerancia
            ? { status: "controlado", titulo: "Risco controlado", descricao: "Variação de diâmetro dentro de margem segura de folga." }
            : { status: "atencao", titulo: "Variação de diâmetro relevante", descricao: `Diferença de ${diffPercentual.toFixed(1)}% em relação ao conjunto original.` };

        const legalidade = dentroDaTolerancia
            ? { status: "regular", titulo: "Dentro da equivalência exigida", descricao: `Atende ${regra.baseLegal} (diâmetro externo equivalente ao original).` }
            : { status: "irregular", titulo: "Diâmetro externo alterado", descricao: `${regra.baseLegal} proíbe aumentar ou diminuir o diâmetro externo do conjunto.` };

        const scoreSeguranca = dentroDaTolerancia ? 88 : clamp(88 - diffPercentual * 3, 30, 88);
        const scoreDesempenho = clamp(75 + (novoDiametro - diametroOriginal) * 0.1, 55, 90);
        const scoreManutencao = dentroDaTolerancia ? 82 : clamp(82 - diffPercentual * 2, 40, 82);

        return {
            cascata,
            consequencias,
            risco,
            legalidade,
            score: montarScore(scoreSeguranca, scoreDesempenho, scoreManutencao,
                dentroDaTolerancia
                    ? "Conjunto roda+pneu dentro da equivalência legal exigida."
                    : "Conjunto roda+pneu fora da equivalência legal, revisão recomendada.")
        };
    }

    /* --------------------------------------------------------
       Avaliação: ESCAPAMENTO
       -------------------------------------------------------- */

    function avaliarEscapamento(veiculo, params) {
        const regra = REGRAS.escapamento;
        const diametroOriginal = veiculo.escapamento.diametroSaidaOriginalMm;
        const novoDiametro = Number(params.novoDiametroMm);
        const aumentoPercentual = ((novoDiametro - diametroOriginal) / diametroOriginal) * 100;
        const superdimensionado = aumentoPercentual > 40; // motor pequeno não aproveita saltos grandes de diâmetro

        const cascata = [
            { componente: "Escapamento", detalhe: `Diâmetro de saída alterado de ${diametroOriginal}mm para ${novoDiametro}mm` },
            { componente: "Contrapressão", detalhe: superdimensionado ? "Queda acentuada de contrapressão em baixas/médias rotações" : "Variação leve de contrapressão" },
            { componente: "Motor", detalhe: superdimensionado ? "Tendência de perda de torque em baixa rotação" : "Impacto de torque pouco perceptível" },
            { componente: "Ruído/Emissões", detalhe: "Nível sonoro tende a aumentar em relação ao sistema original" }
        ];

        const consequencias = [
            { titulo: "Torque em baixa rotação", impacto: superdimensionado ? "Perda perceptível" : "Impacto leve", descricao: "Diâmetro maior que o necessário reduz eficiência em baixas rotações." },
            { titulo: "Ruído", impacto: "Aumento esperado", descricao: "Sistemas de reposição tendem a ser mais ruidosos que o original de fábrica." },
            { titulo: "Regularização", impacto: "Não prevista", descricao: "Troca de escapamento não consta na lista de modificações permitidas para registro." }
        ];

        const risco = superdimensionado
            ? { status: "atencao", titulo: "Diâmetro superdimensionado", descricao: "Motor deste porte não aproveita esse diâmetro; pode piorar resposta em baixa." }
            : { status: "controlado", titulo: "Risco controlado", descricao: "Alteração dentro de uma faixa que preserva boa parte da eficiência original." };

        // Por regra desta base (ver regulamentacao.js), troca de escapamento
        // não consta na lista taxativa de modificações permitidas — por isso
        // é tratada como irregular independentemente do diâmetro escolhido.
        const legalidade = {
            status: "irregular",
            titulo: "Modificação fora da lista permitida",
            descricao: `${regra.baseLegal}: risco de infração grave se o ruído superar o original de fábrica.`
        };

        const scoreSeguranca = 60; // não é o item de maior risco de segurança, mas há infração
        const scoreDesempenho = superdimensionado ? 45 : 68;
        const scoreManutencao = 70;

        return {
            cascata,
            consequencias,
            risco,
            legalidade,
            score: montarScore(scoreSeguranca, scoreDesempenho, scoreManutencao,
                "Modificação não prevista na lista de alterações permitidas para registro do veículo.")
        };
    }

    /* --------------------------------------------------------
       Avaliação genérica (categorias ainda não modeladas no MVP)
       -------------------------------------------------------- */

    function avaliarGenerico(veiculo, tipo, params) {
        const regra = REGRAS[tipo];

        const cascata = [
            { componente: "Sistema alterado", detalhe: `Modificação de "${tipo}" ainda não possui modelo de cascata detalhado neste MVP` },
            { componente: "Documentação", detalhe: "Consulte as exigências legais gerais listadas abaixo" }
        ];

        const consequencias = [
            { titulo: "Análise limitada", impacto: "Indisponível", descricao: "Este tipo de modificação ainda não tem cálculo de cascata neste MVP." }
        ];

        return {
            cascata,
            consequencias,
            risco: { status: "atencao", titulo: "Análise não modelada", descricao: "Avalie com um profissional especializado antes de prosseguir." },
            legalidade: regra
                ? { status: "atencao", titulo: "Verificar exigências", descricao: regra.descricaoResumo }
                : { status: "atencao", titulo: "Sem regra cadastrada", descricao: "Nenhuma regra específica cadastrada para esta categoria ainda." },
            score: montarScore(60, 60, 60, "Categoria ainda não modelada neste MVP — estimativa neutra.")
        };
    }

    /* --------------------------------------------------------
       API pública do motor
       -------------------------------------------------------- */

    function avaliarModificacao(veiculo, tipo, params) {
        switch (tipo) {
            case "suspensao":
                return avaliarSuspensao(veiculo, params);
            case "rodasPneus":
                return avaliarRodasPneus(veiculo, params);
            case "escapamento":
                return avaliarEscapamento(veiculo, params);
            default:
                return avaliarGenerico(veiculo, tipo, params);
        }
    }

    return { avaliarModificacao };

})();

if (typeof window !== "undefined") {
    window.AutoSetupEngine = AutoSetupEngine;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = AutoSetupEngine;
}