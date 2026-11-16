"""
============================================================
AUTOSYNC — COMPATIBILIDADE: CATÁLOGO DE PEÇAS
============================================================

Catálogo de TIPOS de peça/serviço (não é estoque nem oferta):
cada categoria de modificação (as mesmas chaves do motor de
regras: suspensao, rodasPneus, escapamento, freios, motor,
eletrica) lista as peças que essa modificação costuma exigir.

Para cada peça:
- `atende`: qual sistema da cascata (rules-engine.js) ela resolve,
  usado para explicar ao usuário POR QUE ela foi recomendada;
- `tipo`: "peca" (algo que se compra) ou "servico" (só instalação);
- `especificacao(veiculo)`: texto de compatibilidade calculado a
  partir da ficha técnica do veículo e dos limites legais (os mesmos
  de frontend/data/regulamentacao.js).

Preço e disponibilidade NÃO estão aqui: vêm dos anúncios que cada
prestador cadastra (models/anuncio.py).
============================================================
"""

# Limites legais usados nas especificações (espelham data/regulamentacao.js)
ALTURA_MINIMA_SOLO_MM = 100           # Res. CONTRAN 916/2022 (PBT até 3.500 kg)
TOLERANCIA_DIAMETRO_PERCENTUAL = 3    # Res. CONTRAN 292/2008


def _altura(v):
    return (v.get("suspensao") or {}).get("alturaLivreSoloOriginalMm")


def _rodas(v):
    return v.get("rodasPneus") or {}


def _faixa_diametro(v):
    d = _rodas(v).get("diametroExternoOriginalMm")
    if not d:
        return None
    margem = d * TOLERANCIA_DIAMETRO_PERCENTUAL / 100
    return round(d - margem), round(d + margem)


def _espec_suspensao(v):
    h = _altura(v)
    base = f"Altura final do solo de no mínimo {ALTURA_MINIMA_SOLO_MM} mm"
    return f"{base} (original: {h} mm)" if h else base


def _espec_pneu(v):
    faixa = _faixa_diametro(v)
    medida = _rodas(v).get("medidaPneuOriginal")
    if not faixa:
        return "Diâmetro externo equivalente ao original"
    texto = f"Diâmetro externo entre {faixa[0]} e {faixa[1]} mm (±{TOLERANCIA_DIAMETRO_PERCENTUAL}%)"
    return f"{texto} · original {medida}" if medida else texto


def _espec_roda(v):
    aro = _rodas(v).get("aroOriginalPolegadas")
    faixa = _faixa_diametro(v)
    partes = []
    if aro:
        partes.append(f"Aro original {aro}\"")
    if faixa:
        partes.append(f"conjunto roda+pneu entre {faixa[0]} e {faixa[1]} mm")
    return " · ".join(partes) or "Conjunto equivalente ao original"


def _espec_escape(v):
    d = (v.get("escapamento") or {}).get("diametroSaidaOriginalMm")
    texto = "Ruído não pode superar o original de fábrica (CONAMA 252/1999)"
    return f"Diâmetro de saída original {d} mm · {texto}" if d else texto


def _espec_freio(v):
    f = v.get("freios") or {}
    if f.get("dianteiro"):
        return f"Original: {f.get('dianteiro')} (diant.) / {f.get('traseiro', '—')} (tras.) · exige CSV se alterar o sistema"
    return "Alteração no sistema de freios exige CSV"


def _espec_motor(v):
    m = v.get("motor") or {}
    if m.get("descricao"):
        return f"Para {m['descricao']} · alteração de potência exige regularização (CTB art. 123)"
    return "Alteração de potência exige regularização (CTB art. 123)"


def _espec_eletrica(v):
    e = v.get("eletrica") or {}
    tensao = e.get("tensaoVolts", 12)
    return f"Sistema {tensao} V · faróis originais: {e.get('farois', '—')} · cor e intensidade dentro da Res. CONTRAN 227/2007"


def _fixo(texto):
    return lambda v: texto


