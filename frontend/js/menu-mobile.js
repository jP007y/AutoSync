/* ============================================================
   AUTOSYNC — MENU MOBILE (hambúrguer)
   ============================================================
   Em cada .site-header que tem um .main-nav, cria o botão
   .menu-toggle (visível só até 900px, ver "MENU MOBILE" no
   style.css). O botão abre/fecha o .main-nav como um painel.
   Fecha ao tocar num link, ao apertar Esc, ao tocar fora do
   cabeçalho e ao voltar para a largura de desktop.
   Não depende de outros scripts; pode ser incluído em qualquer
   página com o cabeçalho padrão.
   ============================================================ */
const AutoSetupMenu = (function () {
    "use strict";

    const LARGURA_DESKTOP = 901;

    function montar(cabecalho, indice) {
        const nav = cabecalho.querySelector(".main-nav");
        const interno = cabecalho.querySelector(".header-inner") || cabecalho;
        if (!nav || cabecalho.querySelector(".menu-toggle")) return;

        if (!nav.id) nav.id = indice ? "menuPrincipal" + indice : "menuPrincipal";

        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "menu-toggle";
        botao.setAttribute("aria-controls", nav.id);
        botao.setAttribute("aria-expanded", "false");
        botao.setAttribute("aria-label", "Abrir menu");
        botao.innerHTML = "<span></span><span></span><span></span>";
        interno.appendChild(botao);

        function abrir() {
            cabecalho.classList.add("menu-aberto");
            botao.setAttribute("aria-expanded", "true");
            botao.setAttribute("aria-label", "Fechar menu");
        }

        function fechar(devolverFoco) {
            if (!cabecalho.classList.contains("menu-aberto")) return;
            cabecalho.classList.remove("menu-aberto");
            botao.setAttribute("aria-expanded", "false");
            botao.setAttribute("aria-label", "Abrir menu");
            if (devolverFoco) botao.focus();
        }

        botao.addEventListener("click", function () {
            if (cabecalho.classList.contains("menu-aberto")) fechar(false);
            else abrir();
        });

        // Tocar num link fecha o menu (inclusive âncoras da mesma página, como #pecas).
        nav.addEventListener("click", function (e) {
            if (e.target.closest("a")) fechar(false);
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") fechar(true);
        });

        // Tocar fora do cabeçalho fecha.
        document.addEventListener("click", function (e) {
            if (!cabecalho.contains(e.target)) fechar(false);
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth >= LARGURA_DESKTOP) fechar(false);
        });
    }

    function iniciar() {
        document.querySelectorAll(".site-header").forEach(montar);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();

    return { iniciar };
})();

if (typeof window !== "undefined") window.AutoSetupMenu = AutoSetupMenu;
