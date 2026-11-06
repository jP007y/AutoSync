"""
============================================================
AUTOSETUP — API (FastAPI)
============================================================

MVP atual: a API sobe, cria as tabelas se não existirem,
garante que o veículo de referência (Onix) está cadastrado,
e expõe endpoints para o frontend LER a ficha técnica do
banco de dados.

A lógica de cascata/risco/legalidade (services/cascade.py,
services/legality.py) ainda NÃO está plugada aqui — isso é
o próximo passo, depois que a leitura do veículo estiver
validada ponta a ponta (banco -> API -> frontend).

Como rodar localmente (a partir da pasta backend/):
    pip install fastapi uvicorn sqlalchemy
    uvicorn api.main:app --reload --port 8000

Depois, acessar:
    http://localhost:8000/docs        -> documentação interativa
    http://localhost:8000/veiculos    -> lista de veículos
    http://localhost:8000/veiculos/1  -> ficha técnica de 1 veículo
============================================================
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel

from typing import Optional, List

from database import init_db, get_db
from models.vehicle import Vehicle, seed_vehicles
from models.store import Store, seed_stores
from models.user import User, TIPOS_VALIDOS
from models.post import Post

app = FastAPI(
    title="AutoSetup API",
    description="API do AutoSetup — avaliação técnica de modificações veiculares.",
    version="0.1.0",
)

# Libera o frontend (rodando em outra porta/origem, ex: Live Server
# ou file://) a fazer fetch() para esta API. Em produção, trocar "*"
# pela URL real do frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Cria as tabelas (se não existirem) e garante o veículo seed."""
    init_db()
    db = next(get_db())
    try:
        seed_vehicles(db)
        seed_stores(db)
    finally:
        db.close()


@app.get("/rede")
def informacoes_de_rede():
    """
    Endereços de rede (IP local) deste computador. Usado pela página de QR Code
    (qr.html) para montar o link que o celular consegue abrir na mesma rede Wi-Fi.
    """
    import socket

    ips = []
    try:
        # Truque padrão: "conecta" um socket UDP (sem enviar nada) para descobrir
        # qual IP local a máquina usaria para sair para a rede.
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ips.append(sock.getsockname()[0])
        sock.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except OSError:
        pass

    return {"ips": ips, "porta": 8000}


@app.get("/")
def raiz():
    return {"status": "ok", "servico": "AutoSetup API"}


# ============================================================
# SCHEMAS (payloads de entrada, validados pelo Pydantic)
# ============================================================

class RegistroPayload(BaseModel):
    nome: str
    email: str
    senha: str
    tipo: str  # "consumidor" ou "prestador"


class LoginPayload(BaseModel):
    email: str
    senha: str


class LojaPayload(BaseModel):
    nome: str
    regiao: str
    categorias: List[str]
    emiteCSV: bool = False
    contato: Optional[str] = None
    observacao: Optional[str] = None
    descricao: Optional[str] = None
    fotos: Optional[List[str]] = None
    responsavel: Optional[str] = None
    formacao: Optional[str] = None
    especialidades: Optional[List[str]] = None
    experienciaAnos: Optional[int] = None
    horario: Optional[str] = None
    endereco: Optional[str] = None
    servicos: Optional[dict] = None


class PublicacaoPayload(BaseModel):
    titulo: str
    conteudo: str
    imagem: Optional[str] = None
    veiculo: Optional[str] = None
    categoria: Optional[str] = None


# ============================================================
# AUTENTICAÇÃO
# ============================================================

@app.post("/auth/registrar")
def registrar(payload: RegistroPayload, db: Session = Depends(get_db)):
    """
    Cria um novo usuário — consumidor ou prestador, conforme o
    campo `tipo`. A senha nunca é devolvida nem guardada em
    texto puro (ver models/user.py).
    """
    if payload.tipo not in TIPOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo inválido. Use um de: {', '.join(TIPOS_VALIDOS)}."
        )

    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="E-mail inválido.")

    if len(payload.senha) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter ao menos 6 caracteres.")

    ja_existe = db.query(User).filter(User.email == payload.email).first()
    if ja_existe:
        raise HTTPException(status_code=409, detail="Já existe uma conta com este e-mail.")

    usuario = User(nome=payload.nome, email=payload.email, tipo=payload.tipo)
    usuario.definir_senha(payload.senha)

    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    return usuario.to_dict()


