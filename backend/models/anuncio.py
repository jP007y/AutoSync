"""
============================================================
AUTOSYNC — MODEL: ANÚNCIO (peça ou instalação oferecida)
============================================================

Tabela `anuncios`. Liga uma loja (prestador) a uma peça do
catálogo (services/compatibility.py, campo `peca_chave`), dizendo
se ela VENDE a peça, faz a INSTALAÇÃO ou os dois.

- veiculos_compativeis: lista de ids de veículos. Lista vazia
  significa "não restrito / consultar o prestador".
- faixa_preco: texto livre e OPCIONAL, sempre informado pelo
  próprio prestador. A plataforma nunca inventa preço.
- exemplo: True nos anúncios do seed de demonstração. A interface
  mostra o selo "Exemplo" neles.

Sem carrinho/pagamento nesta etapa: o consumidor só vê e entra
em contato com o prestador.
============================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

TIPOS_ANUNCIO = ["venda", "instalacao", "venda_instalacao"]


class Anuncio(Base):
    __tablename__ = "anuncios"

    id = Column(Integer, primary_key=True, index=True)
    loja_id = Column(Integer, ForeignKey("lojas.id"), nullable=False)

    peca_chave = Column(String, nullable=False)   # ex: "kit_coilover"
    categoria = Column(String, nullable=False)    # ex: "suspensao"
    tipo = Column(String, nullable=False)         # venda | instalacao | venda_instalacao

    titulo = Column(String, nullable=False)
    descricao = Column(String, nullable=True)
    veiculos_compativeis = Column(JSON, nullable=True)  # [1, 2] ou [] = consultar
    faixa_preco = Column(String, nullable=True)

    ativo = Column(Boolean, default=True, nullable=False)
    exemplo = Column(Boolean, default=False, nullable=False)

    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self, loja=None):
        dados = {
            "id": self.id,
            "lojaId": self.loja_id,
            "pecaChave": self.peca_chave,
            "categoria": self.categoria,
            "tipo": self.tipo,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "veiculosCompativeis": self.veiculos_compativeis or [],
            "faixaPreco": self.faixa_preco,
            "ativo": self.ativo,
            "exemplo": bool(self.exemplo),
            "criadoEm": self.criado_em.isoformat() if self.criado_em else None,
        }
        if loja is not None:
            dados["loja"] = {
                "id": loja.id,
                "nome": loja.nome,
                "regiao": loja.regiao,
                "contato": loja.contato,
                "emiteCSV": loja.emite_csv,
            }
        return dados


# ------------------------------------------------------------
# ANÚNCIOS DE DEMONSTRAÇÃO — ligados às lojas fictícias do seed
# (models/store.py). Todos com exemplo=True e SEM preço.
# veiculos: nomes de modelo (resolvidos para ids no seed).
# ------------------------------------------------------------
ANUNCIOS_SEED = [
    dict(loja="Suspensão Pro RJ", peca_chave="kit_coilover", categoria="suspensao", tipo="venda_instalacao",
         titulo="Kit coilover regulável com instalação", descricao="Instalação com regulagem de altura respeitando o mínimo legal e alinhamento 3D incluso.",
         veiculos=["Onix 1.0 Turbo", "Civic 1.5 Turbo", "Argo 1.3"]),
    dict(loja="Suspensão Pro RJ", peca_chave="alinhamento_3d", categoria="suspensao", tipo="instalacao",
         titulo="Alinhamento 3D pós-rebaixamento", descricao="Alinhamento e balanceamento com relatório antes/depois.", veiculos=[]),
    dict(loja="Oficina Central SP", peca_chave="amortecedores", categoria="suspensao", tipo="venda_instalacao",
         titulo="Amortecedores para suspensão rebaixada", descricao="Linha original e esportiva, com laudo de geometria.", veiculos=["Civic 1.5 Turbo"]),
    dict(loja="Oficina Central SP", peca_chave="discos_pastilhas", categoria="freios", tipo="venda_instalacao",
         titulo="Discos ranhurados e pastilhas esportivas", descricao="Upgrade de freios com troca de fluido DOT 4.", veiculos=["Argo 1.3", "Civic 1.5 Turbo"]),
    dict(loja="Stance Brasil Custom", peca_chave="molas_esportivas", categoria="suspensao", tipo="venda_instalacao",
         titulo="Molas esportivas com instalação", descricao="Rebaixamento moderado mantendo conforto.", veiculos=["Onix 1.0 Turbo", "Argo 1.3"]),
    dict(loja="Rodas & Cia Curitiba", peca_chave="rodas", categoria="rodasPneus", tipo="venda_instalacao",
         titulo="Rodas aro 15 a 17 com montagem", descricao="Conferência do diâmetro externo para não alterar o velocímetro.", veiculos=[]),
    dict(loja="Rodas & Cia Curitiba", peca_chave="pneus", categoria="rodasPneus", tipo="venda",
         titulo="Pneus em medida equivalente", descricao="Indicamos a medida dentro da tolerância de diâmetro do seu carro.", veiculos=[]),
    dict(loja="FreioMax Centro Automotivo", peca_chave="montagem_balanceamento", categoria="rodasPneus", tipo="instalacao",
         titulo="Montagem e balanceamento", descricao="Inclui checagem de folga com pinças e para-lamas.", veiculos=[]),
    dict(loja="Escape Sound Lab", peca_chave="silencioso_esportivo", categoria="escapamento", tipo="venda_instalacao",
         titulo="Silencioso esportivo com medição de ruído", descricao="Instalação e laudo de decibelímetro.", veiculos=["Onix 1.0 Turbo", "Civic 1.5 Turbo"]),
    dict(loja="Turbo Exhaust BH", peca_chave="medicao_ruido", categoria="escapamento", tipo="instalacao",
         titulo="Medição de ruído do escapamento", descricao="Medição comparativa com o valor original de fábrica.", veiculos=[]),
    dict(loja="PowerTune Performance", peca_chave="remap_ecu", categoria="motor", tipo="instalacao",
         titulo="Remapeamento de ECU em dinamômetro", descricao="Medição antes/depois em dinamômetro.", veiculos=["Onix 1.0 Turbo", "Civic 1.5 Turbo"]),
    dict(loja="PowerTune Performance", peca_chave="farois_led", categoria="eletrica", tipo="venda_instalacao",
         titulo="Faróis LED homologados", descricao="Instalação com regulagem do facho.", veiculos=[]),
]


def seed_anuncios(db):
    """Cria os anúncios de exemplo uma única vez (só se ainda não existir nenhum anúncio de exemplo)."""
    from models.store import Store
    from models.vehicle import Vehicle

    if db.query(Anuncio).filter(Anuncio.exemplo == True).count() > 0:  # noqa: E712
        return

    ids_por_modelo = {v.modelo: v.id for v in db.query(Vehicle).all()}

    for dados in ANUNCIOS_SEED:
        dados = dict(dados)
        loja = db.query(Store).filter(Store.nome == dados.pop("loja")).first()
        if loja is None:
            continue
        veiculos = [ids_por_modelo[m] for m in dados.pop("veiculos") if m in ids_por_modelo]
        db.add(Anuncio(loja_id=loja.id, veiculos_compativeis=veiculos, ativo=True, exemplo=True, **dados))

    db.commit()
