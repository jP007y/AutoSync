// ===== CATEGORIAS =====
const CATEGORIAS = [
  { id: "tuning",       nome: "Tuning" },
  { id: "vistoria",     nome: "Vistoria" },
  { id: "estetico",     nome: "Reparos estéticos" },
  { id: "martelinho",   nome: "Martelinho de ouro" },
  { id: "funilaria",    nome: "Funilaria e pintura" },
  { id: "preventiva",   nome: "Manutenção preventiva" },
  { id: "gas",          nome: "Fiscalização de gás (GNV)" },
  { id: "pequenos",     nome: "Pequenos reparos" }
];

// ===== DADOS DE EXEMPLO =====
// Troque por dados reais. Para usar a API depois: veja carregarOficinas() abaixo.
// abre/fecha em horas (0-24); dias: 0=domingo ... 6=sábado
const OFICINAS_EXEMPLO = [
  { id: 1, nome: "Oficina Central", cidade: "Rio de Janeiro", bairro: "Centro", nota: 4.6,
    categorias: ["preventiva", "pequenos", "vistoria"],
    servicos: ["Troca de óleo e filtros", "Revisão de freios", "Vistoria veicular"],
    abre: 8, fecha: 18, dias: [1,2,3,4,5,6], contato: "https://wa.me/5521999990001" },
  { id: 2, nome: "Martelinho Pro", cidade: "Rio de Janeiro", bairro: "Barra da Tijuca", nota: 4.9,
    categorias: ["martelinho", "estetico", "funilaria"],
    servicos: ["Martelinho de ouro", "Remoção de amassados", "Polimento"],
    abre: 9, fecha: 19, dias: [1,2,3,4,5,6], contato: "https://wa.me/5521999990002" },
  { id: 3, nome: "PowerTune", cidade: "Niterói", bairro: "Icaraí", nota: 4.4,
    categorias: ["tuning", "preventiva"],
    servicos: ["Remap de ECU", "Escape esportivo", "Suspensão rebaixada"],
    abre: 9, fecha: 18, dias: [1,2,3,4,5], contato: "https://wa.me/5521999990003" },
  { id: 4, nome: "GásSeguro Inspeções", cidade: "Rio de Janeiro", bairro: "Tijuca", nota: 4.7,
    categorias: ["gas", "vistoria"],
    servicos: ["Inspeção de kit GNV", "Renovação de selo", "Teste de vazamento"],
    abre: 8, fecha: 17, dias: [1,2,3,4,5], contato: "https://wa.me/5521999990004" },
  { id: 5, nome: "Funilaria Express", cidade: "São Gonçalo", bairro: "Alcântara", nota: 4.2,
    categorias: ["funilaria", "estetico", "pequenos"],
    servicos: ["Pintura localizada", "Reparo de para-choque", "Lanternagem"],
    abre: 8, fecha: 18, dias: [1,2,3,4,5,6], contato: "https://wa.me/5521999990005" },
  { id: 6, nome: "Stance & Rodas", cidade: "Niterói", bairro: "Centro", nota: 4.5,
    categorias: ["tuning", "estetico"],
    servicos: ["Rodas e pneus", "Insulfilm", "Personalização visual"],
    abre: 10, fecha: 20, dias: [1,2,3,4,5,6,0], contato: "https://wa.me/5521999990006" }
];

// Para usar o backend no futuro, troque por:
//   const r = await fetch(API_URL + "/stores"); return await r.json();
async function carregarOficinas() {
  return OFICINAS_EXEMPLO;
}

// ===== ESTADO =====
let todas = [];
const sel = new Set();

const $ = (id) => document.getElementById(id);

function estaAberta(o) {
  const agora = new Date();
  return o.dias.includes(agora.getDay()) && agora.getHours() >= o.abre && agora.getHours() < o.fecha;
}

function norm(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function nomeCategoria(id) {
  const c = CATEGORIAS.find((x) => x.id === id);
  return c ? c.nome : id;
}

// ===== FILTROS =====
function filtrar() {
  const termo = norm($("bo-texto").value.trim());
  const cidade = $("bo-cidade").value;
  const soAbertas = $("bo-aberto").checked;

  let lista = todas.filter((o) => {
    if (cidade && o.cidade !== cidade) return false;
    if (soAbertas && !estaAberta(o)) return false;
    if (sel.size && ![...sel].every((c) => o.categorias.includes(c))) return false;
    if (termo) {
      const texto = norm([o.nome, o.bairro, o.cidade, ...o.servicos].join(" "));
      if (!texto.includes(termo)) return false;
    }
    return true;
  });

  lista.sort($("bo-ordem").value === "nome"
    ? (a, b) => a.nome.localeCompare(b.nome)
    : (a, b) => b.nota - a.nota);

  desenhar(lista);
}

// ===== RENDER (usa textContent, sem risco de XSS) =====
function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function desenhar(lista) {
  const area = $("bo-resultados");
  area.replaceChildren();
  $("bo-contagem").textContent = lista.length + " oficina(s) encontrada(s)";

  if (!lista.length) {
    area.appendChild(el("p", "bo-vazio", "Nenhuma oficina encontrada. Tente remover alguns filtros."));
    return;
  }

  lista.forEach((o) => {
    const card = el("article", "bo-card");
    card.appendChild(el("h3", "", o.nome));
    card.appendChild(el("p", "bo-local", o.bairro + " - " + o.cidade));

    const tags = el("div", "bo-tags");
    o.categorias.forEach((c) => tags.appendChild(el("span", "bo-tag", nomeCategoria(c))));
    card.appendChild(tags);

    const ul = el("ul", "bo-servicos");
    o.servicos.forEach((s) => ul.appendChild(el("li", "", s)));
    card.appendChild(ul);

    const rodape = el("div", "bo-rodape");
    rodape.appendChild(el("span", "", "★ " + o.nota.toFixed(1)));
    const aberta = estaAberta(o);
    rodape.appendChild(el("span", "bo-status " + (aberta ? "aberto" : "fechado"), aberta ? "Aberta agora" : "Fechada"));
    card.appendChild(rodape);

    const link = el("a", "bo-contato", "Entrar em contato");
    link.href = o.contato;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);

    area.appendChild(card);
  });
}

// ===== INICIALIZAÇÃO =====
function montarCategorias() {
  const area = $("bo-categorias");
  CATEGORIAS.forEach((c) => {
    const b = el("button", "bo-chip", c.nome);
    b.type = "button";
    b.addEventListener("click", () => {
      if (sel.has(c.id)) sel.delete(c.id); else sel.add(c.id);
      b.classList.toggle("ativo", sel.has(c.id));
      filtrar();
    });
    area.appendChild(b);
  });
}

function montarCidades() {
  [...new Set(todas.map((o) => o.cidade))].sort().forEach((c) => {
    const op = el("option", "", c);
    op.value = c;
    $("bo-cidade").appendChild(op);
  });
}

function limpar() {
  $("bo-texto").value = "";
  $("bo-cidade").value = "";
  $("bo-aberto").checked = false;
  sel.clear();
  document.querySelectorAll(".bo-chip").forEach((b) => b.classList.remove("ativo"));
  filtrar();
}

(async function iniciar() {
  todas = await carregarOficinas();
  montarCategorias();
  montarCidades();
  ["bo-texto", "bo-cidade", "bo-ordem", "bo-aberto"].forEach((id) => {
    $(id).addEventListener(id === "bo-texto" ? "input" : "change", filtrar);
  });
  $("bo-limpar").addEventListener("click", limpar);
  filtrar();
})();