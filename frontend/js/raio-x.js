/* AUTOSYNC — página Raio-X 3D (interface). Aceita ?peca=suspensao */
(function () {
    "use strict";
    const usuario = window.AutoSetupAuth ? AutoSetupAuth.exigirLogin("consumidor") : null;
    if (!usuario) return;

    const $ = id => document.getElementById(id);
    const btnPerfil = $("profileButton");
    btnPerfil.textContent = usuario.nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
    btnPerfil.addEventListener("click", function () {
        if (confirm("Sair da conta de " + usuario.nome + "?")) {
            AutoSetupAuth.sair();
            window.location.href = "login.html";
        }
    });

    const stage = $("rxStage"), infoEl = $("rxInfo"), listEl = $("rxParts");
    const pin = $("rxPin"), pinTag = $("rxPinTag"), tip = $("rxTip");
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    if (!window.THREE || !window.THREE.OrbitControls) { $("rxError").classList.add("is-on"); return; }

    const R = window.AutoSyncRaioX;
    let rx = null;

    function renderInfo(id) {
        if (!id) {
            infoEl.innerHTML =
                '<span class="section-label">COMO USAR</span><h2>Explore o carro por dentro</h2>' +
                "<p>Clique numa peça no modelo ou na lista para ver o sistema e a linha de reposição. Arraste para girar, role ou pince para aproximar.</p>" +
                '<div class="rx-nav"><span>' + R.ORDER.length + ' sistemas</span><button id="rxNext" type="button">Iniciar tour →</button></div>';
        } else {
            const p = R.BYID[id], i = R.ORDER.indexOf(id);
            const simular = p.mod ? '<a class="primary-button" href="index.html?mod=' + encodeURIComponent(p.mod) + '">Simular modificação neste sistema</a>' : "";
            infoEl.innerHTML =
                '<span class="section-label">' + esc(p.cat) + "</span><h2>" + esc(p.nome) + "</h2><p>" + esc(p.desc) + "</p>" +
                '<div class="rx-label">Linha de reposição</div><ul class="rx-items">' + p.itens.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul>" +
                '<div class="rx-actions">' + simular + '<a class="secondary-button" href="index.html#pecas">Ver peças compatíveis</a></div>' +
                '<div class="rx-nav"><button id="rxPrev" type="button">← Anterior</button><span>' + (i + 1) + " / " + R.ORDER.length + '</span><button id="rxNext" type="button">Próxima →</button></div>';
        }
        const n = $("rxNext"), pv = $("rxPrev");
        if (n) n.onclick = () => rx.step(1);
        if (pv) pv.onclick = () => rx.step(-1);
    }

    R.CATS.forEach(function (c) {
        const h = document.createElement("div"); h.className = "rx-cat"; h.textContent = c; listEl.appendChild(h);
        R.PARTS.filter(p => p.cat === c).forEach(function (p) {
            const b = document.createElement("button");
            b.type = "button"; b.className = "rx-part"; b.dataset.id = p.id; b.setAttribute("aria-pressed", "false");
            b.innerHTML = '<i style="background:' + p.cor + '"></i><span>' + esc(p.nome) + "</span>";
            b.onclick = () => rx.select(rx.selected === p.id ? null : p.id);
            listEl.appendChild(b);
        });
    });

    rx = R.create($("rxCanvas"), {
        preview: false,
        onError: () => $("rxError").classList.add("is-on"),
        onSelect: function (id) {
            document.querySelectorAll(".rx-part").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
            renderInfo(id);
            if (!id) pin.hidden = true;
        },
        onMode: m => document.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m))),
        onPin: function (x, y, on, label) {
            if (!on) { pin.hidden = true; return; }
            pin.hidden = false; pinTag.textContent = label;
            pin.style.transform = "translate(" + x + "px," + y + "px)";
        },
        onHover: function (id, x, y) {
            if (!id) { tip.hidden = true; return; }
            tip.hidden = false; tip.textContent = R.BYID[id].nome;
            tip.style.transform = "translate(" + (x + 14) + "px," + (y + 14) + "px)";
        },
    });
    if (!rx) return;
    renderInfo(null);

    document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => rx.setMode(b.dataset.mode));
    $("rxDoors").onclick   = function () { this.setAttribute("aria-pressed", String(rx.toggleDoors())); };
    $("rxExplode").onclick = function () { this.setAttribute("aria-pressed", String(rx.toggleExplode())); };
    $("rxSpin").onclick    = function () { this.setAttribute("aria-pressed", String(rx.toggleSpin())); };
    $("rxHome").onclick    = () => rx.home();
    $("rxClean").onclick   = function () {
        const on = !stage.classList.contains("is-clean");
        stage.classList.toggle("is-clean", on);
        this.setAttribute("aria-pressed", String(on));
    };
    document.querySelectorAll(".rx-sw").forEach(b => b.onclick = function () {
        rx.setPaint(b.dataset.paint);
        document.querySelectorAll(".rx-sw").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    });
    window.addEventListener("keydown", function (e) {
        if (e.target.closest && e.target.closest("input,textarea")) return;
        if (e.key === "ArrowRight") rx.step(1);
        else if (e.key === "ArrowLeft") rx.step(-1);
        else if (e.key === "Escape") rx.select(null);
        else if (e.key === "h" || e.key === "H") $("rxClean").click();
    });

    const pedida = new URLSearchParams(window.location.search).get("peca");
    if (pedida && R.BYID[pedida]) setTimeout(() => rx.select(pedida), 400);
})();
