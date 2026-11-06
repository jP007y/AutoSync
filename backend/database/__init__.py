"""
============================================================
AUTOSETUP — CONFIGURAÇÃO DE BANCO DE DADOS
============================================================

Usa SQLite via SQLAlchemy para o MVP.

Por quê SQLite agora (e não Postgres/MySQL já de cara):
- Zero infraestrutura: é um único arquivo (autosetup.db),
  não precisa subir servidor de banco nem configurar .env
  ainda.
- SQLAlchemy é um ORM: os models em `models/` são classes
  Python normais, e o SQLAlchemy traduz para tabelas.
- Migrar para Postgres depois é só trocar a variável
  DATABASE_URL abaixo — os models e services não mudam.

Este arquivo expõe:
- `engine`      -> conexão com o banco
- `SessionLocal`-> fábrica de sessões (uma por request)
- `Base`        -> classe base que os models herdam
- `get_db()`    -> dependency do FastAPI para injetar a sessão
- `init_db()`   -> cria as tabelas (chamado no startup da API)
============================================================
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Caminho do arquivo do banco. Fica na própria pasta `database/`.
# Pode ser sobrescrito por variável de ambiente no futuro
# (ex: ao trocar para Postgres, isso vira uma URL de conexão).
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///" + os.path.join(os.path.dirname(__file__), "autosetup.db")
)

# `check_same_thread=False` é necessário apenas para SQLite,
# porque o FastAPI pode acessar o banco em threads diferentes.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Dependency do FastAPI: abre uma sessão por request e garante
    que ela é fechada no final, mesmo se der erro.

    Uso em um endpoint:

        @app.get("/algo")
        def algo(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Cria todas as tabelas que ainda não existem, a partir dos
    models que herdam de `Base`.

    IMPORTANTE: os models precisam estar importados antes desta
    chamada, senão o SQLAlchemy não sabe que eles existem. Por
    isso o import de `models.vehicle` aparece dentro da função
    (import tardio) — evita import circular entre
    `database/__init__.py` e `models/vehicle.py`.
    """
    from models import vehicle, store, user, post  # noqa: F401  (garante o registro dos models)
    Base.metadata.create_all(bind=engine)
    _migrar_colunas_novas()


def _migrar_colunas_novas():
    """
    Migração leve para SQLite: `create_all` cria tabelas novas, mas NÃO
    adiciona colunas novas a tabelas que já existem. Como o banco do MVP
    já tem dados, aqui comparamos os models com as colunas reais e fazemos
    ALTER TABLE ... ADD COLUMN para o que faltar (sempre colunas anuláveis).
    Assim ninguém precisa apagar o autosetup.db ao atualizar o projeto.
    """
    if not DATABASE_URL.startswith("sqlite"):
        return
    from sqlalchemy import text
    with engine.begin() as conn:
        for tabela in Base.metadata.sorted_tables:
            existentes = {
                linha[1] for linha in conn.execute(text(f'PRAGMA table_info("{tabela.name}")'))
            }
            for coluna in tabela.columns:
                if coluna.name in existentes:
                    continue
                tipo = coluna.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{tabela.name}" ADD COLUMN "{coluna.name}" {tipo}'))