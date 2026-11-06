"""
============================================================
AUTOSETUP — MODEL: LOJA / PARCEIRO
============================================================

Tabela `lojas`. Diferente da ficha técnica do veículo (que é
uma regra técnica fixa), isso é um cadastro de parceiros que
muda com frequência — loja fecha, abre, passa a atender nova
região, etc. Por isso é um model e um endpoint próprios,
separados da lógica de avaliação técnica (cascade/legality).

Para o MVP, o cadastro é manual (via seed_stores, abaixo).
Mais adiante isso pode virar um painel de admin, ou uma
integração com um serviço externo (ex: Google Places) como
fallback quando não há loja cadastrada para a região/categoria
pedida.
============================================================
"""

from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey
from database import Base


class Store(Base):
    __tablename__ = "lojas"

    id = Column(Integer, primary_key=True, index=True)

    # Dono da loja (um usuário do tipo "prestador"). Nulo para as
    # lojas de exemplo do seed, que não pertencem a ninguém ainda.
    prestador_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    nome = Column(String, nullable=False)
    regiao = Column(String, nullable=False)  # cidade ou "Cidade/UF"

    # Lista de categorias que a loja atende, usando as mesmas
    # chaves já usadas no resto do sistema:
    # "suspensao", "rodasPneus", "escapamento", "freios",
    # "motor", "eletrica"
    categorias = Column(JSON, nullable=False)

    emite_csv = Column(Boolean, default=False)  # emite Certificado de Segurança Veicular
    contato = Column(String, nullable=True)     # telefone, site ou @ de rede social
    observacao = Column(String, nullable=True)  # ex: "Credenciada Inmetro"

    # Perfil público (portfólio) — usados na página de perfil do
    # empreendimento, acessível a partir das recomendações.
    descricao = Column(String, nullable=True)   # texto livre: como o prestador trabalha
    fotos = Column(JSON, nullable=True)          # lista de imagens em base64 (data URI)

    # Perfil profissional (exibido no perfil público)
    responsavel = Column(String, nullable=True)        # nome do profissional responsável
    formacao = Column(String, nullable=True)           # formação / certificações
    especialidades = Column(JSON, nullable=True)       # lista de textos curtos
    experiencia_anos = Column(Integer, nullable=True)
    horario = Column(String, nullable=True)
    endereco = Column(String, nullable=True)

    # Detalhes por categoria atendida:
    # {"suspensao": {"descricao": "...", "preco": "...", "prazo": "..."}, ...}
    servicos = Column(JSON, nullable=True)

    # Métrica simples para o painel do prestador: quantas vezes o
    # perfil/loja apareceu para um consumidor (incrementado pelo
    # endpoint POST /lojas/{id}/acesso).
    contador_acessos = Column(Integer, default=0, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "prestadorId": self.prestador_id,
            "nome": self.nome,
            "regiao": self.regiao,
            "categorias": self.categorias,
            "emiteCSV": self.emite_csv,
            "contato": self.contato,
            "observacao": self.observacao,
            "descricao": self.descricao,
            "responsavel": self.responsavel,
            "formacao": self.formacao,
            "especialidades": self.especialidades or [],
            "experienciaAnos": self.experiencia_anos,
            "horario": self.horario,
            "endereco": self.endereco,
            "servicos": self.servicos or {},
            "fotos": self.fotos or [],
            "contadorAcessos": self.contador_acessos,
        }


# ------------------------------------------------------------
# DADOS DE DEMONSTRAÇÃO (fictícios) — 8 prestadores com perfil
# completo e publicações de serviços feitos em carros de clientes.
# `arte` descreve a ilustração gerada por tools/gerar_imagens.py
# (carroceria, cor e selo). Troque `imagem` por uma foto real
# (ex: "img/servicos/meu-servico.jpg") quando tiver.
# ------------------------------------------------------------
SENHA_DEMO = "autosync123"

