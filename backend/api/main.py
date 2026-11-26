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
from pydantic import BaseModel, Field

from typing import Optional, List

from database import init_db, get_db
from models.vehicle import Vehicle, seed_vehicles
from models.store import Store, seed_stores, TIPOS_SERVICO
from models.user import User, TIPOS_VALIDOS
from models.post import Post
from models.anuncio import Anuncio, TIPOS_ANUNCIO, seed_anuncios

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
        seed_anuncios(db)
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
    # Tipos de serviço (chaves de TIPOS_SERVICO). Se o painel não
    # enviar o campo, os tipos já salvos são mantidos.
    tiposServico: Optional[List[str]] = None
    # Posição no mapa (opcional). Se o painel não enviar esses campos,
    # a posição já salva é mantida.
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


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

    if "tiposServico" in payload.model_fields_set:
        tipos = payload.tiposServico or []
        invalidos = [t for t in tipos if t not in TIPOS_SERVICO]
        if invalidos:
            raise HTTPException(status_code=400, detail="Tipo de serviço inválido: " + ", ".join(invalidos))
        loja.tipos_servico = list(dict.fromkeys(tipos))  # sem repetidos, na ordem enviada

    # Só mexe na posição se o painel mandou os campos (mesmo que nulos,
    # para permitir remover o pino). Latitude e longitude andam juntas.
    enviados = payload.model_fields_set
    if "latitude" in enviados or "longitude" in enviados:
        if (payload.latitude is None) != (payload.longitude is None):
            raise HTTPException(status_code=400, detail="Informe latitude e longitude juntas.")
        loja.latitude = payload.latitude
        loja.longitude = payload.longitude

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
# PEÇAS RECOMENDADAS E ANÚNCIOS (marketplace — sem checkout)
# ============================================================

from services.compatibility import (  # noqa: E402
    CATEGORIAS_VALIDAS, catalogo_publico, obter_peca, recomendar_pecas,
)


class AnuncioPayload(BaseModel):
    pecaChave: str
    tipo: str  # venda | instalacao | venda_instalacao
    titulo: str
    descricao: Optional[str] = None
    veiculosCompativeis: Optional[List[int]] = None
    faixaPreco: Optional[str] = None


def _anuncio_atende_veiculo(anuncio: Anuncio, veiculo_id: Optional[int]) -> bool:
    """Lista vazia = não restrito (consultar); senão o veículo precisa estar na lista."""
    if not veiculo_id:
        return True
    lista = anuncio.veiculos_compativeis or []
    return not lista or veiculo_id in lista


@app.get("/pecas/catalogo")
def catalogo_de_pecas():
    """Tipos de peça/serviço por categoria (usado no painel do prestador)."""
    return catalogo_publico()


