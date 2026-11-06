/* AUTOSYNC — prévia 3D do index.html. Clicar abre raio-x.html. */
(function () {
    "use strict";
    const canvas = document.getElementById("rxPreviewCanvas");
    if (!canvas) return;
    const view = document.getElementById("rxPreviewView");
    const fallback = document.getElementById("rxFallback");
    const falhar = () => fallback && fallback.classList.add("is-on");
    if (!window.THREE || !window.THREE.OrbitControls || !window.AutoSyncRaioX) { falhar(); return; }
    AutoSyncRaioX.create(canvas, { preview: true, onError: falhar });
    view.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        window.location.href = "raio-x.html";
    });
})();