LOJAS_SEED = [
    dict(
        nome="Suspensão Pro RJ", regiao="Rio de Janeiro/RJ", categorias=["suspensao", "rodasPneus"],
        emite_csv=True, contato="(21) 99999-0001", observacao="Credenciada Inmetro para emissão de CSV.",
        descricao="Oficina focada em suspensão esportiva e geometria. Todo rebaixamento sai com alinhamento 3D, teste de rodagem e orientação sobre CSV e CRLV.",
        responsavel="Carlos Eduardo Lima",
        formacao="Técnico em Mecânica Automotiva (SENAI-RJ) · Curso de suspensão esportiva e geometria 3D",
        especialidades=["Rebaixamento com coilover", "Alinhamento 3D", "Rodas aro 17 a 19"],
        experiencia_anos=14, horario="Seg–Sex 8h–18h · Sáb 8h–13h",
        endereco="Av. Brasil, 1500 — Penha, Rio de Janeiro/RJ",
        servicos={
            "suspensao": dict(descricao="Troca de molas e amortecedores, kits coilover e regulagem de altura respeitando a altura mínima legal.", preco="A partir de R$ 2.400 (mão de obra + kit)", prazo="1 a 2 dias"),
            "rodasPneus": dict(descricao="Montagem de rodas e pneus, balanceamento e conferência de diâmetro externo para não alterar o velocímetro.", preco="A partir de R$ 180 por conjunto", prazo="Mesmo dia"),
        },
        posts=[
            dict(titulo="Civic Touring rebaixado 30 mm com coilover", conteudo="Instalamos kit coilover regulável, fizemos alinhamento 3D e teste de rodagem. Altura final de 105 mm do solo, dentro do limite legal. Cliente saiu com orientação para emitir o CSV.", veiculo="Honda Civic Touring 2023", categoria="suspensao", imagem="img/servicos/suspensao-pro-1.svg", arte=dict(carro="sedan", cor="#1f4e6b", foco="suspensao", selo="Rebaixado −30 mm")),
            dict(titulo="Onix Turbo com rodas aro 16 e pneus novos", conteudo="Troca do conjunto original por rodas aro 16 mantendo o diâmetro externo dentro da tolerância de 2%. Balanceamento e calibragem inclusos.", veiculo="Chevrolet Onix Turbo 2022", categoria="rodasPneus", imagem="img/servicos/suspensao-pro-2.svg", arte=dict(carro="hatch", cor="#a3222b", foco="rodasPneus", selo="Aro 15 → 16")),
        ],
    ),
    dict(
        nome="Oficina Central SP", regiao="São Paulo/SP", categorias=["suspensao", "freios", "escapamento"],
        emite_csv=True, contato="(11) 98888-0002", observacao="Atende suspensão, freios e escapamento com laudo técnico.",
        descricao="Centro automotivo com laudo técnico por serviço. Trabalhamos com peças de linha original e esportiva, sempre com nota fiscal e garantia.",
        responsavel="Marina Tavares",
        formacao="Engenheira Mecânica (Poli-USP) · Pós-graduação em Engenharia Automotiva",
        especialidades=["Laudos técnicos", "Freios de alta performance", "Escapamento esportivo homologado"],
        experiencia_anos=11, horario="Seg–Sex 8h–19h",
        endereco="Rua Vergueiro, 3200 — Vila Mariana, São Paulo/SP",
        servicos={
            "suspensao": dict(descricao="Revisão completa e upgrade de suspensão com laudo de geometria antes e depois.", preco="A partir de R$ 1.900", prazo="2 dias"),
            "freios": dict(descricao="Discos, pastilhas e fluido DOT 4; upgrade para discos ranhurados e pastilhas esportivas.", preco="A partir de R$ 650 por eixo", prazo="Mesmo dia"),
            "escapamento": dict(descricao="Ponteiras e silenciosos esportivos dentro do limite de ruído, com medição por decibelímetro.", preco="A partir de R$ 1.200", prazo="1 dia"),
        },
        posts=[
            dict(titulo="Upgrade de freios dianteiros no Argo", conteudo="Discos ranhurados e pastilhas de maior atrito com troca completa do fluido. Pedal mais firme e menor distância de frenagem no teste.", veiculo="Fiat Argo Drive 2023", categoria="freios", imagem="img/servicos/oficina-central-1.svg", arte=dict(carro="hatch", cor="#9aa4ad", foco="freios", selo="Discos ranhurados")),
            dict(titulo="Ponteira esportiva com ruído medido", conteudo="Silencioso esportivo instalado e ruído medido abaixo do limite. Sem perda de torque em baixa rotação.", veiculo="Honda Civic Touring 2023", categoria="escapamento", imagem="img/servicos/oficina-central-2.svg", arte=dict(carro="sedan", cor="#2b2f35", foco="escapamento", selo="Ruído medido")),
        ],
    ),
    dict(
        nome="Turbo Exhaust BH", regiao="Belo Horizonte/MG", categorias=["escapamento", "motor"],
        emite_csv=False, contato="(31) 97777-0003", observacao="Especializada em escapamento esportivo; não emite CSV.",
        descricao="Especialistas em escapamento e preparação leve de motores turbo. Fabricamos o sistema sob medida e fazemos mapeamento em dinamômetro.",
        responsavel="Rodrigo Pacheco",
        formacao="Tecnólogo em Mecânica de Precisão (CEFET-MG) · Curso de soldagem TIG",
        especialidades=["Downpipe e escape inox sob medida", "Dinamômetro", "Motores turbo"],
        experiencia_anos=9, horario="Seg–Sex 9h–18h",
        endereco="Av. Amazonas, 4100 — Gameleira, Belo Horizonte/MG",
        servicos={
            "escapamento": dict(descricao="Escape inox fabricado sob medida, com diâmetro adequado ao motor para não perder torque.", preco="A partir de R$ 2.100", prazo="3 dias"),
            "motor": dict(descricao="Preparação leve para motores turbo: filtro de alto fluxo, intercooler e ajuste em dinamômetro.", preco="A partir de R$ 1.800", prazo="2 dias"),
        },
        posts=[
            dict(titulo="Escape inox 2,5\" no Onix Turbo", conteudo="Sistema inox com diâmetro de 63 mm, equilibrado para o motor 1.0 turbo. Ganho de resposta e timbre mais grave sem exagero.", veiculo="Chevrolet Onix Turbo 2022", categoria="escapamento", imagem="img/servicos/turbo-exhaust-1.svg", arte=dict(carro="hatch", cor="#1f4e6b", foco="escapamento", selo="Inox 63 mm")),
            dict(titulo="Filtro de alto fluxo e dinamômetro", conteudo="Troca de filtro de ar e intercooler maior, com curva de potência medida antes e depois no dinamômetro.", veiculo="Volkswagen Golf TSI 2019", categoria="motor", imagem="img/servicos/turbo-exhaust-2.svg", arte=dict(carro="hatch", cor="#e4e7ea", foco="motor", selo="Dinamômetro")),
        ],
    ),
    dict(
        nome="Rodas & Cia Curitiba", regiao="Curitiba/PR", categorias=["rodasPneus"],
        emite_csv=False, contato="(41) 96666-0004", observacao="Especializada em rodas e pneus, medição de diâmetro externo.",
        descricao="Loja de rodas e pneus com medição do diâmetro externo de cada combinação, para você mudar o visual sem alterar o velocímetro.",
        responsavel="Juliana Weber",
        formacao="Técnica em Mecânica (UTFPR) · Certificação de balanceamento e montagem de pneus baixo perfil",
        especialidades=["Rodas aro 17 a 20", "Pneus baixo perfil", "Balanceamento de precisão"],
        experiencia_anos=7, horario="Seg–Sáb 9h–18h",
        endereco="Rua Marechal Deodoro, 800 — Centro, Curitiba/PR",
        servicos={
            "rodasPneus": dict(descricao="Venda e montagem de rodas e pneus, com planilha de compatibilidade de medidas e diâmetro externo.", preco="A partir de R$ 220 por conjunto (montagem)", prazo="Mesmo dia"),
        },
        posts=[
            dict(titulo="Jogo de rodas aro 17 no Argo", conteudo="Rodas aro 17 com pneu 205/45, escolhido para manter o diâmetro externo próximo ao original. Velocímetro sem desvio perceptível.", veiculo="Fiat Argo Drive 2023", categoria="rodasPneus", imagem="img/servicos/rodas-cia-1.svg", arte=dict(carro="hatch", cor="#e4e7ea", foco="rodasPneus", selo="Aro 17")),
            dict(titulo="Pneus baixo perfil no Civic", conteudo="Troca para aro 18 com pneu 225/40. Alinhamento e balanceamento de precisão inclusos.", veiculo="Honda Civic Touring 2023", categoria="rodasPneus", imagem="img/servicos/rodas-cia-2.svg", arte=dict(carro="sedan", cor="#a3222b", foco="rodasPneus", selo="Aro 18")),
        ],
    ),
    # ---------------- 4 prestadores novos ----------------
    dict(
        nome="PowerTune Performance", regiao="Niterói/RJ", categorias=["motor", "eletrica", "escapamento"],
        emite_csv=False, contato="(21) 98765-1101", observacao="Preparação e remapeamento de motores turbo e flex.",
        descricao="Preparadora especializada em remapeamento de ECU e eletrônica automotiva. Todo projeto começa com diagnóstico e termina com teste em dinamômetro.",
        responsavel="Rafael Duarte",
        formacao="Engenheiro Mecânico (UFF) · Pós-graduação em Motores de Combustão Interna",
        especialidades=["Remapeamento de ECU", "Eletrônica e iluminação LED", "Motores turbo flex"],
        experiencia_anos=12, horario="Seg–Sex 9h–18h",
        endereco="Rua Passo da Pátria, 600 — São Francisco, Niterói/RJ",
        servicos={
            "motor": dict(descricao="Remapeamento de ECU stage 1 e 2, com análise de mistura e temperatura antes de liberar o carro.", preco="A partir de R$ 2.800", prazo="1 dia"),
            "eletrica": dict(descricao="Instalação de iluminação LED, módulos e chicotes, com proteção por fusíveis e relés dimensionados.", preco="A partir de R$ 450", prazo="Mesmo dia"),
            "escapamento": dict(descricao="Adequação do escape ao mapa novo, com sonda lambda e catalisador de alto fluxo.", preco="A partir de R$ 1.500", prazo="1 dia"),
        },
        posts=[
            dict(titulo="Stage 1 no Civic Turbo: +28 cv medidos", conteudo="Remapeamento stage 1 com a mistura monitorada em dinamômetro. Ganho de 28 cv e torque mais linear, sem alterar o consumo em uso normal.", veiculo="Honda Civic Touring 2023", categoria="motor", imagem="img/servicos/powertune-1.svg", arte=dict(carro="sedan", cor="#1f4e6b", foco="motor", selo="+28 cv medidos")),
            dict(titulo="Faróis LED com chicote dedicado", conteudo="Instalação de kit LED com relés e fusíveis próprios, sem sobrecarregar o chicote original. Feixe regulado após a instalação.", veiculo="Chevrolet Onix Turbo 2022", categoria="eletrica", imagem="img/servicos/powertune-2.svg", arte=dict(carro="hatch", cor="#2b2f35", foco="eletrica", selo="Farol LED")),
            dict(titulo="Escape com catalisador de alto fluxo", conteudo="Sistema ajustado ao novo mapa, com sonda lambda original mantida. Sem luz de injeção acesa e com emissões controladas.", veiculo="Fiat Argo Drive 2023", categoria="escapamento", imagem="img/servicos/powertune-3.svg", arte=dict(carro="hatch", cor="#9aa4ad", foco="escapamento", selo="Alto fluxo")),
        ],
    ),
    dict(
        nome="FreioMax Centro Automotivo", regiao="Rio de Janeiro/RJ", categorias=["freios", "suspensao", "rodasPneus"],
        emite_csv=True, contato="(21) 97654-2202", observacao="Especialista em freios com emissão de CSV.",
        descricao="Centro automotivo da Zona Norte do Rio com foco em segurança: freios, suspensão e pneus. Emitimos CSV e entregamos relatório de inspeção em cada serviço.",
        responsavel="Anderson Prado",
        formacao="Técnico em Mecânica (SENAI) · Inspetor veicular credenciado",
        especialidades=["Freios a disco e tambor", "Inspeção e CSV", "Suspensão de uso diário"],
        experiencia_anos=16, horario="Seg–Sáb 8h–18h",
        endereco="Rua Dias da Cruz, 250 — Méier, Rio de Janeiro/RJ",
        servicos={
            "freios": dict(descricao="Troca de pastilhas, discos, pinças e fluido; sangria completa e teste em rampa de frenagem.", preco="A partir de R$ 480 por eixo", prazo="Mesmo dia"),
            "suspensao": dict(descricao="Troca de amortecedores, coxins, buchas e pivôs com alinhamento no mesmo dia.", preco="A partir de R$ 1.100", prazo="1 dia"),
            "rodasPneus": dict(descricao="Pneus novos, balanceamento, cambagem e rodízio.", preco="A partir de R$ 90 por pneu (montagem)", prazo="Mesmo dia"),
        },
        posts=[
            dict(titulo="Conversão de tambor para disco traseiro", conteudo="Kit de disco traseiro instalado em carro de uso diário, com fluido novo e teste de frenagem. Frenagem mais estável em piso molhado.", veiculo="Chevrolet Onix Turbo 2022", categoria="freios", imagem="img/servicos/freiomax-1.svg", arte=dict(carro="hatch", cor="#e4e7ea", foco="freios", selo="Disco traseiro")),
            dict(titulo="Amortecedores e coxins no Argo", conteudo="Substituição dos quatro amortecedores e coxins desgastados. Ruído na lombada eliminado e carro mais firme em curva.", veiculo="Fiat Argo Drive 2023", categoria="suspensao", imagem="img/servicos/freiomax-2.svg", arte=dict(carro="hatch", cor="#a3222b", foco="suspensao", selo="Amortecedores")),
            dict(titulo="Pneus novos com alinhamento", conteudo="Quatro pneus novos, balanceamento e alinhamento. Entregamos o relatório antes/depois da geometria.", veiculo="Honda Civic Touring 2023", categoria="rodasPneus", imagem="img/servicos/freiomax-3.svg", arte=dict(carro="sedan", cor="#9aa4ad", foco="rodasPneus", selo="4 pneus novos")),
        ],
    ),
    dict(
        nome="Escape Sound Lab", regiao="Campinas/SP", categorias=["escapamento", "motor"],
        emite_csv=True, contato="(19) 98123-3303", observacao="Escapamento com medição de ruído e emissões.",
        descricao="Laboratório de escapamento: projetamos o sistema pelo diâmetro ideal para o seu motor e medimos ruído e emissões antes de entregar.",
        responsavel="Beatriz Nogueira",
        formacao="Engenheira Automotiva (Unicamp) · Especialização em Acústica Veicular",
        especialidades=["Acústica e ruído", "Projeto de escape", "Emissões"],
        experiencia_anos=8, horario="Seg–Sex 8h30–17h30",
        endereco="Av. Barão de Itapura, 1900 — Guanabara, Campinas/SP",
        servicos={
            "escapamento": dict(descricao="Projeto e instalação de escape com diâmetro calculado para o motor, ponteira à escolha e medição de ruído.", preco="A partir de R$ 1.900", prazo="2 dias"),
            "motor": dict(descricao="Manutenção e ajuste de motor: velas, bobinas, bicos e limpeza de TBI com análise de gases.", preco="A partir de R$ 380", prazo="Mesmo dia"),
        },
        posts=[
            dict(titulo="Escape projetado para o Argo 1.3", conteudo="Diâmetro de 51 mm escolhido para o motor aspirado, evitando perda de torque em baixa. Ruído medido e dentro do limite.", veiculo="Fiat Argo Drive 2023", categoria="escapamento", imagem="img/servicos/escape-sound-1.svg", arte=dict(carro="hatch", cor="#1f4e6b", foco="escapamento", selo="51 mm · ruído ok")),
            dict(titulo="Revisão de ignição no Civic", conteudo="Velas e bobinas trocadas e bicos limpos, com análise de gases. Marcha lenta mais estável e consumo normalizado.", veiculo="Honda Civic Touring 2023", categoria="motor", imagem="img/servicos/escape-sound-2.svg", arte=dict(carro="sedan", cor="#e4e7ea", foco="motor", selo="Análise de gases")),
        ],
    ),
    dict(
        nome="Stance Brasil Custom", regiao="Porto Alegre/RS", categorias=["suspensao", "rodasPneus", "eletrica"],
        emite_csv=True, contato="(51) 99321-4404", observacao="Projetos de visual e rebaixamento com laudo.",
        descricao="Customização visual com responsabilidade: rebaixamos e trocamos rodas respeitando os limites legais, e fazemos iluminação decorativa com instalação segura.",
        responsavel="Felipe Zanotto",
        formacao="Designer Automotivo (UniRitter) · Técnico em Eletrotécnica",
        especialidades=["Rebaixamento e rodas", "Visual e estética", "Iluminação decorativa"],
        experiencia_anos=10, horario="Ter–Sáb 9h–18h",
        endereco="Av. Assis Brasil, 2100 — Passo d'Areia, Porto Alegre/RS",
        servicos={
            "suspensao": dict(descricao="Molas esportivas e coilovers com projeto visual (vão da roda) e laudo de altura mínima.", preco="A partir de R$ 2.200", prazo="2 dias"),
            "rodasPneus": dict(descricao="Rodas aro 17 a 19 com offset calculado para não roçar no para-lama, e pneus de medida compatível.", preco="A partir de R$ 250 por conjunto (montagem)", prazo="Mesmo dia"),
            "eletrica": dict(descricao="Iluminação decorativa e interna com LED, em circuito próprio com fusível dedicado.", preco="A partir de R$ 300", prazo="Mesmo dia"),
        },
        posts=[
            dict(titulo="Molas esportivas no Onix: visual e laudo", conteudo="Molas esportivas com rebaixamento de 25 mm e vão da roda alinhado. Altura final conferida e laudo entregue ao cliente.", veiculo="Chevrolet Onix Turbo 2022", categoria="suspensao", imagem="img/servicos/stance-1.svg", arte=dict(carro="hatch", cor="#2b2f35", foco="suspensao", selo="Rebaixado −25 mm")),
            dict(titulo="Rodas aro 18 e offset calculado", conteudo="Rodas aro 18 com offset escolhido para não tocar no para-lama ao esterçar. Pneus de perfil compatível com o diâmetro original.", veiculo="Honda Civic Touring 2023", categoria="rodasPneus", imagem="img/servicos/stance-2.svg", arte=dict(carro="sedan", cor="#1f4e6b", foco="rodasPneus", selo="Aro 18")),
            dict(titulo="LED interno com circuito dedicado", conteudo="Iluminação interna decorativa em circuito próprio com fusível, sem mexer no chicote original.", veiculo="Fiat Argo Drive 2023", categoria="eletrica", imagem="img/servicos/stance-3.svg", arte=dict(carro="hatch", cor="#a3222b", foco="eletrica", selo="LED interno")),
        ],
    ),
]

