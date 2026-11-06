"""
Gera as ilustrações (SVG) usadas no MVP: capas dos 3 carros e as imagens das
publicações de serviço dos prestadores de demonstração.

Rodar a partir da pasta AutoSetup_estrutura/backend:
    python ../tools/gerar_imagens.py

São ILUSTRAÇÕES, não fotos. Para usar fotos reais, basta colocar um arquivo com o
mesmo nome base e extensão .jpg na mesma pasta (ex: frontend/img/carros/onix.jpg);
o site tenta o .jpg primeiro e cai no .svg se ele não existir.
"""
import html
import os
import sys

BACKEND = os.getcwd()
sys.path.insert(0, BACKEND)
from models.store import LOJAS_SEED  # noqa: E402

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "img"))
LARANJA = "#ff8a00"

CORPOS = {
    "hatch": dict(
        body="M122 335 L120 292 Q120 262 142 246 L194 208 Q232 174 300 167 L430 164 Q528 166 580 232 L668 246 Q705 254 708 290 L708 335 Z",
        vidros="M234 210 Q262 186 305 183 L372 182 L372 243 L214 243 Z M392 182 L434 182 Q480 186 556 243 L392 243 Z",
        rodas=(232, 578), farol=(690, 270), lanterna=(124, 262),
    ),
    "sedan": dict(
        body="M100 335 L100 292 Q103 270 132 266 L195 259 Q252 252 300 202 Q336 172 402 168 L482 168 Q542 172 578 232 L652 252 Q698 260 704 292 L704 335 Z",
        vidros="M312 216 Q337 186 397 182 L442 182 L452 246 L288 246 Z M470 184 Q520 192 556 246 L470 246 Z",
        rodas=(215, 590), farol=(690, 276), lanterna=(106, 284),
    ),
}
CHAO = 335


def escurecer(hexcor, f=0.6):
    h = hexcor.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return "#%02x%02x%02x" % (int(r * f), int(g * f), int(b * f))


def roda(cx, cy=CHAO - 4, destaque=False):
    aro = LARANJA if destaque else "#c5ccd2"
    raios = "".join(
        f'<line x1="{cx}" y1="{cy}" x2="{cx + 30 * __import__("math").cos(a * 1.2566):.1f}" y2="{cy + 30 * __import__("math").sin(a * 1.2566):.1f}" stroke="{aro}" stroke-width="6" stroke-linecap="round"/>'
        for a in range(5)
    )
    return (
        f'<circle cx="{cx}" cy="{cy}" r="60" fill="#0b0f14"/>'
        f'<circle cx="{cx}" cy="{cy}" r="48" fill="#15191f"/>'
        f'<circle cx="{cx}" cy="{cy}" r="32" fill="none" stroke="{aro}" stroke-width="4"/>'
        f'{raios}<circle cx="{cx}" cy="{cy}" r="8" fill="#3a3f45"/>'
    )


def carro(tipo, cor, foco=None):
    c = CORPOS[tipo]
    x1, x2 = c["rodas"]
    esc = escurecer(cor, 0.55)
    fx, fy = c["farol"]
    lx, ly = c["lanterna"]
    luz = ""
    if foco == "eletrica":
        luz = f'<polygon points="{fx},{fy - 6} 790,{fy - 40} 790,{fy + 48} {fx},{fy + 8}" fill="url(#feixe)"/>'
    return f"""
    <ellipse cx="{(x1 + x2) / 2}" cy="{CHAO + 22}" rx="330" ry="14" fill="#000" opacity=".45"/>
    <defs>
      <linearGradient id="corpo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{cor}"/><stop offset="1" stop-color="{esc}"/></linearGradient>
      <linearGradient id="feixe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3b0" stop-opacity=".85"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></linearGradient>
    </defs>
    {luz}
    <path d="{c['body']}" fill="url(#corpo)" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
    <path d="{c['vidros']}" fill="#0e1822" opacity=".88"/>
    <rect x="{fx - 14}" y="{fy - 10}" width="30" height="14" rx="5" fill="#fff6c8"/>
    <rect x="{lx}" y="{ly}" width="12" height="20" rx="4" fill="#ff3b3b"/>
    <line x1="{x1 + 62}" y1="{CHAO - 10}" x2="{x2 - 62}" y2="{CHAO - 10}" stroke="#000" stroke-opacity=".25" stroke-width="2"/>
    {roda(x1, destaque=foco == 'rodasPneus')}{roda(x2, destaque=foco == 'rodasPneus')}
    """


