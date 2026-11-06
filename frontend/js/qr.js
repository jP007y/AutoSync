/* ============================================================
   AUTOSYNC — PÁGINA DO QR CODE
   ============================================================
   Descobre o IP do computador na rede (GET /rede no backend) e
   monta o link  http://<ip>:8000/site/<página>  — esse é o endereço
   que o celular consegue abrir. O QR Code é desenhado no próprio
   navegador (biblioteca em js/vendor/qrcode.js), sem internet.
   ============================================================ */
(function () {
    "use strict";
    const destino = document.getElementById("destino");
    const endereco = document.getElementById("endereco");
    const aviso = document.getElementById("avisoRede");
    const alvo = document.getElementById("qrImagem");
    const legenda = document.getElementById("qrLegenda");
    const urlEl = document.getElementById("qrUrl");

    const NOMES = {
        "login.html": "AutoSync — Início",
        "oficinas.html": "AutoSync — Oficinas",
        "raio-x.html": "AutoSync — Raio-X 3D",
    };

    function ehLocal(host) { return host === "localhost" || host === "127.0.0.1" || host === "[::1]"; }

    function baseDoEndereco() {
        let b = endereco.value.trim();
        if (!b) return "";
        if (!/^https?:\/\//i.test(b)) b = "http://" + b;
        if (!/\/$/.test(b)) b += "/";
        return b;
    }

    function desenhar() {
        const base = baseDoEndereco();
        if (!base) { alvo.innerHTML = ""; urlEl.textContent = ""; return; }
        const url = base + destino.value;
        const qr = qrcode(0, "M");
        qr.addData(url);
        qr.make();
        alvo.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
        legenda.textContent = NOMES[destino.value] || "AutoSync";
        urlEl.textContent = url;

        const host = new URL(url).hostname;
        if (ehLocal(host)) {
            aviso.textContent = "Atenção: \"localhost\" só funciona neste computador. Digite acima o IP da sua rede (ex.: http://192.168.0.10:8000/site/) para o celular conseguir abrir.";
        }
    }

    async function descobrirRede() {
        const aqui = window.location;
        let base = "";
        try {
            const rede = await AutoSetupApi.obterRede();
            if (rede.ips && rede.ips.length) {
                // Preferimos o IP da rede local (192.168.x.x / 10.x / 172.16-31.x)
                const privado = rede.ips.find(function (ip) { return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip); }) || rede.ips[0];
                base = "http://" + privado + ":" + rede.porta + "/site/";
                aviso.innerHTML = "Endereço detectado: <b>" + privado + "</b>. Se o celular não abrir, confira se estão na mesma rede Wi-Fi e se o firewall libera a porta " + rede.porta + ".";
            }
        } catch (e) {
            aviso.textContent = "Não consegui falar com o backend para descobrir o IP. Digite o endereço manualmente.";
        }
        // Se esta página já foi aberta por um IP (não localhost), usa o mesmo caminho
        if (!ehLocal(aqui.hostname)) {
            base = aqui.origin + "/site/";
        }
        endereco.value = base;
        desenhar();
    }

    destino.addEventListener("change", desenhar);
    endereco.addEventListener("input", desenhar);
    document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });

    descobrirRede();
})();