@app.get("/pecas/recomendadas")
def pecas_recomendadas(
    veiculo_id: int,
    categorias: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Peças recomendadas para as modificações simuladas no veículo.

    - categorias: lista separada por vírgula (ex: "suspensao,rodasPneus").
      Sem ela, devolve o catálogo de todas as categorias.

    Cada peça traz a especificação compatível com a ficha técnica,
    os anúncios ativos de prestadores que vendem/instalam a peça
    (compatíveis com o veículo ou sem restrição) e as lojas que
    atendem a categoria mas ainda não anunciaram essa peça.
    """
    veiculo = db.query(Vehicle).filter(Vehicle.id == veiculo_id).first()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado.")

    pedidas = [c.strip() for c in (categorias or "").split(",") if c.strip()]
    pedidas = [c for c in pedidas if c in CATEGORIAS_VALIDAS] or CATEGORIAS_VALIDAS

    pecas = recomendar_pecas(veiculo.to_dict(), pedidas)

    lojas = {loja.id: loja for loja in db.query(Store).all()}
    anuncios = (
        db.query(Anuncio)
        .filter(Anuncio.ativo == True, Anuncio.categoria.in_(pedidas))  # noqa: E712
        .order_by(Anuncio.exemplo.asc(), Anuncio.id.desc())
        .all()
    )

    for peca in pecas:
        da_peca = [
            a for a in anuncios
            if a.peca_chave == peca["chave"] and a.loja_id in lojas
            and _anuncio_atende_veiculo(a, veiculo_id)
        ]
        peca["anuncios"] = []
        for a in da_peca:
            dados = a.to_dict(lojas[a.loja_id])
            dados["compativelComVeiculo"] = veiculo_id in (a.veiculos_compativeis or [])
            peca["anuncios"].append(dados)

        com_anuncio = {a.loja_id for a in da_peca}
        peca["lojasDaCategoria"] = [
            {"id": l.id, "nome": l.nome, "regiao": l.regiao, "contato": l.contato, "emiteCSV": l.emite_csv}
            for l in lojas.values()
            if peca["categoria"] in (l.categorias or []) and l.id not in com_anuncio
        ]

    return {
        "veiculo": {"id": veiculo.id, "nome": f"{veiculo.marca} {veiculo.modelo}"},
        "categorias": pedidas,
        "pecas": pecas,
    }


@app.get("/anuncios")
def listar_anuncios(
    peca: Optional[str] = None,
    categoria: Optional[str] = None,
    veiculo_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Lista anúncios ativos, com filtros opcionais por peça, categoria e veículo."""
    query = db.query(Anuncio).filter(Anuncio.ativo == True)  # noqa: E712
    if peca:
        query = query.filter(Anuncio.peca_chave == peca)
    if categoria:
        query = query.filter(Anuncio.categoria == categoria)

    lojas = {loja.id: loja for loja in db.query(Store).all()}
    return [
        a.to_dict(lojas.get(a.loja_id))
        for a in query.order_by(Anuncio.id.desc()).all()
        if a.loja_id in lojas and _anuncio_atende_veiculo(a, veiculo_id)
    ]


def _loja_do_prestador_ou_400(prestador_id: int, db: Session) -> Store:
    _obter_prestador_ou_404(prestador_id, db)
    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()
    if not loja:
        raise HTTPException(status_code=400, detail="Cadastre sua loja antes de anunciar peças.")
    return loja


@app.get("/prestadores/{prestador_id}/anuncios")
def anuncios_do_prestador(prestador_id: int, db: Session = Depends(get_db)):
    """Anúncios da loja do prestador (lista vazia se ainda não tem loja)."""
    _obter_prestador_ou_404(prestador_id, db)
    loja = db.query(Store).filter(Store.prestador_id == prestador_id).first()
    if not loja:
        return []
    anuncios = db.query(Anuncio).filter(Anuncio.loja_id == loja.id).order_by(Anuncio.id.desc()).all()
    return [a.to_dict() for a in anuncios]


@app.post("/prestadores/{prestador_id}/anuncios")
def criar_anuncio(prestador_id: int, payload: AnuncioPayload, db: Session = Depends(get_db)):
    """Cria um anúncio de peça/instalação na loja do prestador."""
    loja = _loja_do_prestador_ou_400(prestador_id, db)

    categoria, peca = obter_peca(payload.pecaChave)
    if not peca:
        raise HTTPException(status_code=400, detail="Peça inválida. Escolha uma peça do catálogo.")
    if payload.tipo not in TIPOS_ANUNCIO:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Use um de: {', '.join(TIPOS_ANUNCIO)}.")
    if not payload.titulo.strip():
        raise HTTPException(status_code=400, detail="Informe um título para o anúncio.")

    anuncio = Anuncio(
        loja_id=loja.id,
        peca_chave=payload.pecaChave,
        categoria=categoria,
        tipo=payload.tipo,
        titulo=payload.titulo.strip(),
        descricao=payload.descricao,
        veiculos_compativeis=payload.veiculosCompativeis or [],
        faixa_preco=(payload.faixaPreco or "").strip() or None,
        ativo=True,
        exemplo=False,
    )
    db.add(anuncio)
    db.commit()
    db.refresh(anuncio)
    return anuncio.to_dict()


@app.delete("/prestadores/{prestador_id}/anuncios/{anuncio_id}")
def excluir_anuncio(prestador_id: int, anuncio_id: int, db: Session = Depends(get_db)):
    """Exclui um anúncio — só o dono da loja pode excluir."""
    loja = _loja_do_prestador_ou_400(prestador_id, db)
    anuncio = db.query(Anuncio).filter(Anuncio.id == anuncio_id, Anuncio.loja_id == loja.id).first()
    if not anuncio:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado.")
    db.delete(anuncio)
    db.commit()
    return {"status": "ok", "id": anuncio_id}


# ============================================================
# SITE (frontend servido pelo próprio backend)
# ============================================================
# Com isso, UM comando só (uvicorn) entrega API + site:
#     http://<ip-do-computador>:8000/site/login.html
# É o que torna possível abrir o site pelo celular via QR Code.
# Precisa ficar por último, depois de todas as rotas da API.
import os as _os


# Sem Cache-Control, o navegador aplica cache heurístico aos arquivos do
# site e pode juntar HTML novo com CSS/JS antigos (só Ctrl+F5 resolvia).
# "no-cache" NÃO desliga o cache: obriga o navegador (e o Cloudflare do
# túnel) a revalidar a cada uso com o ETag/Last-Modified que o StaticFiles
# já envia — se nada mudou, a resposta é um 304 sem corpo.
# Só vale para /site/; as rotas da API não são alteradas.
@app.middleware("http")
async def _site_sem_cache_heuristico(request, call_next):
    resposta = await call_next(request)
    caminho = request.url.path
    if (caminho == "/site" or caminho.startswith("/site/")) and "cache-control" not in resposta.headers:
        resposta.headers["Cache-Control"] = "no-cache"
    return resposta


_PASTA_FRONTEND = _os.path.abspath(
    _os.path.join(_os.path.dirname(__file__), "..", "..", "frontend")
)
if _os.path.isdir(_PASTA_FRONTEND):
    app.mount("/site", StaticFiles(directory=_PASTA_FRONTEND, html=True), name="site")
