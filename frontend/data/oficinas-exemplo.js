/* ============================================================
   AUTOSYNC — OFICINAS DE EXEMPLO (modo offline)
   ============================================================
   Usadas pela aba "Buscar oficinas" SÓ quando a API não responde
   (ex.: GitHub Pages). São FICTÍCIAS: nomes inventados, sem
   telefone nem WhatsApp, e coordenadas aproximadas apenas para
   desenhar o mapa. A página mostra a faixa "Dados de exemplo"
   e o botão "Contato indisponível (exemplo)".

   Campos:
   - tiposServico: chaves de AutoSyncUtil.TIPOS_SERVICO (tuning, vistoria...)
   - categorias: categorias técnicas (AutoSyncUtil.CATEGORIAS: suspensao, motor...)
   - abre/fecha em horas (0-24); dias: 0=domingo ... 6=sábado
   - latitude/longitude: posição aproximada do bairro
   ============================================================ */
window.AUTOSETUP_OFICINAS_EXEMPLO = [
  { id: 1, nome: "Oficina Central", cidade: "Rio de Janeiro", bairro: "Centro", nota: 4.6,
    tiposServico: ["preventiva", "pequenos", "vistoria"], categorias: ["freios", "motor"],
    servicos: ["Troca de óleo e filtros", "Revisão de freios", "Vistoria veicular"],
    abre: 8, fecha: 18, dias: [1, 2, 3, 4, 5, 6],
    latitude: -22.9035, longitude: -43.1790 },
  { id: 2, nome: "Martelinho Pro", cidade: "Rio de Janeiro", bairro: "Barra da Tijuca", nota: 4.9,
    tiposServico: ["martelinho", "estetico", "funilaria"], categorias: [],
    servicos: ["Martelinho de ouro", "Remoção de amassados", "Polimento"],
    abre: 9, fecha: 19, dias: [1, 2, 3, 4, 5, 6],
    latitude: -23.0000, longitude: -43.3650 },
  { id: 3, nome: "PowerTune", cidade: "Niterói", bairro: "Icaraí", nota: 4.4,
    tiposServico: ["tuning", "preventiva"], categorias: ["motor", "escapamento", "suspensao"],
    servicos: ["Remap de ECU", "Escape esportivo", "Suspensão rebaixada"],
    abre: 9, fecha: 18, dias: [1, 2, 3, 4, 5],
    latitude: -22.9060, longitude: -43.1080 },
  { id: 4, nome: "GásSeguro Inspeções", cidade: "Rio de Janeiro", bairro: "Tijuca", nota: 4.7,
    tiposServico: ["gas", "vistoria"], categorias: [],
    servicos: ["Inspeção de kit GNV", "Renovação de selo", "Teste de vazamento"],
    abre: 8, fecha: 17, dias: [1, 2, 3, 4, 5],
    latitude: -22.9250, longitude: -43.2330 },
  { id: 5, nome: "Funilaria Express", cidade: "São Gonçalo", bairro: "Alcântara", nota: 4.2,
    tiposServico: ["funilaria", "estetico", "pequenos"], categorias: [],
    servicos: ["Pintura localizada", "Reparo de para-choque", "Lanternagem"],
    abre: 8, fecha: 18, dias: [1, 2, 3, 4, 5, 6],
    latitude: -22.8220, longitude: -43.0030 },
  { id: 6, nome: "Stance & Rodas", cidade: "Niterói", bairro: "Centro", nota: 4.5,
    tiposServico: ["tuning", "estetico"], categorias: ["rodasPneus", "suspensao"],
    servicos: ["Rodas e pneus", "Insulfilm", "Personalização visual"],
    abre: 10, fecha: 20, dias: [1, 2, 3, 4, 5, 6, 0],
    latitude: -22.8940, longitude: -43.1240 }
];
