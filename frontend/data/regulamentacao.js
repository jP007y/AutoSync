/* ============================================================
   AUTOSETUP — BASE DE REGULAMENTAÇÃO (CONTRAN / DETRAN / CTB)
   ============================================================

   Este arquivo concentra, em formato estruturado (fácil de o
   motor de regras consultar), os parâmetros técnico-legais que
   hoje regem alterações veiculares no Brasil.

   FONTES DE REFERÊNCIA (para consulta e validação futura):
   - CTB (Lei nº 9.503/1997), art. 98, art. 123 e art. 230
     (incisos VII e XI).
   - Resolução CONTRAN nº 292/2008 (alterações em veículos —
     ainda referenciada para rodas/pneus e vedações do art. 8º).
   - Resolução CONTRAN nº 479/2014 (alterou a 292/2008 para
     permitir e regular o rebaixamento de suspensão).
   - Resolução CONTRAN nº 916/2022 (consolidou/atualizou as
     regras de modificação de veículos, inclusive suspensão,
     em seu art. 8º).
   - Resolução CONAMA nº 252/1999 (limites de ruído/emissões —
     escapamento de reposição não pode gerar ruído acima do
     originalmente declarado pelo fabricante).
   - Portaria DENATRAN nº 38/2018 (Anexo da Resolução CONTRAN
     292/2008 — lista taxativa de modificações permitidas; a
     troca do sistema de escapamento não consta nessa lista).

   AVISO IMPORTANTE:
   Este é um MVP para validar o fluxo do produto. As regras
   abaixo são uma SIMPLIFICAÇÃO das normas reais, pensada para
   ser computável. Antes de usar isso para dar qualquer
   orientação real a um usuário final, um responsável técnico/
   jurídico deve revisar e manter este arquivo atualizado, pois
   resoluções do CONTRAN são substituídas com frequência.
   ============================================================ */

const AUTOSETUP_REGULAMENTACAO = {

    suspensao: {
        baseLegal: "Resolução CONTRAN nº 916/2022, art. 8º (que herda os parâmetros da Res. 479/2014)",
        regras: {
            // válido para veículos com PBT até 3.500 kg (caso da maioria dos automóveis de passeio)
            alturaMinimaSoloMm_PBTAte3500: 100,
            proibidoContatoRodaCarroceriaAoEsterçar: true
        },
        exigenciasParaRegularizar: [
            "Autorização prévia do órgão de trânsito (art. 98 do CTB)",
            "Inspeção de segurança veicular e emissão do CSV por instituição credenciada (Inmetro)",
            "Emissão de novo CRLV-e com a alteração registrada em campo específico"
        ],
        descricaoResumo: "Rebaixar ou elevar a suspensão é permitido, mas exige altura mínima de 100 mm do solo (PBT até 3.500 kg) e CSV/CRLV atualizados."
    },

    rodasPneus: {
        baseLegal: "Resolução CONTRAN nº 292/2008, art. 8º, incisos I e II",
        regras: {
            proibidoUltrapassarLimiteExternoParaLama: true,
            proibidoAlterarDiametroExternoConjunto: true,
            // tolerância prática comumente aceita em vistorias para pequenas variações
            // de diâmetro externo ao trocar aro/perfil do pneu (não é um número da lei,
            // é uma margem de engenharia/mercado usada como sinal de alerta no MVP)
            toleranciaVariacaoDiametroPercentual: 3
        },
        exigenciasParaRegularizar: [
            "Conjunto roda+pneu não pode ultrapassar os para-lamas",
            "Diâmetro externo do conjunto deve permanecer equivalente ao original"
        ],
        descricaoResumo: "É proibido alterar o diâmetro externo do conjunto roda+pneu ou ultrapassar os para-lamas."
    },

    escapamento: {
        baseLegal: "CTB art. 230, incisos VII e XI; Portaria DENATRAN 38/2018 (Anexo da Res. CONTRAN 292/08); Resolução CONAMA 252/1999",
        regras: {
            // A troca do sistema de escapamento não consta na lista taxativa de
            // modificações permitidas — por isso é tratada como não regularizável
            // por padrão nesta base, mesmo que o veículo passe na medição de ruído.
            modificacaoConstaListaPermitida: false,
            ruidoNaoPodeSuperarOriginalDeFabrica: true
        },
        exigenciasParaRegularizar: [
            "Manter nível de ruído igual ou inferior ao declarado de fábrica (Res. CONAMA 252/99)",
            "Não descaracterizar a função de filtragem/silenciamento do sistema original"
        ],
        descricaoResumo: "Troca de escapamento não está na lista de modificações permitidas e pode configurar infração grave (CTB art. 230, XI) se o ruído superar o original."
    },

    freios: {
        baseLegal: "Resolução CONTRAN nº 916/2022 (exige CSV para alterações que afetem sistemas de segurança)",
        regras: {
            exigeCSVParaAlteracao: true
        },
        exigenciasParaRegularizar: [
            "Certificado de Segurança Veicular (CSV) para qualquer alteração no sistema de freios"
        ],
        descricaoResumo: "Alterações no sistema de freios exigem CSV por afetarem diretamente a segurança veicular."
    },

    eletrica: {
        baseLegal: "Resolução CONTRAN nº 227/2007 (uso de luzes) e CTB art. 230",
        regras: {
            faroisDevemManterHomologacaoInmetro: true
        },
        exigenciasParaRegularizar: [
            "Componentes elétricos/de iluminação devem ser homologados pelo Inmetro"
        ],
        descricaoResumo: "Alterações elétricas (faróis, iluminação) exigem componentes homologados pelo Inmetro."
    },

    motor: {
        baseLegal: "CTB art. 123, III; exige novo CRV/CAT quando altera código marca/modelo/versão",
        regras: {
            exigeNovoCodigoMarcaModeloVersao: true
        },
        exigenciasParaRegularizar: [
            "Novo código de marca/modelo/versão e CAT junto ao órgão máximo de trânsito",
            "Inspeção de segurança veicular e novo CRLV-e"
        ],
        descricaoResumo: "Alterações de motor mudam a caracterização do veículo e exigem novo código marca/modelo/versão."
    }
};

if (typeof window !== "undefined") {
    window.AUTOSETUP_REGULAMENTACAO = AUTOSETUP_REGULAMENTACAO;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = AUTOSETUP_REGULAMENTACAO;
}