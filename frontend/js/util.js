/* ============================================================
   AUTOSYNC — utilidades compartilhadas (escape de HTML, imagens
   com fallback, rótulos de categoria)
   ============================================================ */
const AutoSyncUtil = (function () {

    const CATEGORIAS = {
        suspensao: "Suspensão",
        motor: "Motor",
        rodasPneus: "Rodas e pneus",
        escapamento: "Escape",
        freios: "Freios",
        eletrica: "Elétrica",
    };

    /** Tipos de serviço da loja (campo tipos_servico; mesmas chaves de TIPOS_SERVICO no backend). */
    const TIPOS_SERVICO = {
        tuning: "Tuning",
        vistoria: "Vistoria",
        estetico: "Reparos estéticos",
        martelinho: "Martelinho de ouro",
        funilaria: "Funilaria e pintura",
        preventiva: "Manutenção preventiva",
        gas: "Fiscalização de gás (GNV)",
        pequenos: "Pequenos reparos",
    };

    /** Escapa texto digitado por usuários antes de colocá-lo em innerHTML. */
    function esc(texto) {
        return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function categoriaLabel(chave) {
        return CATEGORIAS[chave] || chave;
    }

    /**
     * Monta uma <img> que tenta primeiro uma FOTO REAL (.jpg) com o mesmo
     * nome da ilustração e, se ela não existir, cai na ilustração (.svg).
     * Assim, para trocar por fotos de verdade basta colocar o arquivo .jpg
     * ao lado do .svg, sem mexer em código nem no banco.
     * Imagens enviadas pelo prestador (data:) e URLs http(s) são usadas como estão.
     */
    function imgTag(origem, alt, classe) {
        if (!origem) return "";
        const cls = classe ? ` class="${esc(classe)}"` : "";
        if (/^(data:|https?:)/i.test(origem)) {
            return `<img${cls} src="${esc(origem)}" alt="${esc(alt)}" loading="lazy">`;
        }
        const base = origem.replace(/\.(svg|jpg|jpeg|png|webp)$/i, "");
        return `<img${cls} src="${esc(base)}.jpg" alt="${esc(alt)}" loading="lazy" ` +
               `onerror="this.onerror=null;this.src='${esc(base)}.svg'">`;
    }

    function formatarData(iso) {
        if (!iso) return "";
        return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    }

    return { CATEGORIAS, TIPOS_SERVICO, esc, categoriaLabel, imgTag, formatarData };
})();

if (typeof window !== "undefined") window.AutoSyncUtil = AutoSyncUtil;
