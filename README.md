# AutoSetup

Estrutura inicial do projeto de customização e manutenção preditiva veicular.

## Rodar somente a visualização

Entre em `frontend/` e abra `index.html` no navegador.

A interface funciona sem backend e sem banco de dados. Os dados exibidos atualmente são demonstrativos.

## Organização

```text
AutoSetup/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── js/
│       └── app.js
│
└── backend/
    ├── models/
    ├── services/
    ├── api/
    └── database/
```

## Regra de organização

- `index.html`: estrutura e conteúdo da página.
- `style.css`: aparência e responsividade.
- `frontend/js/app.js`: interações da interface.
- `backend/models/`: estruturas de dados.
- `backend/services/`: regras de negócio e cálculos.
- `backend/api/`: endpoints e comunicação com o frontend.
- `backend/database/`: acesso e configuração do banco.

A lógica central de compatibilidade, efeito em cascata, legalidade e manutenção deve ser implementada no backend, não misturada ao HTML.