CATALOGO_PECAS = {
    "suspensao": [
        dict(chave="kit_coilover", nome="Kit coilover regulável", tipo="peca", atende="Suspensão", especificacao=_espec_suspensao),
        dict(chave="molas_esportivas", nome="Molas esportivas", tipo="peca", atende="Suspensão", especificacao=_espec_suspensao),
        dict(chave="amortecedores", nome="Amortecedores compatíveis com a nova altura", tipo="peca", atende="Suspensão", especificacao=_espec_suspensao),
        dict(chave="alinhamento_3d", nome="Alinhamento 3D e balanceamento", tipo="servico", atende="Geometria", especificacao=_fixo("Obrigatório logo após alterar a altura")),
    ],
    "rodasPneus": [
        dict(chave="rodas", nome="Rodas", tipo="peca", atende="Rodas/Pneus", especificacao=_espec_roda),
        dict(chave="pneus", nome="Pneus de medida equivalente", tipo="peca", atende="Rodas/Pneus", especificacao=_espec_pneu),
        dict(chave="montagem_balanceamento", nome="Montagem e balanceamento", tipo="servico", atende="Suspensão/Freios", especificacao=_fixo("Conferir folga com para-lamas e pinças de freio")),
    ],
    "escapamento": [
        dict(chave="silencioso_esportivo", nome="Silencioso / ponteira esportiva", tipo="peca", atende="Escapamento", especificacao=_espec_escape),
        dict(chave="medicao_ruido", nome="Medição de ruído (decibelímetro)", tipo="servico", atende="Ruído/Emissões", especificacao=_fixo("Comprova que o ruído não superou o original")),
    ],
    "freios": [
        dict(chave="discos_pastilhas", nome="Discos e pastilhas de maior desempenho", tipo="peca", atende="Freios", especificacao=_espec_freio),
        dict(chave="fluido_dot4", nome="Fluido de freio DOT 4", tipo="peca", atende="Freios", especificacao=_fixo("Troca completa do fluido junto com o upgrade")),
        dict(chave="laudo_csv", nome="Inspeção e CSV", tipo="servico", atende="Documentação", especificacao=_fixo("Certificado de Segurança Veicular em instituição credenciada")),
    ],
    "motor": [
        dict(chave="remap_ecu", nome="Remapeamento de ECU", tipo="servico", atende="Motor", especificacao=_espec_motor),
        dict(chave="filtro_esportivo", nome="Filtro de ar esportivo", tipo="peca", atende="Motor", especificacao=_espec_motor),
    ],
    "eletrica": [
        dict(chave="farois_led", nome="Lâmpadas / faróis LED homologados", tipo="peca", atende="Elétrica", especificacao=_espec_eletrica),
        dict(chave="instalacao_eletrica", nome="Instalação elétrica e regulagem de faróis", tipo="servico", atende="Elétrica", especificacao=_fixo("Regulagem de facho após a troca")),
    ],
}

CATEGORIAS_VALIDAS = list(CATALOGO_PECAS.keys())


def obter_peca(chave):
    """Retorna (categoria, peca) da peça com essa chave, ou (None, None)."""
    for categoria, pecas in CATALOGO_PECAS.items():
        for peca in pecas:
            if peca["chave"] == chave:
                return categoria, peca
    return None, None


def catalogo_publico():
    """Catálogo sem as funções (para o painel do prestador escolher a peça)."""
    return {
        categoria: [
            {"chave": p["chave"], "nome": p["nome"], "tipo": p["tipo"], "atende": p["atende"]}
            for p in pecas
        ]
        for categoria, pecas in CATALOGO_PECAS.items()
    }


def recomendar_pecas(veiculo, categorias):
    """
    Peças recomendadas para um veículo (dict de Vehicle.to_dict())
    e para as categorias de modificação simuladas pelo usuário.
    """
    resultado = []
    for categoria in categorias:
        for peca in CATALOGO_PECAS.get(categoria, []):
            resultado.append({
                "chave": peca["chave"],
                "nome": peca["nome"],
                "tipo": peca["tipo"],
                "categoria": categoria,
                "atende": peca["atende"],
                "especificacao": peca["especificacao"](veiculo),
            })
    return resultado
