# Sistema de Gestão Hospitalar São Gabriel

Este é um sistema integrado de gestão hospitalar web criado para modernizar e organizar as rotinas de atendimento, estoque e consultas. A plataforma apresenta um painel interativo (Dashboard), módulos de agendamentos, cadastro de pacientes e médicos, controle de estoque da farmácia e emissão de relatórios operacionais.

## Funcionalidades Principais

- **Dashboard Integrada:** Visão em tempo real de pacientes ativos, agendamentos do dia, volume de atendimentos via gráficos visuais, e estado atual do estoque.
- **Gestão de Agendamentos:** Visualização de calendário para consultas e exames, com suporte à alteração de status (Agendado, Em Andamento, Concluído, Cancelado), garantindo a não sobreposição de horários.
- **Gestão de Pacientes & Médicos:** Controle detalhado do corpo clínico e banco de pacientes, com ativação/inativação de perfis.
- **Controle de Estoque (Farmácia):** Monitoramento de medicamentos e insumos por lote, validade e quantidade, emitindo alertas visuais em caso de nível crítico de estoque.
- **Relatórios:** Geração e exportação (em CSV) de métricas gerenciais filtradas por período.
- **Sistema de Permissões (RBAC):** Controle de acessos robusto através do Firebase Auth e Firestore Security Rules para perfis como `admin`, `reception`, `doctor`, `nurse` e `pharmacy`.

## Tecnologias Utilizadas

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide React (Ícones), Recharts (Gráficos), Date-fns.
- **Backend / Infraestrutura:** Firebase (Authentication e Firestore)
- **Construção e Deploy:** Vite

## Estrutura do Projeto

- `/src/components`: Componentes visuais genéricos (Modais, Headers, Botões).
- `/src/pages`: As principais visualizações (Dashboard, Pacientes, Agendamentos, etc).
- `/src/context`: O contexto global da aplicação (App Context) para gerenciar Auth e escutas ao Firebase em tempo real.
- `/src/lib/firebase.ts`: Inicialização das instâncias de conexão do Firebase.
- `/firestore.rules`: Regras de segurança rigorosas aplicadas ao banco de dados Firestore, assegurando o modelo de perfis estabelecido.
