/* ============================================================
   AUTOSETUP — AUTENTICAÇÃO (frontend)
   ============================================================

   Guarda a "sessão" do usuário no localStorage do navegador.

   IMPORTANTE (limite consciente deste MVP):
   Isso NÃO é uma sessão segura de verdade — não há token,
   não expira, e qualquer pessoa com acesso ao navegador pode
   ver/editar o localStorage. Para o MVP local, isso é
   suficiente para validar o fluxo de "dois tipos de usuário,
   duas páginas". Antes de ir para produção, isso precisa virar
   autenticação por token (JWT) com expiração.
   ============================================================ */

const AutoSetupAuth = (function () {

    const CHAVE_SESSAO = "autosetup_usuario";

    function salvarSessao(usuario) {
        localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario));
    }

    function obterUsuarioLogado() {
        const bruto = localStorage.getItem(CHAVE_SESSAO);
        if (!bruto) return null;
        try {
            return JSON.parse(bruto);
        } catch (e) {
            return null;
        }
    }

    function sair() {
        localStorage.removeItem(CHAVE_SESSAO);
    }

    async function registrar({ nome, email, senha, tipo }) {
        const resposta = await fetch(`${AutoSetupApi.BASE_URL}/auth/registrar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, senha, tipo }),
        });

        const corpo = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(corpo.detail || "Não foi possível criar a conta.");
        }

        salvarSessao(corpo);
        return corpo;
    }

    async function login({ email, senha }) {
        const resposta = await fetch(`${AutoSetupApi.BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha }),
        });

        const corpo = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(corpo.detail || "Não foi possível entrar.");
        }

        salvarSessao(corpo);
        return corpo;
    }

    /**
     * Protege uma página: se não houver usuário logado (ou o
     * tipo não bater com o esperado), redireciona para o login.
     * Use no topo de index.html / painel-prestador.html.
     */
    function exigirLogin(tipoEsperado) {
        const usuario = obterUsuarioLogado();

        if (!usuario) {
            window.location.href = "login.html";
            return null;
        }

        if (tipoEsperado && usuario.tipo !== tipoEsperado) {
            // Usuário logado, mas na página errada para o tipo dele
            // (ex: consumidor tentando abrir o painel do prestador).
            window.location.href = usuario.tipo === "prestador"
                ? "painel-prestador.html"
                : "index.html";
            return null;
        }

        return usuario;
    }

    return { registrar, login, sair, obterUsuarioLogado, exigirLogin };

})();

if (typeof window !== "undefined") {
    window.AutoSetupAuth = AutoSetupAuth;
}