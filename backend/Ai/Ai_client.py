import json
import re
from pathlib import Path

import requests

# ============================================================
# CONFIGURAÇÃO DO OLLAMA
# ============================================================

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "phi3:mini"

# O system_prompt.txt fica em backend/Prompts/, uma pasta diferente
# da deste arquivo (backend/Ai/). Por isso subimos um nível (parent.parent)
# e entramos em Prompts/.
_SYSTEM_PROMPT_PATH = Path(__file__).parent.parent / "Prompts" / "system_prompt.txt"
SYSTEM_PROMPT = _SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")


def _normalizar_chaves(dados: dict) -> dict:
    """
    Modelos pequenos como o phi3:mini às vezes variam a grafia de uma
    chave (ex: "consequências" com acento em vez de "consequencias").
    Esta função corrige essas variações conhecidas antes de devolver
    o JSON para o resto do programa, sem depender de o modelo acertar
    sempre a grafia exata pedida no prompt.
    """
    variacoes = {
        "consequências": "consequencias",
        "cascatas": "cascata",
        "riscos": "risco",
        "legalidades": "legalidade",
        "scores": "score",
    }

    for chave_errada, chave_certa in variacoes.items():
        if chave_errada in dados and chave_certa not in dados:
            dados[chave_certa] = dados.pop(chave_errada)

    return dados


def _extrair_json(texto: str) -> dict:
    """
    Tenta fazer o parse direto do texto como JSON. Se o modelo acidentalmente
    incluir texto/markdown ao redor (comum em modelos pequenos como o
    phi3:mini), tenta extrair apenas o bloco { ... } antes de desistir.
    """
    texto = texto.strip()

    try:
        return _normalizar_chaves(json.loads(texto))
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", texto, re.DOTALL)
    if match:
        try:
            return _normalizar_chaves(json.loads(match.group(0)))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"O modelo não retornou um JSON válido. Resposta bruta:\n{texto}")


def analisar_modificacao(veiculo: dict, modificacao: dict, contexto_extra: str = "") -> dict:
    """
    Chama o Ollama (modelo local phi3:mini) para analisar o impacto de uma
    modificação em um veículo e retorna um dicionário já estruturado,
    seguindo o schema definido em Prompts/system_prompt.txt.

    veiculo: {"marca": ..., "modelo": ..., "ano": ..., "motor": ..., "potencia": ...}
    modificacao: {"categoria": ..., "descricao": ...}
    contexto_extra: texto adicional opcional (regras de compatibilidade,
                     legislação, etc.) para enriquecer a análise.
    """
    prompt_usuario = f"""
Veículo: {json.dumps(veiculo, ensure_ascii=False)}
Modificação proposta: {json.dumps(modificacao, ensure_ascii=False)}
Contexto adicional: {contexto_extra or "nenhum"}

Gere a análise completa seguindo o schema JSON definido nas instruções do sistema.
""".strip()

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt_usuario},
        ],
        "stream": False,
        "format": "json",  # força o Ollama a garantir saída JSON válida
        "options": {
            "temperature": 0.4,
            # repeat_penalty penaliza o modelo por repetir o mesmo token
            # seguidamente. O padrão do Ollama é 1.1; modelos pequenos como
            # o phi3:mini às vezes entram em loop (ex: gerar "9999999..."
            # infinitamente) sem essa penalidade mais alta.
            "repeat_penalty": 1.3,
            # num_predict controla o limite de tokens gerados pelo Ollama.
            "num_predict": 500,
        },
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(
            "Não foi possível conectar ao Ollama em "
            f"{OLLAMA_URL}. Verifique se o Ollama está rodando "
            "('ollama serve' ou o app aberto) e se o modelo "
            f"'{OLLAMA_MODEL}' está instalado ('ollama list')."
        ) from e
    except requests.exceptions.HTTPError as e:
        raise RuntimeError(f"Erro HTTP ao chamar o Ollama: {e}") from e

    data = response.json()
    conteudo = data.get("message", {}).get("content", "")

    return _extrair_json(conteudo)


if __name__ == "__main__":
    # Teste manual rápido, sem depender do backend/frontend.
    # Rode a partir da pasta AutoSetup_estrutura com:
    #   python -m backend.Ai.Ai_client
    resultado = analisar_modificacao(
        veiculo={
            "marca": "Kawasaki",
            "modelo": "Versys 650",
            "ano": 2024,
            "motor": "649 cc",
            "potencia": "67 cv",
        },
        modificacao={
            "categoria": "Escape",
            "descricao": "Instalação de escape esportivo",
        },
    )

    print(json.dumps(resultado, indent=2, ensure_ascii=False))