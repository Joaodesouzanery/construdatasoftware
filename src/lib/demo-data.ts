// Dados mock para modo demo
export const demoObras = [
  {
    id: 'demo-obra-1',
    nome: 'Residencial Park View',
    tipo_obra: 'Residencial',
    localizacao: 'São Paulo - SP',
    status: 'ativa',
    data_inicio: '2025-01-15',
    data_prevista_fim: '2025-12-20',
    latitude: -23.550520,
    longitude: -46.633308,
    user_id: 'demo-user',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'demo-obra-2',
    nome: 'Shopping Center Plaza',
    tipo_obra: 'Comercial',
    localizacao: 'Rio de Janeiro - RJ',
    status: 'ativa',
    data_inicio: '2025-02-01',
    data_prevista_fim: '2026-03-30',
    latitude: -22.906847,
    longitude: -43.172896,
    user_id: 'demo-user',
    created_at: '2025-02-01T10:00:00Z',
    updated_at: '2025-02-01T10:00:00Z'
  },
  {
    id: 'demo-obra-3',
    nome: 'Viaduto Norte',
    tipo_obra: 'Infraestrutura',
    localizacao: 'Brasília - DF',
    status: 'ativa',
    data_inicio: '2024-11-10',
    data_prevista_fim: '2025-08-15',
    latitude: -15.794229,
    longitude: -47.882166,
    user_id: 'demo-user',
    created_at: '2024-11-10T10:00:00Z',
    updated_at: '2024-11-10T10:00:00Z'
  }
];