EMAILS_DEMO = {
    "PowerTune Performance": "powertune@demo.autosync",
    "FreioMax Centro Automotivo": "freiomax@demo.autosync",
    "Escape Sound Lab": "escapesound@demo.autosync",
    "Stance Brasil Custom": "stance@demo.autosync",
}

CAMPOS_PERFIL = ["descricao", "responsavel", "formacao", "especialidades",
                 "experiencia_anos", "horario", "endereco", "servicos"]


def seed_stores(db):
    """
    Garante as 8 lojas de demonstração, sem apagar nada:
    - cria as que não existem (por nome);
    - nas já existentes, só PREENCHE campos de perfil que estejam vazios;
    - cria publicações apenas para lojas de demonstração que ainda não têm nenhuma;
    - as 4 lojas novas ganham uma conta de prestador de demonstração
      (e-mail em EMAILS_DEMO, senha em SENHA_DEMO) para testar o painel.
    Dados FICTÍCIOS: servem para validar o fluxo antes de cadastrar parceiros reais.
    """
    from models.user import User
    from models.post import Post

    for dados in LOJAS_SEED:
        dados = dict(dados)
        posts = dados.pop("posts")
        loja = db.query(Store).filter(Store.nome == dados["nome"]).first()

        if loja is None:
            loja = Store(**dados)
            db.add(loja)
            db.flush()
        else:
            for campo in CAMPOS_PERFIL:
                if not getattr(loja, campo):
                    setattr(loja, campo, dados.get(campo))

        email = EMAILS_DEMO.get(loja.nome)
        if email and loja.prestador_id is None:
            usuario = db.query(User).filter(User.email == email).first()
            if usuario is None:
                usuario = User(nome=dados["responsavel"], email=email, tipo="prestador")
                usuario.definir_senha(SENHA_DEMO)
                db.add(usuario)
                db.flush()
            loja.prestador_id = usuario.id

        if db.query(Post).filter(Post.loja_id == loja.id).count() == 0:
            for post in posts:
                post = {k: v for k, v in post.items() if k != "arte"}
                db.add(Post(loja_id=loja.id, **post))

    db.commit()
