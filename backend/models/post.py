"""
============================================================
AUTOSYNC — MODEL: PUBLICAÇÃO (posts do portfólio do prestador)
============================================================

Tabela `publicacoes`. Cada publicação pertence a uma Loja
(um prestador só tem 1 loja neste MVP — ver models/store.py).

Serve para o prestador divulgar serviços feitos, novidades,
promoções etc. dentro do perfil público dele, que aparece
para o consumidor a partir das recomendações.
============================================================
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Post(Base):
    __tablename__ = "publicacoes"

    id = Column(Integer, primary_key=True, index=True)
    loja_id = Column(Integer, ForeignKey("lojas.id"), nullable=False)

    titulo = Column(String, nullable=False)
    conteudo = Column(String, nullable=False)
    imagem = Column(String, nullable=True)  # data URI (base64) OU caminho de arquivo (ex: img/servicos/x.svg)

    # Contexto do serviço realizado (aparece no perfil público)
    veiculo = Column(String, nullable=True)    # ex: "Honda Civic Touring 2023"
    categoria = Column(String, nullable=True)  # chave: suspensao, motor, freios...

    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "lojaId": self.loja_id,
            "titulo": self.titulo,
            "conteudo": self.conteudo,
            "imagem": self.imagem,
            "veiculo": self.veiculo,
            "categoria": self.categoria,
            "criadoEm": self.criado_em.isoformat() if self.criado_em else None,
        }