def destaque(tipo, foco):
    c = CORPOS[tipo]
    x1, x2 = c["rodas"]
    cy = CHAO - 4
    anel = lambda cx, cyy, r: f'<circle cx="{cx}" cy="{cyy}" r="{r}" fill="none" stroke="{LARANJA}" stroke-width="4" stroke-dasharray="10 8"/>'
    if foco == "suspensao":
        zig = " ".join(f"{x2 + (16 if i % 2 else -16)},{cy - 120 + i * 9}" for i in range(0, 9))
        return anel(x2, cy, 76) + f'<polyline points="{zig}" fill="none" stroke="{LARANJA}" stroke-width="5" stroke-linejoin="round"/>' + f'<line x1="{x2 - 60}" y1="{cy - 62}" x2="{x2 + 60}" y2="{cy - 62}" stroke="{LARANJA}" stroke-width="3"/>'
    if foco == "freios":
        return anel(x2, cy, 76) + f'<circle cx="{x2}" cy="{cy}" r="36" fill="none" stroke="#c0262d" stroke-width="7"/>' + f'<path d="M{x2 + 6} {cy - 38} Q{x2 + 42} {cy - 16} {x2 + 6} {cy + 38}" fill="none" stroke="#ff4d55" stroke-width="12" stroke-linecap="round"/>'
    if foco == "rodasPneus":
        return anel(x1, cy, 76) + anel(x2, cy, 76)
    if foco == "escapamento":
        return (
            f'<path d="M{x2 - 120} {CHAO + 8} L{x1 + 40} {CHAO + 8} L{x1 - 30} {CHAO + 8}" fill="none" stroke="{LARANJA}" stroke-width="9" stroke-linecap="round"/>'
            f'<rect x="{x1 - 60}" y="{CHAO - 2}" width="34" height="20" rx="6" fill="#d7dde2" stroke="{LARANJA}" stroke-width="3"/>'
            + anel(x1 - 44, CHAO + 8, 40)
            + "".join(f'<circle cx="{x1 - 82 - i * 22}" cy="{CHAO + 8 - i * 4}" r="{6 + i * 3}" fill="#9aa5b1" opacity="{0.55 - i * 0.14:.2f}"/>' for i in range(3))
        )
    if foco == "motor":
        fx = c["farol"][0]
        pts = "560,150 590,130 620,142 650,100 690,118 730,86"
        return anel(fx - 70, 236, 68) + f'<polyline points="{pts}" fill="none" stroke="{LARANJA}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><rect x="600" y="214" width="48" height="34" rx="5" fill="#0b0f14" stroke="{LARANJA}" stroke-width="3"/><path d="M612 224h24M612 232h24M612 240h24" stroke="{LARANJA}" stroke-width="3"/>'
    if foco == "eletrica":
        fx, fy = c["farol"]
        return anel(fx, fy - 2, 40) + f'<path d="M{fx - 70} {fy - 70} l-14 26 h16 l-10 28 l30 -38 h-18 l14 -16 z" fill="{LARANJA}"/>'
    return ""


def fundo(w, h, titulo, sub=None):
    grade = "".join(f'<line x1="{x}" y1="0" x2="{x}" y2="{h}" stroke="#fff" stroke-opacity=".035"/>' for x in range(0, w, 40))
    grade += "".join(f'<line x1="0" y1="{y}" x2="{w}" y2="{y}" stroke="#fff" stroke-opacity=".035"/>' for y in range(0, h, 40))
    return f"""
    <defs><radialGradient id="bg" cx=".5" cy=".35" r=".9"><stop offset="0" stop-color="#2a3442"/><stop offset="1" stop-color="#0d1117"/></radialGradient></defs>
    <rect width="{w}" height="{h}" fill="url(#bg)"/>{grade}
    <rect y="{CHAO + 12}" width="{w}" height="{h - CHAO - 12}" fill="#0a0d12" opacity=".6"/>
    """


def svg_servico(arte, titulo, veiculo):
    titulo, veiculo = html.escape(titulo, quote=True), html.escape(veiculo, quote=True)
    selo = html.escape(arte["selo"])
    larg = 28 + len(selo) * 11
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="Ilustração: {titulo}">
    {fundo(800, 450, titulo)}
    {carro(arte['carro'], arte['cor'], arte['foco'])}
    {destaque(arte['carro'], arte['foco'])}
    <text x="28" y="40" fill="{LARANJA}" font-size="15" font-weight="700" letter-spacing="2">SERVIÇO REALIZADO</text>
    <text x="28" y="66" fill="#e6edf3" font-size="20" font-weight="700">{veiculo}</text>
    <rect x="28" y="394" width="{larg}" height="34" rx="17" fill="{LARANJA}"/>
    <text x="{28 + larg / 2}" y="416" text-anchor="middle" fill="#111" font-size="16" font-weight="700">{selo}</text>
    <text x="772" y="428" text-anchor="end" fill="#8b949e" font-size="12">Ilustração · AutoSync</text>
    </svg>"""


def svg_carro(tipo, cor, marca, modelo, detalhe):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="{marca} {modelo}">
    {fundo(800, 450, modelo)}
    {carro(tipo, cor)}
    <text x="28" y="44" fill="#8b949e" font-size="16" font-weight="700" letter-spacing="3">{marca.upper()}</text>
    <text x="28" y="84" fill="#e6edf3" font-size="36" font-weight="700">{modelo}</text>
    <text x="28" y="112" fill="{LARANJA}" font-size="16" font-weight="700">{detalhe}</text>
    <text x="772" y="428" text-anchor="end" fill="#8b949e" font-size="12">Ilustração · AutoSync</text>
    </svg>"""


def salvar(caminho, conteudo):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(conteudo)


if __name__ == "__main__":
    salvar(os.path.join(RAIZ, "carros", "onix.svg"), svg_carro("hatch", "#1f4e6b", "Chevrolet", "Onix 1.0 Turbo", "116 cv · Turbo flex · CVT"))
    salvar(os.path.join(RAIZ, "carros", "civic.svg"), svg_carro("sedan", "#3b4048", "Honda", "Civic Turbo 2023", "173 cv · 1.5 VTEC Turbo · CVT"))
    salvar(os.path.join(RAIZ, "carros", "argo.svg"), svg_carro("hatch", "#a3222b", "Fiat", "Argo 1.3", "107 cv · Firefly · Flex"))
    n = 0
    for loja in LOJAS_SEED:
        for post in loja["posts"]:
            nome = os.path.basename(post["imagem"])
            salvar(os.path.join(RAIZ, "servicos", nome), svg_servico(post["arte"], post["titulo"], post["veiculo"]))
            n += 1
    print("Capas de carros: 3 · Imagens de serviço:", n)
