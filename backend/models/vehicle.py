# Modelo de dados do veículo.
"""
============================================================
AUTOSETUP — MODEL: VEÍCULO
============================================================

Tabela `veiculos`. Guarda a ficha técnica que antes estava
hard-coded em data/veiculos.js no frontend.

Campos "simples" (marca, modelo, ano etc.) viram colunas
normais. Campos que são objetos aninhados no JS original
(motor, suspensão, rodas/pneus, freios, escapamento, elétrica)
viram colunas JSON — o SQLite/SQLAlchemy suporta isso bem, e
evita criar 6 tabelas extras para um MVP com 1 veículo.

Quando o projeto crescer e precisar filtrar/consultar por
campos internos (ex: "todo carro com PBT > 1500kg"), aí sim
vale quebrar esses JSONs em tabelas próprias. Por agora,
YAGNI: não precisamos disso ainda.
============================================================
"""

from sqlalchemy import Column, Integer, String, Float, JSON
from database import Base


class Vehicle(Base):
    __tablename__ = "veiculos"

    id = Column(Integer, primary_key=True, index=True)

    # Identificação
    marca = Column(String, nullable=False)
    modelo = Column(String, nullable=False)
    versao = Column(String, nullable=True)
    ano_modelo = Column(Integer, nullable=False)

    # Classificação usada pelas regras do CONTRAN
    categoria = Column(String, nullable=False)  # ex: "automovel_passageiro"
    pbt_kg = Column(Float, nullable=False)       # Peso Bruto Total

    # Ficha técnica detalhada (estrutura livre em JSON)
    motor = Column(JSON, nullable=False)
    transmissao = Column(JSON, nullable=False)
    suspensao = Column(JSON, nullable=False)
    rodas_pneus = Column(JSON, nullable=False)
    freios = Column(JSON, nullable=False)
    escapamento = Column(JSON, nullable=False)
    eletrica = Column(JSON, nullable=False)

    # Apresentação (cards de escolha de veículo)
    imagem = Column(String, nullable=True)   # caminho base da foto, ex: img/carros/onix
    resumo = Column(String, nullable=True)   # descrição técnica rápida

    def to_dict(self):
        """Formato usado pela API e pelo motor de regras (services/cascade.py)."""
        return {
            "id": self.id,
            "marca": self.marca,
            "modelo": self.modelo,
            "versao": self.versao,
            "anoModelo": self.ano_modelo,
            "categoria": self.categoria,
            "pbtKg": self.pbt_kg,
            "motor": self.motor,
            "transmissao": self.transmissao,
            "suspensao": self.suspensao,
            "rodasPneus": self.rodas_pneus,
            "freios": self.freios,
            "escapamento": self.escapamento,
            "eletrica": self.eletrica,
            "imagem": self.imagem,
            "resumo": self.resumo,
        }