@app.post("/auth/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    """
    Valida email/senha e retorna os dados do usuário (sem a senha).

    MVP: não há token de sessão ainda — o frontend guarda a
    resposta no localStorage para saber quem está logado.
    """
    usuario = db.query(User).filter(User.email == payload.email).first()

    if not usuario or not usuario.verificar_senha(payload.senha):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    return usuario.to_dict()


@app.get("/veiculos")
def listar_veiculos(db: Session = Depends(get_db)):
    """Lista todos os veículos cadastrados (ficha técnica resumida)."""
    veiculos = db.query(Vehicle).all()
    return [v.to_dict() for v in veiculos]


@app.get("/veiculos/{veiculo_id}")
def obter_veiculo(veiculo_id: int, db: Session = Depends(get_db)):
    """Retorna a ficha técnica completa de um veículo pelo id."""
    veiculo = db.query(Vehicle).filter(Vehicle.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado.")
    return veiculo.to_dict()


@app.get("/lojas")
def listar_lojas(
    categoria: Optional[str] = None,
    regiao: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Lista lojas/parceiros recomendados.

    Filtros opcionais (via query string):
    - categoria: uma das chaves usadas no resto do sistema
      ("suspensao", "rodasPneus", "escapamento", "freios",
      "motor", "eletrica"). Retorna só lojas que atendem essa
      categoria.
    - regiao: filtro por texto (contém), ex: "São Paulo".

    Exemplos:
        GET /lojas
        GET /lojas?categoria=suspensao
        GET /lojas?categoria=escapamento&regiao=Belo Horizonte
    """
    query = db.query(Store)

    if regiao:
        query = query.filter(Store.regiao.ilike(f"%{regiao}%"))

    lojas = query.all()

    # Filtro por categoria é feito em Python (não em SQL) porque
    # `categorias` é uma coluna JSON (lista) — mais simples e
    # portável entre bancos do que filtrar dentro do JSON via SQL.
    if categoria:
        lojas = [loja for loja in lojas if categoria in (loja.categorias or [])]

    return [loja.to_dict() for loja in lojas]


# ============================================================
# PAINEL DO PRESTADOR
# ============================================================

def _obter_prestador_ou_404(prestador_id: int, db: Session) -> User:
    prestador = db.query(User).filter(User.id == prestador_id).first()
    if not prestador:
        raise HTTPException(status_code=404, detail="Prestador não encontrado.")
    if prestador.tipo != "prestador":
        raise HTTPException(status_code=400, detail="Este usuário não é um prestador.")
    return prestador


@app.get("/prestadores/{prestador_id}/loja")
def obter_loja_do_prestador(prestador_id: int, db: Session = Depends(get_db)):
    """Retorna a loja cadastrada por este prestador (ou 404 se ainda não criou)."""
    _obter_prestador_ou_404(prestador_id, db)

    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Este prestador ainda não cadastrou uma loja.")

    return loja.to_dict()


@app.post("/prestadores/{prestador_id}/loja")
def criar_ou_atualizar_loja(
    prestador_id: int, payload: LojaPayload, db: Session = Depends(get_db)
):
    """
    Cria a loja do prestador, ou atualiza se ele já tiver uma
    (cada prestador tem no máximo 1 loja neste MVP).
    """
    _obter_prestador_ou_404(prestador_id, db)

    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()

    if loja is None:
        loja = Store(prestador_id=prestador_id, contador_acessos=0)
        db.add(loja)

    loja.nome = payload.nome
    loja.regiao = payload.regiao
    loja.categorias = payload.categorias
    loja.emite_csv = payload.emiteCSV
    loja.contato = payload.contato
    loja.observacao = payload.observacao
    loja.descricao = payload.descricao
    loja.fotos = payload.fotos or []
    loja.responsavel = payload.responsavel
    loja.formacao = payload.formacao
    loja.especialidades = payload.especialidades or []
    loja.experiencia_anos = payload.experienciaAnos
    loja.horario = payload.horario
    loja.endereco = payload.endereco
    loja.servicos = payload.servicos or {}

    db.commit()
    db.refresh(loja)

    return loja.to_dict()


@app.get("/lojas/{loja_id}")
def obter_loja(loja_id: int, db: Session = Depends(get_db)):
    """
    Retorna o perfil público completo de uma loja — usado pela
    página de portfólio (perfil-loja.html) que o consumidor abre
    a partir das recomendações.
    """
    loja = db.query(Store).filter(Store.id == loja_id).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")
    return loja.to_dict()


@app.get("/lojas/{loja_id}/publicacoes")
def listar_publicacoes(loja_id: int, db: Session = Depends(get_db)):
    """Lista as publicações (posts do portfólio) de uma loja, mais recentes primeiro."""
    loja = db.query(Store).filter(Store.id == loja_id).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    publicacoes = (
        db.query(Post)
        .filter(Post.loja_id == loja_id)
        .order_by(Post.criado_em.desc(), Post.id.desc())
        .all()
    )
    return [p.to_dict() for p in publicacoes]


@app.post("/prestadores/{prestador_id}/publicacoes")
def criar_publicacao(
    prestador_id: int, payload: PublicacaoPayload, db: Session = Depends(get_db)
):
    """Cria uma nova publicação na loja do prestador logado."""
    _obter_prestador_ou_404(prestador_id, db)

    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()
    if not loja:
        raise HTTPException(
            status_code=400,
            detail="Cadastre sua loja antes de criar publicações."
        )

    publicacao = Post(
        loja_id=loja.id,
        titulo=payload.titulo,
        conteudo=payload.conteudo,
        imagem=payload.imagem,
        veiculo=payload.veiculo,
        categoria=payload.categoria,
    )
    db.add(publicacao)
    db.commit()
    db.refresh(publicacao)

    return publicacao.to_dict()


@app.delete("/prestadores/{prestador_id}/publicacoes/{publicacao_id}")
def excluir_publicacao(prestador_id: int, publicacao_id: int, db: Session = Depends(get_db)):
    """Exclui uma publicação — só o dono da loja pode excluir a própria publicação."""
    _obter_prestador_ou_404(prestador_id, db)

    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Este prestador não tem loja cadastrada.")

    publicacao = db.query(Post).filter(
        Post.id == publicacao_id, Post.loja_id == loja.id
    ).first()
    if not publicacao:
        raise HTTPException(status_code=404, detail="Publicação não encontrada.")

    db.delete(publicacao)
    db.commit()
    return {"status": "ok", "id": publicacao_id}


@app.post("/lojas/{loja_id}/acesso")
def registrar_acesso(loja_id: int, db: Session = Depends(get_db)):
    """
    Incrementa o contador de acessos de uma loja. Chamado pelo
    frontend sempre que um consumidor vê o perfil/card dessa loja
    (ex: na lista de oficinas recomendadas).
    """
    loja = db.query(Store).filter(Store.id == loja_id).first()
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    loja.contador_acessos = (loja.contador_acessos or 0) + 1
    db.commit()

    return {"id": loja.id, "contadorAcessos": loja.contador_acessos}


@app.get("/prestadores/{prestador_id}/estatisticas")
def estatisticas_do_prestador(prestador_id: int, db: Session = Depends(get_db)):
    """
    Retorna métricas simples para o painel do prestador: quantos
    acessos a loja dele recebeu no total.
    """
    _obter_prestador_ou_404(prestador_id, db)

    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()
    if not loja:
        return {"totalAcessos": 0, "lojaCadastrada": False}

    return {"totalAcessos": loja.contador_acessos or 0, "lojaCadastrada": True}


# ============================================================
# SITE (frontend servido pelo próprio backend)
# ============================================================
# Com isso, UM comando só (uvicorn) entrega API + site:
#     http://<ip-do-computador>:8000/site/login.html
# É o que torna possível abrir o site pelo celular via QR Code.
# Precisa ficar por último, depois de todas as rotas da API.
import os as _os

_PASTA_FRONTEND = _os.path.abspath(
    _os.path.join(_os.path.dirname(__file__), "..", "..", "frontend")
)
if _os.path.isdir(_PASTA_FRONTEND):
    app.mount("/site", StaticFiles(directory=_PASTA_FRONTEND, html=True), name="site")
