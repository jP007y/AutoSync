/* ============================================================
   AUTOSYNC — BUSCAR OFICINAS (mapa + quadro de cartões)
   ============================================================
   - Com backend: lê GET /lojas (AutoSetupApi.buscarLojas).
   - Sem backend (ex.: GitHub Pages): usa data/oficinas-exemplo.js
     e mostra a faixa "Dados de exemplo".
   - Mapa com Leaflet + tiles do OpenStreetMap. Se o Leaflet não
     carregar, a página continua funcionando só com os cartões.
   - A localização do usuário fica SÓ na memória desta página:
     não é enviada ao backend nem guardada no navegador.
   ============================================================ */
(function () {
  "use strict";

  // ===== TIPOS DE SERVIÇO E CATEGORIAS TÉCNICAS =====
  // Dois grupos de chips: primeiro os tipos de serviço (campo
  // tiposServico da loja), depois as categorias técnicas (campo
  // categorias). Os nomes vêm de js/util.js; cada grupo só mostra
  // as chaves presentes nas oficinas carregadas, nesta ordem.
  const NOMES_TIPOS = (window.AutoSyncUtil && AutoSyncUtil.TIPOS_SERVICO) || {};
  const NOMES_TECNICAS = (window.AutoSyncUtil && AutoSyncUtil.CATEGORIAS) || {};
  const GRUPOS_FILTRO = [
    { prefixo: "tipo", campo: "tipos", titulo: "Tipos de serviço", nomes: NOMES_TIPOS },
    { prefixo: "cat", campo: "categorias", titulo: "Categorias técnicas", nomes: NOMES_TECNICAS }
  ];

  const RAIO_TERRA_KM = 6371;
  const TEMPO_LIMITE_API_MS = 5000;
  const PROXIMAS_NO_ZOOM = 5;
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  const INTERVALO_NOMINATIM_MS = 1500; // política de uso: no máximo 1 requisição/s

  // ===== ESTADO =====
  let todas = [];
  let modoExemplo = false;
  const sel = new Set(); // chaves com prefixo do grupo: "tipo:tuning", "cat:suspensao"
  let referencia = null;   // { lat, lng, origem: "gps" | "busca" | "cidade", rotulo }
  let mapa = null;
  let camadaOficinas = null;
  let marcadorRef = null;
  const marcadores = new Map(); // id da oficina -> marcador Leaflet
  let ultimaBuscaNominatim = 0;

  const $ = (id) => document.getElementById(id);

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function nomeTipo(id) {
    return NOMES_TIPOS[id] || id;
  }

  function nomeTecnica(id) {
    return NOMES_TECNICAS[id] || id;
  }

  /** Nomes de todos os filtros da oficina: tipos de serviço e depois categorias técnicas. */
  function nomesDaOficina(o) {
    return o.tipos.map(nomeTipo).concat(o.categorias.map(nomeTecnica));
  }

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  // ===== HORÁRIO =====
  // Converte textos como "Seg–Sex 8h–18h · Sáb 8h–13h" ou
  // "Ter–Sáb 9h–18h" em [{ dias: [...], abre: min, fecha: min }].
  // Se não conseguir entender, retorna null ("Horário não informado").
  const DIAS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

  function lerHorario(texto) {
    if (!texto) return null;
    const partes = norm(texto).split(/[·;|\n]|,(?=\s*(?:dom|seg|ter|qua|qui|sex|sab))/);
    const faixas = [];
    let diasPendentes = null;

    partes.forEach((parte) => {
      const iDigito = parte.search(/\d/);
      const trechoDias = iDigito === -1 ? parte : parte.slice(0, iDigito);
      let dias = lerDias(trechoDias);
      if (iDigito === -1) {           // "Seg, Qua 8h–12h": dias sem horário seguem para o próximo trecho
        if (dias) diasPendentes = (diasPendentes || []).concat(dias);
        return;
      }
      if (diasPendentes) { dias = diasPendentes.concat(dias || []); diasPendentes = null; }

      const horas = [...parte.slice(iDigito).matchAll(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/g)];
      if (horas.length < 2 || !dias || !dias.length) return;
      const minutos = (m) => Number(m[1]) * 60 + Number(m[2] || 0);
      faixas.push({ dias: dias, abre: minutos(horas[0]), fecha: minutos(horas[1]) });
    });

    return faixas.length ? faixas : null;
  }

  function lerDias(trecho) {
    if (/todos|diariamente|todo dia/.test(trecho)) return [0, 1, 2, 3, 4, 5, 6];
    const achados = [...trecho.matchAll(/(dom|seg|ter|qua|qui|sex|sab)[a-z]*/g)];
    if (!achados.length) return null;
    if (achados.length === 2) {
      const entre = trecho.slice(achados[0].index + achados[0][0].length, achados[1].index);
      if (/[-–—]|\ba\b|\bate\b/.test(entre)) {      // intervalo: "seg–sex", "ter a sab"
        const lista = [];
        let d = DIAS[achados[0][1]];
        const fim = DIAS[achados[1][1]];
        for (let n = 0; n < 7; n++) { lista.push(d); if (d === fim) break; d = (d + 1) % 7; }
        return lista;
      }
    }
    return achados.map((m) => DIAS[m[1]]);
  }

  /** true = aberta, false = fechada, null = horário desconhecido */
  function estaAberta(o) {
    if (!o.horarios) return null;
    const agora = new Date();
    const dia = agora.getDay();
    const min = agora.getHours() * 60 + agora.getMinutes();
    return o.horarios.some((h) => {
      if (!h.dias.includes(dia)) return false;
      if (h.fecha <= h.abre) return min >= h.abre || min < h.fecha; // passa da meia-noite
      return min >= h.abre && min < h.fecha;
    });
  }

  // ===== CONTATO =====
  /** Telefone vira link de WhatsApp; URL e @ de rede social também viram link (igual ao pecas.js). */
  function linkContato(contato) {
    if (!contato) return null;
    const texto = String(contato).trim();
    if (/^https?:\/\//i.test(texto)) return texto;
    if (texto.charAt(0) === "@") return "https://instagram.com/" + encodeURIComponent(texto.slice(1));
    const digitos = texto.replace(/\D/g, "");
    if (digitos.length >= 10 && digitos.length <= 11) return "https://wa.me/55" + digitos;
    if (digitos.length >= 12 && digitos.length <= 13) return "https://wa.me/" + digitos;
    return null;
  }

  // ===== NORMALIZAÇÃO (API e exemplo no mesmo formato) =====
  function coordValida(lat, lng) {
    return typeof lat === "number" && typeof lng === "number" &&
      isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  }

  /** "Av. Brasil, 1500 — Penha, Rio de Janeiro/RJ" -> "Penha" */
  function bairroDoEndereco(endereco) {
    if (!endereco) return "";
    const m = String(endereco).match(/[—–-]\s*([^,—–]+),/);
    return m ? m[1].trim() : "";
  }

  function normalizarLojaApi(l) {
    const regiao = String(l.regiao || "");
    const ok = coordValida(l.latitude, l.longitude);
    return {
      id: "api-" + l.id,
      lojaId: l.id,
      nome: l.nome,
      cidade: regiao.split("/")[0].trim(),
      bairro: bairroDoEndereco(l.endereco),
      endereco: l.endereco || "",
      nota: null,
      tipos: Array.isArray(l.tiposServico) ? l.tiposServico : [], // lojas antigas: sem tipos
      categorias: Array.isArray(l.categorias) ? l.categorias : [],
      servicos: Array.isArray(l.especialidades) ? l.especialidades : [],
      horarios: lerHorario(l.horario),
      horarioTexto: l.horario || "",
      contatoUrl: linkContato(l.contato),
      perfilUrl: "perfil-loja.html?id=" + encodeURIComponent(l.id),
      lat: ok ? l.latitude : null,
      lng: ok ? l.longitude : null,
      exemplo: false
    };
  }

  function normalizarExemplo(o) {
    const ok = coordValida(o.latitude, o.longitude);
    return {
      id: "ex-" + o.id,
      lojaId: null,
      nome: o.nome,
      cidade: o.cidade,
      bairro: o.bairro,
      endereco: "",
      nota: typeof o.nota === "number" ? o.nota : null,
      tipos: o.tiposServico || [],
      categorias: o.categorias || [],
      servicos: o.servicos || [],
      horarios: [{ dias: o.dias, abre: o.abre * 60, fecha: o.fecha * 60 }],
      horarioTexto: "",
      contatoUrl: null, // dados de exemplo nunca têm contato real
      perfilUrl: null,
      lat: ok ? o.latitude : null,
      lng: ok ? o.longitude : null,
      exemplo: true
    };
  }

  function comTempoLimite(promessa, ms) {
    return Promise.race([
      promessa,
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error("tempo esgotado")), ms))
    ]);
  }

  async function carregarOficinas() {
    if (window.AutoSetupApi) {
      try {
        const lojas = await comTempoLimite(AutoSetupApi.buscarLojas(), TEMPO_LIMITE_API_MS);
        if (Array.isArray(lojas)) return lojas.map(normalizarLojaApi);
      } catch (e) {
        // sem backend: cai nos dados de exemplo abaixo
      }
    }
    modoExemplo = true;
    return (window.AUTOSETUP_OFICINAS_EXEMPLO || []).map(normalizarExemplo);
  }

  // ===== DISTÂNCIA (Haversine, no navegador) =====
  function distanciaKm(lat1, lng1, lat2, lng2) {
    const rad = (g) => g * Math.PI / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(a));
  }

  function formatarDistancia(km) {
    if (km < 1) return Math.round(km * 1000) + " m";
    return km.toLocaleString("pt-BR", { maximumFractionDigits: km < 10 ? 1 : 0 }) + " km";
  }

  function textoDistancia(o) {
    if (o.distancia == null) return "";
    const de = referencia && referencia.origem === "gps" ? "de você" : "de " + referencia.rotulo;
    return formatarDistancia(o.distancia) + " " + de;
  }

  // ===== FILTROS =====
  function filtrar() {
    const termo = norm($("bo-texto").value.trim());
    const cidade = $("bo-cidade").value;
    const soAbertas = $("bo-aberto").checked;
    const raio = Number($("bo-raio").value) || 0;

    let semPosicao = 0;
    let lista = todas.filter((o) => {
      if (cidade && o.cidade !== cidade) return false;
      if (soAbertas && estaAberta(o) !== true) return false;
      if (sel.size && ![...sel].every((chave) => {
        const [prefixo, id] = chave.split(":");
        return (prefixo === "tipo" ? o.tipos : o.categorias).includes(id);
      })) return false;
      if (termo) {
        const texto = norm([o.nome, o.bairro, o.cidade, o.endereco, ...o.servicos,
          ...nomesDaOficina(o)].join(" "));
        if (!texto.includes(termo)) return false;
      }
      return true;
    });

    lista.forEach((o) => {
      o.distancia = referencia && o.lat != null
        ? distanciaKm(referencia.lat, referencia.lng, o.lat, o.lng)
        : null;
    });

    if (referencia && raio > 0) {
      semPosicao = lista.filter((o) => o.distancia == null).length;
      lista = lista.filter((o) => o.distancia != null && o.distancia <= raio);
    }

    const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR");
    const ordem = $("bo-ordem").value;
    if (ordem === "nome") {
      lista.sort(porNome);
    } else if (ordem === "distancia" && referencia) {
      lista.sort((a, b) => {
        if (a.distancia == null && b.distancia == null) return porNome(a, b);
        if (a.distancia == null) return 1;
        if (b.distancia == null) return -1;
        return a.distancia - b.distancia;
      });
    } else {
      lista.sort((a, b) => (b.nota == null ? -1 : b.nota) - (a.nota == null ? -1 : a.nota) || porNome(a, b));
    }

    desenhar(lista, semPosicao);
    atualizarMapa(lista);
  }

  // ===== QUADRO DE CARTÕES (textContent, sem risco de XSS) =====
  function statusEl(o, classeBase) {
    const aberta = estaAberta(o);
    const classe = aberta === null ? "desconhecido" : (aberta ? "aberto" : "fechado");
    const texto = aberta === null ? "Horário não informado" : (aberta ? "Aberta agora" : "Fechada");
    return el("span", classeBase + " " + classe, texto);
  }

  function contatoEl(o) {
    if (o.contatoUrl) {
      const link = el("a", "bo-contato", "Entrar em contato");
      link.href = o.contatoUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      return link;
    }
    const b = el("button", "bo-contato bo-contato-off",
      o.exemplo ? "Contato indisponível (exemplo)" : "Contato não informado");
    b.type = "button";
    b.disabled = true;
    return b;
  }

  function desenhar(lista, semPosicao) {
    const area = $("bo-resultados");
    area.replaceChildren();
    let texto = lista.length + " oficina(s) encontrada(s)";
    if (modoExemplo) texto += " · exemplo";
    if (semPosicao) texto += " · " + semPosicao + " sem posição no mapa ficaram fora do raio";
    $("bo-contagem").textContent = texto;

    if (!lista.length) {
      area.appendChild(el("p", "bo-vazio", "Nenhuma oficina encontrada. Tente remover alguns filtros ou aumentar o raio."));
      return;
    }

    lista.forEach((o) => {
      const card = el("article", "bo-card");
      card.id = "bo-card-" + o.id;
      card.dataset.id = o.id;
      card.tabIndex = -1;

      const titulo = el("h3", "", o.nome);
      if (o.exemplo) titulo.appendChild(el("span", "bo-selo-exemplo", "Exemplo"));
      card.appendChild(titulo);
      card.appendChild(el("p", "bo-local", [o.bairro, o.cidade].filter(Boolean).join(" - ")));
      if (o.distancia != null) card.appendChild(el("p", "bo-distancia", textoDistancia(o)));

      const tags = el("div", "bo-tags");
      o.tipos.forEach((t) => tags.appendChild(el("span", "bo-tag", nomeTipo(t))));
      o.categorias.forEach((c) => tags.appendChild(el("span", "bo-tag bo-tag-tecnica", nomeTecnica(c))));
      card.appendChild(tags);

      if (o.servicos.length) {
        const ul = el("ul", "bo-servicos");
        o.servicos.forEach((s) => ul.appendChild(el("li", "", s)));
        card.appendChild(ul);
      }
      if (o.horarioTexto) card.appendChild(el("p", "bo-horario", o.horarioTexto));

      const rodape = el("div", "bo-rodape");
      rodape.appendChild(el("span", "", o.nota != null ? "★ " + o.nota.toFixed(1) : ""));
      rodape.appendChild(statusEl(o, "bo-status"));
      card.appendChild(rodape);

      const acoes = el("div", "bo-acoes");
      acoes.appendChild(contatoEl(o));
      if (o.perfilUrl) {
        const perfil = el("a", "bo-perfil", "Ver perfil");
        perfil.href = o.perfilUrl;
        acoes.appendChild(perfil);
      }
      if (mapa && o.lat != null) {
        const verMapa = el("button", "bo-ver-mapa", "Ver no mapa");
        verMapa.type = "button";
        verMapa.setAttribute("aria-label", "Ver " + o.nome + " no mapa");
        verMapa.addEventListener("click", () => focarNoMapa(o.id));
        acoes.appendChild(verMapa);
      }
      card.appendChild(acoes);

      area.appendChild(card);
    });
  }

  function destacarCard(id, rolar) {
    document.querySelectorAll(".bo-card-destaque").forEach((c) => c.classList.remove("bo-card-destaque"));
    const card = $("bo-card-" + id);
    if (!card) return;
    card.classList.add("bo-card-destaque");
    if (rolar) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ===== MAPA (Leaflet + OpenStreetMap) =====
  function iniciarMapa() {
    if (typeof window.L === "undefined") {
      $("bo-mapa").hidden = true;
      $("bo-mapa-erro").hidden = false;
      return;
    }
    mapa = L.map("bo-mapa", { scrollWheelZoom: false, zoomControl: true })
      .setView([-14.2, -51.9], 4); // Brasil inteiro até as oficinas carregarem
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(mapa);
    camadaOficinas = L.layerGroup().addTo(mapa);
    // roda do mouse só depois de clicar no mapa (evita "prender" a rolagem da página)
    mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
    mapa.on("blur mouseout", () => mapa.scrollWheelZoom.disable());
  }

  function iconeOficina() {
    return L.divIcon({
      className: "bo-pino",
      html: "<span></span>",
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28]
    });
  }

  function conteudoPopup(o) {
    const box = el("div", "bo-popup");
    box.appendChild(el("strong", "", o.nome + (o.exemplo ? " (exemplo)" : "")));
    box.appendChild(el("p", "bo-popup-cats", nomesDaOficina(o).join(" · ")));
    if (o.distancia != null) box.appendChild(el("p", "bo-popup-dist", textoDistancia(o)));
    box.appendChild(statusEl(o, "bo-status"));
    const acoes = el("div", "bo-popup-acoes");
    acoes.appendChild(contatoEl(o));
    if (o.perfilUrl) {
      const perfil = el("a", "bo-perfil", "Ver perfil");
      perfil.href = o.perfilUrl;
      acoes.appendChild(perfil);
    }
    box.appendChild(acoes);
    return box;
  }

  function atualizarMapa(lista) {
    if (!mapa) return;
    camadaOficinas.clearLayers();
    marcadores.clear();

    const comPosicao = lista.filter((o) => o.lat != null);
    comPosicao.forEach((o) => {
      const m = L.marker([o.lat, o.lng], { icon: iconeOficina(), title: o.nome, alt: o.nome, keyboard: true })
        .bindPopup(() => conteudoPopup(o), {
          maxWidth: 260,
          autoPanPaddingTopLeft: [60, 16],   // não esconder o popup atrás dos botões de zoom
          autoPanPaddingBottomRight: [16, 24]
        });
      m.on("click", () => destacarCard(o.id, true));
      m.addTo(camadaOficinas);
      marcadores.set(o.id, m);
    });

    // Zoom: referência + as mais próximas; sem referência, todas as visíveis.
    let pontos = comPosicao.map((o) => [o.lat, o.lng]);
    if (referencia) {
      const proximas = comPosicao.slice()
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, PROXIMAS_NO_ZOOM)
        .map((o) => [o.lat, o.lng]);
      pontos = [[referencia.lat, referencia.lng]].concat(proximas);
    }
    if (pontos.length === 1) mapa.setView(pontos[0], 14);
    else if (pontos.length > 1) mapa.fitBounds(pontos, { padding: [30, 30], maxZoom: 15 });
  }

  function focarNoMapa(id) {
    const m = marcadores.get(id);
    if (!m) return;
    mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 15));
    m.openPopup();
    destacarCard(id, false);
    $("bo-mapa").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function definirReferencia(lat, lng, origem, rotulo) {
    referencia = { lat: lat, lng: lng, origem: origem, rotulo: rotulo };
    if (mapa) {
      if (marcadorRef) marcadorRef.remove();
      marcadorRef = L.circleMarker([lat, lng], {
        radius: 9, color: "#14120F", weight: 3, fillColor: "#E8913A", fillOpacity: 1
      }).bindTooltip(origem === "gps" ? "Você está aqui" : rotulo).addTo(mapa);
    }
    $("bo-raio").disabled = false;
    const opDist = $("bo-ordem").querySelector('option[value="distancia"]');
    opDist.disabled = false;
    $("bo-ordem").value = "distancia";
    filtrar();
  }

  // ===== LOCALIZAÇÃO =====
  function status(texto) {
    $("bo-local-status").textContent = texto;
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation || !window.isSecureContext) {
      status("Seu navegador só libera a localização em páginas HTTPS (ou localhost). Digite sua cidade ou bairro ao lado, ou escolha a cidade na lista.");
      $("bo-local-busca").focus();
      return;
    }
    const botao = $("bo-minha-loc");
    botao.disabled = true;
    status("Obtendo sua localização...");
    navigator.geolocation.getCurrentPosition((pos) => {
      botao.disabled = false;
      status("Mostrando as oficinas perto de você.");
      definirReferencia(pos.coords.latitude, pos.coords.longitude, "gps", "você");
    }, (erro) => {
      botao.disabled = false;
      status(erro.code === 1
        ? "Você não permitiu o acesso à localização. Digite sua cidade ou bairro, ou escolha a cidade na lista."
        : "Não foi possível obter sua localização agora. Digite sua cidade ou bairro, ou escolha a cidade na lista.");
      $("bo-local-busca").focus();
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  /** Centro das oficinas carregadas de uma cidade (sem nenhuma requisição externa). */
  function centroDaCidade(nomeNorm) {
    const daCidade = todas.filter((o) => o.lat != null && norm(o.cidade) === nomeNorm);
    if (!daCidade.length) return null;
    return {
      lat: daCidade.reduce((s, o) => s + o.lat, 0) / daCidade.length,
      lng: daCidade.reduce((s, o) => s + o.lng, 0) / daCidade.length,
      nome: daCidade[0].cidade
    };
  }

  function lerCache(chave) {
    try { return JSON.parse(sessionStorage.getItem(chave)); } catch (e) { return null; }
  }

  function gravarCache(chave, valor) {
    try { sessionStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem storage */ }
  }

  async function buscarLocal(evento) {
    evento.preventDefault();
    const texto = $("bo-local-busca").value.trim();
    if (texto.length < 3) { status("Digite pelo menos 3 letras da cidade ou bairro."); return; }

    // 1) Cidade que já está na lista: resolve localmente.
    const local = centroDaCidade(norm(texto));
    if (local) {
      status("Centralizado nas oficinas de " + local.nome + ".");
      definirReferencia(local.lat, local.lng, "cidade", local.nome);
      return;
    }

    // 2) Cache desta sessão.
    const chave = "autosetup_geo_" + norm(texto);
    const salvo = lerCache(chave);
    if (salvo) {
      status("Centralizado em " + salvo.rotulo + ".");
      definirReferencia(salvo.lat, salvo.lng, "busca", salvo.rotulo);
      return;
    }

    // 3) Uma única consulta ao Nominatim (OSM), só no clique e respeitando 1 req/s.
    const espera = ultimaBuscaNominatim + INTERVALO_NOMINATIM_MS - Date.now();
    if (espera > 0) { status("Aguarde um instante antes de buscar de novo."); return; }
    ultimaBuscaNominatim = Date.now();

    const botao = $("bo-local-ir");
    botao.disabled = true;
    status("Buscando \"" + texto + "\" no OpenStreetMap...");
    try {
      const params = new URLSearchParams({
        q: texto, format: "jsonv2", limit: "1", countrycodes: "br", "accept-language": "pt-BR"
      });
      const resp = await fetch(NOMINATIM_URL + "?" + params.toString(), { headers: { Accept: "application/json" } });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const dados = await resp.json();
      if (!dados.length) {
        status("Não encontramos \"" + texto + "\". Tente \"bairro, cidade\" ou escolha a cidade na lista.");
        return;
      }
      const lugar = {
        lat: Number(dados[0].lat),
        lng: Number(dados[0].lon),
        rotulo: String(dados[0].display_name || texto).split(",").slice(0, 2).join(",").trim()
      };
      gravarCache(chave, lugar);
      status("Centralizado em " + lugar.rotulo + ".");
      definirReferencia(lugar.lat, lugar.lng, "busca", lugar.rotulo);
    } catch (e) {
      status("A busca de endereço não está disponível agora. Escolha a cidade na lista.");
    } finally {
      botao.disabled = false;
    }
  }

  // ===== INICIALIZAÇÃO =====
  function montarCategorias() {
    const area = $("bo-categorias");
    GRUPOS_FILTRO.forEach((g) => {
      const ordem = Object.keys(g.nomes);
      const presentes = [...new Set(todas.flatMap((o) => o[g.campo]))]
        .sort((a, b) => {
          const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
        });
      if (!presentes.length) return; // grupo sem nenhuma oficina: não aparece

      const grupo = el("div", "bo-grupo");
      const titulo = el("p", "bo-grupo-titulo", g.titulo);
      titulo.id = "bo-grupo-" + g.prefixo;
      const chips = el("div", "bo-grupo-chips");
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-labelledby", titulo.id);

      presentes.forEach((id) => {
        const chave = g.prefixo + ":" + id;
        const b = el("button", "bo-chip", g.nomes[id] || id);
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => {
          if (sel.has(chave)) sel.delete(chave); else sel.add(chave);
          b.classList.toggle("ativo", sel.has(chave));
          b.setAttribute("aria-pressed", String(sel.has(chave)));
          filtrar();
        });
        chips.appendChild(b);
      });

      grupo.appendChild(titulo);
      grupo.appendChild(chips);
      area.appendChild(grupo);
    });
  }

  function montarCidades() {
    [...new Set(todas.map((o) => o.cidade).filter(Boolean))].sort().forEach((c) => {
      const op = el("option", "", c);
      op.value = c;
      $("bo-cidade").appendChild(op);
    });
  }

  function limpar() {
    $("bo-texto").value = "";
    $("bo-cidade").value = "";
    $("bo-aberto").checked = false;
    $("bo-raio").value = "0";
    sel.clear();
    document.querySelectorAll(".bo-chip").forEach((b) => {
      b.classList.remove("ativo");
      b.setAttribute("aria-pressed", "false");
    });
    filtrar();
  }

  (async function iniciar() {
    iniciarMapa();
    todas = await carregarOficinas();
    if (modoExemplo) $("bo-aviso").hidden = false;
    montarCategorias();
    montarCidades();
    ["bo-texto", "bo-cidade", "bo-ordem", "bo-aberto", "bo-raio"].forEach((id) => {
      $(id).addEventListener(id === "bo-texto" ? "input" : "change", filtrar);
    });
    $("bo-limpar").addEventListener("click", limpar);
    $("bo-minha-loc").addEventListener("click", usarMinhaLocalizacao);
    $("bo-local-form").addEventListener("submit", buscarLocal);
    filtrar();
  })();
})();
