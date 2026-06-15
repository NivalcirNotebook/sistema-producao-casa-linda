const DEFECT_TYPES = [
  'Ponto Saltado',
  'Costura Torta',
  'Costura Dupla',
  'Fio Puxado',
  'Falha na Costura',
  'Peça Manchada',
  'Corte Irregular',
  'Furada',
  'Outros'
];

const STOPPAGE_REASONS = [
  'Falta De Operador',
  'Falta De Material',
  'Manutenção',
  'Dificuldade Com Material',
  'Parada Para Organização',
  'Preventiva',
  'Outros'
];

const FIELD_LABELS = {
  cor:        'Cor da Toalha',
  tiras:      'Qtd. Tiras',
  metragem:   'Metragem (m)',
  quantidade: 'Quantidade',
  corKit:     'Cor (Sortido/Individual)'
};

/**
 * Comprimento de UMA peça em metros (sentido em que a tira corre),
 * usado na Costura Longitudinal para calcular a quantidade a partir da metragem:
 *   quantidade = piso(metragem / (comprimento + 0,09))
 * Estrutura por categoria e por modelo. `_default` vale para os modelos
 * da categoria que não tiverem valor específico.
 * Valores conferidos nas etiquetas (MEDIDA: largura x comprimento).
 */
const PIECE_LENGTHS = {
  banho: {
    _default: 1.50,           // ex.: Veneza, Marrocos — 1,50m
    'Kids':   1.10,           // Kids — 1,10m
    'Lisboa': 1.30            // Lisboa — 1,30m
  },
  rosto: {
    _default: 0.75,           // Ouro, Rubi, Isabela — 0,75m
    'Sevilha': 0.80,          // Sevilha — 0,80m
    'Europa':  0.70           // Europa — 0,70m
  },
  piso: {
    _default: 0.75,
    'Istambul': 0.75,         // Istambul — 0,75m
    'Ouro':     0.80,         // Ouro — 0,80m
    'Hotel':    0.80          // Hotel — 0,80m
  },
  copa: {
    _default: 0.70            // Comum, Gourmet — 0,70m
  },
  tapete: {
    _default: 0.80,
    'Tapete Arabesco': 0.80,  // 0,80m
    'Passadeira Arabesco': 1.40 // 1,40m
  }
};

