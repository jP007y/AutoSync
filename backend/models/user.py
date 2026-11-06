"""
============================================================
AUTOSETUP — MODEL: USUÁRIO (consumidor ou prestador)
============================================================

Um único model `User` cobre os dois papéis do sistema, usando
o campo `tipo` para diferenciar. Isso evita duplicar
email/senha/etc. em duas tabelas quando a única diferença real
de dados é: prestador tem uma Loja vinculada; consumidor não.

SENHA:
Para o MVP ("inserido e analisado de forma local", como você
pediu), a senha é validada localmente neste backend, sem
depender de serviço externo de autenticação. Mesmo sendo MVP,
a senha NUNCA é guardada em texto puro — usamos hash PBKDF2
(biblioteca padrão do Python, `hashlib`, sem precisar instalar
nada novo) com salt aleatório por usuário.

SESSÃO:
Não há JWT nem cookies de sessão ainda neste MVP. O login
retorna os dados do usuário (sem a senha) e o FRONTEND guarda
isso no localStorage do navegador para saber "quem está
logado". Isso é aceitável para validar o fluxo agora, mas não é
seguro para produção — quando isso for além de MVP, o ideal é
migrar para tokens JWT com expiração.
============================================================
"""

import hashlib
import os
import secrets

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


TIPOS_VALIDOS = ("consumidor", "prestador")


def _gerar_hash_senha(senha: str, salt: str) -> str:
    """PBKDF2-HMAC-SHA256, 200.000 iterações — padrão razoável sem libs extras."""
    return hashlib.pbkdf2_hmac(
        "sha256", senha.encode("utf-8"), salt.encode("utf-8"), 200_000
    ).hex()


class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)

    nome = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    tipo = Column(String, nullable=False)  # "consumidor" ou "prestador"

    senha_salt = Column(String, nullable=False)
    senha_hash = Column(String, nullable=False)

    criado_em = Column(DateTime(timezone=True), server_default=func.now())

    def definir_senha(self, senha_texto_puro: str):
        self.senha_salt = secrets.token_hex(16)
        self.senha_hash = _gerar_hash_senha(senha_texto_puro, self.senha_salt)

    def verificar_senha(self, senha_texto_puro: str) -> bool:
        return _gerar_hash_senha(senha_texto_puro, self.senha_salt) == self.senha_hash

    def to_dict(self):
        """Nunca inclui senha_hash/senha_salt na resposta da API."""
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "tipo": self.tipo,
        }