def seed_vehicles(db):
    """
    Garante os 3 veículos do MVP (Onix, Civic e Argo). Insere o que faltar
    e atualiza foto/resumo do que já existe, sem apagar nada.

    IMPORTANTE: valores aproximados a partir de fichas técnicas públicas de
    cada modelo/ano. Validar contra a ficha oficial da versão exata antes de
    qualquer uso real — variam entre acabamentos.
    """
    catalogo = [
        dict(
            marca="Chevrolet", modelo="Onix 1.0 Turbo", versao="LT", ano_modelo=2023,
            categoria="automovel_passageiro", pbt_kg=1620,
            imagem="img/carros/onix",
            resumo="Hatch compacto 1.0 turbo flex de 3 cilindros, 116 cv e 16,8 kgfm. Câmbio manual de 6 marchas ou automático CVT. Ótimo custo-benefício para a cidade.",
            motor={"descricao": "1.0 Turbo Flex, 3 cilindros", "potenciaCvEtanol": 116, "potenciaCvGasolina": 113,
                   "torqueKgfmEtanol": 16.8, "torqueKgfmGasolina": 16.8, "aspiracao": "turbo"},
            transmissao={"opcoes": ["Manual 6 marchas", "Automática CVT"]},
            suspensao={"tipo": "Independente (dianteira) / Eixo de torção (traseira)", "alturaLivreSoloOriginalMm": 152},
            rodas_pneus={"aroOriginalPolegadas": 15, "medidaPneuOriginal": "185/65 R15", "diametroExternoOriginalMm": 622},
            freios={"dianteiro": "Disco ventilado", "traseiro": "Tambor"},
            escapamento={"tipo": "Sistema único, com catalisador e silenciador", "diametroSaidaOriginalMm": 50},
            eletrica={"tensaoVolts": 12, "farois": "Halógeno (LED em versões superiores)"},
        ),
        dict(
            marca="Honda", modelo="Civic 1.5 Turbo", versao="Touring", ano_modelo=2023,
            categoria="automovel_passageiro", pbt_kg=1890,
            imagem="img/carros/civic",
            resumo="Sedã médio 1.5 turbo (VTEC Turbo) de 4 cilindros: 173 cv e 22,4 kgfm, câmbio CVT e rodas aro 17. Foco em desempenho com conforto.",
            motor={"descricao": "1.5 VTEC Turbo Flex, 4 cilindros", "potenciaCvEtanol": 173, "potenciaCvGasolina": 173,
                   "torqueKgfmEtanol": 22.4, "torqueKgfmGasolina": 22.4, "aspiracao": "turbo"},
            transmissao={"opcoes": ["Automática CVT"]},
            suspensao={"tipo": "Independente (dianteira McPherson) / Multilink (traseira)", "alturaLivreSoloOriginalMm": 135},
            rodas_pneus={"aroOriginalPolegadas": 17, "medidaPneuOriginal": "215/50 R17", "diametroExternoOriginalMm": 647},
            freios={"dianteiro": "Disco ventilado", "traseiro": "Disco sólido"},
            escapamento={"tipo": "Sistema único, com catalisador e silenciador", "diametroSaidaOriginalMm": 55},
            eletrica={"tensaoVolts": 12, "farois": "Full LED"},
        ),
        dict(
            marca="Fiat", modelo="Argo 1.3", versao="Drive", ano_modelo=2023,
            categoria="automovel_passageiro", pbt_kg=1570,
            imagem="img/carros/argo",
            resumo="Hatch 1.3 Firefly flex de 4 cilindros, 107 cv com etanol e 13,7 kgfm. Câmbio manual de 5 marchas ou automatizado. Leve, ágil e econômico.",
            motor={"descricao": "1.3 Firefly Flex, 4 cilindros", "potenciaCvEtanol": 107, "potenciaCvGasolina": 99,
                   "torqueKgfmEtanol": 13.7, "torqueKgfmGasolina": 12.8, "aspiracao": "aspirado"},
            transmissao={"opcoes": ["Manual 5 marchas", "Automatizada GSR"]},
            suspensao={"tipo": "Independente McPherson (dianteira) / Eixo de torção (traseira)", "alturaLivreSoloOriginalMm": 140},
            rodas_pneus={"aroOriginalPolegadas": 15, "medidaPneuOriginal": "185/65 R15", "diametroExternoOriginalMm": 622},
            freios={"dianteiro": "Disco ventilado", "traseiro": "Tambor"},
            escapamento={"tipo": "Sistema único, com catalisador e silenciador", "diametroSaidaOriginalMm": 50},
            eletrica={"tensaoVolts": 12, "farois": "Halógeno com máscara negra"},
        ),
    ]

    for dados in catalogo:
        existente = (
            db.query(Vehicle)
            .filter(Vehicle.marca == dados["marca"], Vehicle.modelo == dados["modelo"])
            .first()
        )
        if existente:
            existente.imagem = dados["imagem"]
            existente.resumo = dados["resumo"]
        else:
            db.add(Vehicle(**dados))
    db.commit()