export const demoProducaoData = [
  {
    id: 'demo-prod-1',
    obra_id: 'demo-obra-1',
    frente_servico: 'Fundação',
    data_registro: '2025-10-15',
    respostas: { quantidade: 45, unidade: 'm³' },
    observacoes: 'Concretagem de sapatas conforme projeto',
    localizacao_gps: '-23.550520, -46.633308',
    responsavel_nome: 'João Silva',
    equipe_nome: 'Equipe A',
    fotos_urls: [],
    videos_urls: [],
    modelo_id: null,
    created_at: '2025-10-15T08:00:00Z',
    updated_at: '2025-10-15T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  },
  {
    id: 'demo-prod-2',
    obra_id: 'demo-obra-1',
    frente_servico: 'Estrutura',
    data_registro: '2025-10-16',
    respostas: { quantidade: 120, unidade: 'm²' },
    observacoes: 'Forma e armação de pilares do 1º pavimento',
    localizacao_gps: '-23.550520, -46.633308',
    responsavel_nome: 'Maria Santos',
    equipe_nome: 'Equipe B',
    fotos_urls: [],
    videos_urls: [],
    modelo_id: null,
    created_at: '2025-10-16T08:00:00Z',
    updated_at: '2025-10-16T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  },
  {
    id: 'demo-prod-3',
    obra_id: 'demo-obra-2',
    frente_servico: 'Alvenaria',
    data_registro: '2025-10-17',
    respostas: { quantidade: 85, unidade: 'm²' },
    observacoes: 'Levantamento de paredes internas',
    localizacao_gps: '-22.906847, -43.172896',
    responsavel_nome: 'Carlos Oliveira',
    equipe_nome: 'Equipe C',
    fotos_urls: [],
    videos_urls: [],
    modelo_id: null,
    created_at: '2025-10-17T08:00:00Z',
    updated_at: '2025-10-17T08:00:00Z',
    obras: { nome: 'Shopping Center Plaza' }
  },
  {
    id: 'demo-prod-4',
    obra_id: 'demo-obra-1',
    frente_servico: 'Fundação',
    data_registro: '2025-10-18',
    respostas: { quantidade: 52, unidade: 'm³' },
    observacoes: 'Concretagem de vigas baldrame',
    localizacao_gps: '-23.550520, -46.633308',
    responsavel_nome: 'João Silva',
    equipe_nome: 'Equipe A',
    fotos_urls: [],
    videos_urls: [],
    modelo_id: null,
    created_at: '2025-10-18T08:00:00Z',
    updated_at: '2025-10-18T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  },
  {
    id: 'demo-prod-5',
    obra_id: 'demo-obra-3',
    frente_servico: 'Terraplanagem',
    data_registro: '2025-10-18',
    respostas: { quantidade: 340, unidade: 'm³' },
    observacoes: 'Escavação e compactação do aterro',
    localizacao_gps: '-15.794229, -47.882166',
    responsavel_nome: 'Pedro Costa',
    equipe_nome: 'Equipe D',
    fotos_urls: [],
    videos_urls: [],
    modelo_id: null,
    created_at: '2025-10-18T08:00:00Z',
    updated_at: '2025-10-18T08:00:00Z',
    obras: { nome: 'Viaduto Norte' }
  },
  {
    id: 'demo-prod-6',
    obra_id: 'demo-obra-1',
    frente_servico: 'Estrutura',
    data_registro: '2025-10-19',
    respostas: { quantidade: 95, unidade: 'm²' },
    observacoes: 'Concretagem de laje do 1º pavimento',
    localizacao_gps: '-23.550520, -46.633308',
    responsavel_nome: 'Maria Santos',
    equipe_nome: 'Equipe B',
    fotos_urls: [],
    videos_urls: [],
    modelo_id: null,
    created_at: '2025-10-19T08:00:00Z',
    updated_at: '2025-10-19T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  }
];

export const demoMetasData = [
  {
    id: 'demo-meta-1',
    obra_id: 'demo-obra-1',
    frente_servico: 'Fundação',
    meta_diaria: 40,
    unidade: 'm³',
    periodo_inicio: '2025-10-15',
    periodo_fim: '2025-11-15',
    created_at: '2025-10-15T08:00:00Z',
    updated_at: '2025-10-15T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  },
  {
    id: 'demo-meta-2',
    obra_id: 'demo-obra-1',
    frente_servico: 'Estrutura',
    meta_diaria: 100,
    unidade: 'm²',
    periodo_inicio: '2025-10-16',
    periodo_fim: '2025-12-20',
    created_at: '2025-10-16T08:00:00Z',
    updated_at: '2025-10-16T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  },
  {
    id: 'demo-meta-3',
    obra_id: 'demo-obra-2',
    frente_servico: 'Alvenaria',
    meta_diaria: 80,
    unidade: 'm²',
    periodo_inicio: '2025-10-17',
    periodo_fim: '2026-01-30',
    created_at: '2025-10-17T08:00:00Z',
    updated_at: '2025-10-17T08:00:00Z',
    obras: { nome: 'Shopping Center Plaza' }
  }
];

export const demoAlertsData = [
  {
    id: 'demo-alert-1',
    tipo_alerta: 'producao_baixa',
    obra_id: 'demo-obra-1',
    condicao: { threshold: 80 },
    destinatarios: ['gestor@construdata.com', 'engenheiro@construdata.com'],
    ativo: true,
    user_id: 'demo-user',
    created_at: '2025-10-15T08:00:00Z',
    updated_at: '2025-10-15T08:00:00Z',
    obras: { nome: 'Residencial Park View' }
  },
  {
    id: 'demo-alert-2',
    tipo_alerta: 'clima_adverso',
    obra_id: null,
    condicao: { rain: true },
    destinatarios: ['operacao@construdata.com'],
    ativo: true,
    user_id: 'demo-user',
    created_at: '2025-10-16T08:00:00Z',
    updated_at: '2025-10-16T08:00:00Z',
    obras: null
  }
];

export const demoRDOsData = [
  {
    id: 'demo-rdo-1',
    obra_id: 'demo-obra-1',
    data: '2025-10-19',
    condicao_terreno: 'seco',
    observacoes_gerais: 'Dia produtivo, todas as equipes trabalhando normalmente',
    localizacao_validada: '-23.550520, -46.633308',
    fotos_validacao: [],
    clima_temperatura: 25,
    clima_umidade: 65,
    clima_vento_velocidade: 12,
    clima_previsao_chuva: false,
    producao_ids: ['demo-prod-1', 'demo-prod-2'],
    created_at: '2025-10-19T18:00:00Z',
    updated_at: '2025-10-19T18:00:00Z'
  }
];

export const demoMaterialRequests = [
  {
    id: 'demo-mat-req-1',
    request_date: '2025-10-18',
    material_name: 'Cimento CP-II 50kg',
    quantity: 100,
    unit: 'saco',
    status: 'aprovado',
    project_id: 'demo-obra-1',
    service_front_id: 'demo-front-1',
    projects: { name: 'Residencial Park View' },
    service_fronts: { name: 'Fundação' }
  },
  {
    id: 'demo-mat-req-2',
    request_date: '2025-10-19',
    material_name: 'Areia média',
    quantity: 15,
    unit: 'm³',
    status: 'pendente',
    project_id: 'demo-obra-1',
    service_front_id: 'demo-front-2',
    projects: { name: 'Residencial Park View' },
    service_fronts: { name: 'Estrutura' }
  }
];

export const demoMaterialControl = [
  {
    id: 'demo-mat-ctrl-1',
    usage_date: '2025-10-18',
    material_name: 'Cimento CP-II 50kg',
    quantity_used: 45,
    unit: 'saco',
    project_id: 'demo-obra-1',
    service_front_id: 'demo-front-1',
    projects: { name: 'Residencial Park View' },
    service_fronts: { name: 'Fundação' }
  },
  {
    id: 'demo-mat-ctrl-2',
    usage_date: '2025-10-19',
    material_name: 'Areia média',
    quantity_used: 8,
    unit: 'm³',
    project_id: 'demo-obra-1',
    service_front_id: 'demo-front-2',
    projects: { name: 'Residencial Park View' },
    service_fronts: { name: 'Estrutura' }
  }
];

export const demoProjects = [
  {
    id: 'demo-project-1',
    name: 'Residencial Park View',
    status: 'active',
    created_at: '2025-01-15T10:00:00Z'
  }
];

export const demoConstructionSites = [
  {
    id: 'demo-site-1',
    name: 'Torre A',
    project_id: 'demo-project-1',
    created_at: '2025-01-15T10:00:00Z'
  }
];

export const demoEmployees = [
  {
    id: 'demo-emp-1',
    name: 'João Silva',
    role: 'Pedreiro',
    department: 'Construção Civil',
    phone: '(11) 99999-1111',
    email: 'joao.silva@exemplo.com',
    company_name: 'Construtora ABC',
    status: 'active',
    project_id: 'demo-project-1',
    construction_site_id: 'demo-site-1',
    created_at: '2025-01-20T10:00:00Z',
    projects: { name: 'Residencial Park View' },
    construction_sites: { name: 'Torre A' }
  },
  {
    id: 'demo-emp-2',
    name: 'Maria Santos',
    role: 'Engenheira Civil',
    department: 'Engenharia',
    phone: '(11) 98888-2222',
    email: 'maria.santos@exemplo.com',
    company_name: 'Construtora ABC',
    status: 'active',
    project_id: 'demo-project-1',
    construction_site_id: 'demo-site-1',
    created_at: '2025-01-21T10:00:00Z',
    projects: { name: 'Residencial Park View' },
    construction_sites: { name: 'Torre A' }
  },
  {
    id: 'demo-emp-3',
    name: 'Carlos Oliveira',
    role: 'Eletricista',
    department: 'Elétrica',
    phone: '(11) 97777-3333',
    email: 'carlos.oliveira@exemplo.com',
    company_name: 'Elétrica XYZ',
    status: 'active',
    project_id: 'demo-project-1',
    construction_site_id: null,
    created_at: '2025-01-22T10:00:00Z',
    projects: { name: 'Residencial Park View' },
    construction_sites: null
  },
  {
    id: 'demo-emp-4',
    name: 'Ana Costa',
    role: 'Mestre de Obras',
    department: 'Construção Civil',
    phone: '(11) 96666-4444',
    email: 'ana.costa@exemplo.com',
    company_name: 'Construtora ABC',
    status: 'active',
    project_id: 'demo-project-1',
    construction_site_id: 'demo-site-1',
    created_at: '2025-01-23T10:00:00Z',
    projects: { name: 'Residencial Park View' },
    construction_sites: { name: 'Torre A' }
  },
  {
    id: 'demo-emp-5',
    name: 'Pedro Almeida',
    role: 'Auxiliar',
    department: 'Construção Civil',
    phone: '(11) 95555-5555',
    email: 'pedro.almeida@exemplo.com',
    company_name: 'Construtora ABC',
    status: 'inactive',
    project_id: 'demo-project-1',
    construction_site_id: null,
    created_at: '2025-01-24T10:00:00Z',
    projects: { name: 'Residencial Park View' },
    construction_sites: null
  }
];

export const demoServiceFronts = [
  {
    id: 'demo-front-1',
    name: 'Fundação',
    project_id: 'demo-project-1',
    description: 'Serviços de fundação e base',
    created_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'demo-front-2',
    name: 'Estrutura',
    project_id: 'demo-project-1',
    description: 'Estrutura de concreto armado',
    created_at: '2025-01-15T10:00:00Z'
  },
  {
    id: 'demo-front-3',
    name: 'Alvenaria',
    project_id: 'demo-project-1',
    description: 'Levantamento de paredes',
    created_at: '2025-01-15T10:00:00Z'
  }
];

export const demoUser = {
  id: 'demo-user',
  email: 'demo@construdata.com',
  user_metadata: {
    name: 'Usuário Demo'
  }
};