const MACHINES = [
  {
    id: 'corte',
    name: 'Máquina de Corte',
    categories: [
      {
        id: 'banho',
        label: 'Toalha de Banho',
        fields: ['cor', 'tiras', 'metragem'],
        models: ['Ouro','Isabela','Treviso','Primavera','Fabrizia','Florata','Rubi','Istambul','Beach','Sevilha','Veneza','Hotel','Esmeralda','Kids','Lisboa']
      },
      {
        id: 'rosto',
        label: 'Toalha de Rosto',
        fields: ['cor', 'tiras', 'metragem'],
        models: ['Europa','Ouro','Treviso','Florata','Hotel','Fabrizia','Isabela','Sevilha']
      },
      {
        id: 'piso',
        label: 'Toalha de Piso',
        fields: ['cor', 'tiras', 'metragem'],
        models: ['Ouro','Istambul','Hotel']
      },
      {
        id: 'copa',
        label: 'Pano de Copa',
        fields: ['cor', 'tiras', 'metragem'],
        models: ['Comum', 'Gourmet']
      },
      {
        id: 'tapete',
        label: 'Tapetes e Passadeiras',
        fields: ['cor', 'tiras', 'metragem'],
        models: ['Tapete Arabesco', 'Passadeira Arabesco']
      }
    ]
  },
  {
    id: 'costuraLong',
    name: 'Costura Longitudinal',
    categories: [
      {
        id: 'banho',
        label: 'Toalha de Banho',
        fields: ['cor', 'quantidade', 'metragem'],
        models: ['Ouro','Treviso','Primavera','Fabrizia','Florata','Rubi','Isabela','Sevilha','Veneza','Hotel','Esmeralda','Istambul','Beach','Kids','Lisboa']
      },
      {
        id: 'rosto',
        label: 'Toalha de Rosto',
        fields: ['cor', 'quantidade', 'metragem'],
        models: ['Europa','Ouro','Treviso','Florata','Hotel','Fabrizia','Isabela','Sevilha']
      },
      {
        id: 'piso',
        label: 'Toalha de Piso',
        fields: ['cor', 'quantidade', 'metragem'],
        models: ['Ouro','Istambul','Hotel']
      },
      {
        id: 'copa',
        label: 'Pano de Copa',
        fields: ['cor', 'quantidade', 'metragem'],
        models: ['Comum', 'Gourmet']
      },
      {
        id: 'tapete',
        label: 'Tapetes e Passadeiras',
        fields: ['cor', 'quantidade', 'metragem'],
        models: ['Tapete Arabesco', 'Passadeira Arabesco']
      }
    ]
  },
  {
    id: 'costuraTransv',
    name: 'Costura Transversal',
    categories: [
      {
        id: 'banho',
        label: 'Toalha de Banho',
        fields: ['cor', 'quantidade'],
        models: ['Ouro','Fabrizia','Florata','Primavera','Treviso','Rubi','Isabela','Sevilha','Veneza','Hotel','Esmeralda','Istambul','Beach','Kids','Lisboa']
      },
      {
        id: 'rosto',
        label: 'Toalha de Rosto',
        fields: ['cor', 'quantidade'],
        models: ['Europa','Ouro','Treviso','Florata','Hotel','Fabrizia','Isabela','Sevilha']
      },
      {
        id: 'piso',
        label: 'Toalha de Piso',
        fields: ['cor', 'quantidade'],
        models: ['Ouro','Istambul','Hotel']
      },
      {
        id: 'copa',
        label: 'Pano de Copa',
        fields: ['cor', 'quantidade'],
        models: ['Comum', 'Gourmet']
      },
      {
        id: 'tapete',
        label: 'Tapetes e Passadeiras',
        fields: ['cor', 'quantidade'],
        models: ['Tapete Arabesco', 'Passadeira Arabesco']
      }
    ]
  },
  {
    id: 'dobrar',
    name: 'Máquina de Dobrar',
    categories: [
      {
        id: 'banho',
        label: 'Toalha de Banho',
        fields: ['cor', 'quantidade'],
        models: ['Ouro','Fabrizia','Florata','Primavera','Treviso','Rubi','Isabela','Sevilha','Veneza','Hotel','Esmeralda','Istambul','Beach','Kids','Lisboa']
      },
      {
        id: 'rosto',
        label: 'Toalha de Rosto',
        fields: ['cor', 'quantidade'],
        models: ['Europa','Ouro','Treviso','Florata','Hotel','Fabrizia','Isabela','Sevilha']
      },
      {
        id: 'piso',
        label: 'Toalha de Piso',
        fields: ['cor', 'quantidade'],
        models: ['Ouro','Istambul','Hotel']
      },
      {
        id: 'copa',
        label: 'Pano de Copa',
        fields: ['cor', 'quantidade'],
        models: ['Comum', 'Gourmet']
      },
      {
        id: 'tapete',
        label: 'Tapetes e Passadeiras',
        fields: ['cor', 'quantidade'],
        models: ['Tapete Arabesco', 'Passadeira Arabesco']
      }
    ]
  },
  {
    id: 'bordar',
    name: 'Máquina de Bordar',
    categories: [
      {
        id: 'banho',
        label: 'Toalha de Banho',
        fields: ['cor', 'quantidade'],
        models: ['Ouro','Fabrizia','Florata','Primavera','Treviso','Rubi','Isabela','Sevilha','Veneza','Hotel','Esmeralda','Istambul','Beach','Kids','Lisboa']
      },
      {
        id: 'rosto',
        label: 'Toalha de Rosto',
        fields: ['cor', 'quantidade'],
        models: ['Europa','Ouro','Treviso','Florata','Hotel','Fabrizia','Isabela','Sevilha']
      },
      {
        id: 'piso',
        label: 'Toalha de Piso',
        fields: ['cor', 'quantidade'],
        models: ['Ouro','Istambul','Hotel']
      },
      {
        id: 'copa',
        label: 'Pano de Copa',
        fields: ['cor', 'quantidade'],
        models: ['Comum', 'Gourmet']
      },
      {
        id: 'tapete',
        label: 'Tapetes e Passadeiras',
        fields: ['cor', 'quantidade'],
        models: ['Tapete Arabesco', 'Passadeira Arabesco']
      }
    ]
  },
  {
    id: 'embalar',
    name: 'Máquina de Embalar',
    categories: [
      {
        id: 'kits',
        label: 'Kits',
        fields: ['corKit', 'quantidade'],
        models: ['Rosto Ouro','Rosto Fabrizia','Rosto Florata','Rosto Isabela','Rosto Europa','Piso Ouro','Piso Hotel','Piso Istambul','Copinha','Banho Hotel','Banho Ouro','Banho Fabrizia','Banho Isabela','Banho Primavera','Banho Kids']
      }
    ]
  },
  {
    id: 'montagem',
    name: 'Mesa de Montagem',
    categories: [
      {
        id: 'kits',
        label: 'Kits',
        fields: ['corKit', 'quantidade'],
        models: ['Banho Ouro','Banho Fabrizia','Banho Isabela','Banho Kids','Banho Copinha Decorado','Banho Copinha Gourmet','Rosto Ouro','Rosto Fabrizia','Rosto Florata','Rosto Isabela','Rosto Europa','Piso Ouro']
      }
    ]
  }
];
