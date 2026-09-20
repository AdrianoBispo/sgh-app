# Cenários de Teste — Serene

Roteiros de teste ponta a ponta (E2E) das regras de negócio e do controle de acesso (RBAC).
As regras automatizadas equivalentes estão em `src/**/*.test.ts(x)` e rodam com `npm run test`.

## Cenário 1 — Autenticação e autorização

- **CT01.01 (Login admin):** entrar como `admin` e verificar que todos os módulos aparecem no menu
  e que as ações de criar, editar e inativar estão habilitadas.
- **CT01.02 (Restrição da recepção):** entrar como `reception`; o módulo de Estoque não deve
  aparecer no menu, e o acesso direto a `/estoque` deve redirecionar ao dashboard.
- **CT01.03 (Restrição do médico):** entrar como `doctor` e abrir um agendamento. Os campos de
  paciente, profissional, data e hora ficam desabilitados; observações, CID-10 e os status
  clínicos (`Em Andamento`, `Concluído`) permanecem editáveis. **Salvar apenas o status não pode
  apagar o paciente, a data nem o horário do agendamento.**
- **CT01.04 (Cadastro de usuário):** como `admin`, criar um usuário pela tela Usuários. A sessão do
  administrador deve continuar ativa após a criação, e o novo acesso deve entrar com a senha
  definida. Criar um médico com CRM fora do padrão `NÚMERO-UF` deve ser recusado.
- **CT01.05 (Conta bloqueada):** marcar um usuário como `Inativo` e tentar entrar com ele. O
  sistema deve exibir "Acesso bloqueado" e não carregar dado algum.
- **CT01.06 (Conta sem perfil):** autenticar uma conta sem documento em `users/`. O sistema deve
  exibir "Perfil não configurado", sem conceder nenhuma permissão.

## Cenário 2 — Agendamentos

- **CT02.01 (Conflito de horário):** marcar duas consultas para o mesmo profissional, no mesmo dia
  e horário. O formulário deve alertar sobre o conflito e bloquear o salvamento. Cancelar o
  primeiro agendamento deve liberar o horário.
- **CT02.02 (Conclusão pelo dashboard):** no dashboard, concluir um atendimento do dia e confirmar
  na modal. O status deve mudar para `Concluído` na agenda.
- **CT02.03 (Calendário e reagendamento):** na visão de calendário, navegar entre semanas e
  arrastar um agendamento para outro horário. Um destino ocupado deve ser recusado com aviso.
- **CT02.04 (CID-10 persistido):** como `doctor`, informar o CID-10 em um atendimento, salvar,
  reabrir o registro e conferir que o valor continua lá e sai no atestado em PDF.
- **CT02.05 (Cancelamento com motivo):** o botão de confirmação só habilita com o motivo
  preenchido, e o texto informado fica registrado nas observações.
- **CT02.06 (Fuso horário):** com o relógio da máquina após as 21h, conferir que "Agendamentos
  hoje" e o filtro de data continuam mostrando o dia corrente local.

## Cenário 3 — Farmácia (estoque)

- **CT03.01 (Alerta de estoque mínimo):** reduzir a quantidade de um item a um valor ≤ `minQuantity`
  e conferir no dashboard o cartão "Alerta de estoque crítico" com o item listado.
- **CT03.02 (Estabilidade do alerta):** elevar a quantidade acima do mínimo e conferir que o
  dashboard volta a exibir "Estoque dentro da margem".
- **CT03.03 (Validade):** cadastrar um lote vencido e outro com validade em menos de 30 dias;
  ambos devem aparecer sinalizados na lista e no alerta, e o filtro "Vencidos ou a vencer" deve
  isolá-los.
- **CT03.04 (Saída com motivo):** registrar uma retirada maior que o saldo — deve ser recusada.
  Registrar uma retirada válida e conferir a linha "Saída de Estoque" na aba Histórico do item.
- **CT03.05 (Ajuste pelo formulário):** reduzir a quantidade pela edição do item e conferir que o
  histórico registra "Ajuste de Estoque" com os valores anterior e novo.
- **CT03.06 (Status preservado):** como `pharmacy`, editar um item inativo. Ele deve continuar
  inativo após salvar.

## Cenário 4 — Pacientes

- **CT04.01 (Validação de CPF):** tentar cadastrar `111.111.111-11` ou outro CPF com dígitos
  verificadores inválidos — deve ser recusado no próprio campo. Tentar repetir um CPF já
  cadastrado deve apontar o paciente existente.
- **CT04.02 (Campos imutáveis):** ao editar um paciente, CPF e data de nascimento aparecem
  desabilitados, com a explicação no topo da modal.
- **CT04.03 (Inativação lógica):** como `admin`, desativar um paciente. Ele recebe o selo
  "Inativo", continua no histórico e some da seleção de novos agendamentos.
- **CT04.04 (Histórico e PDF):** abrir o resumo de um paciente com atendimentos, conferir a ordem
  decrescente por data e gerar o PDF de resumo e os documentos do atendimento.
- **CT04.05 (Datas):** conferir que a data de nascimento exibida é idêntica à cadastrada, sem
  diferença de um dia.

## Cenário 5 — Relatórios e auditoria

- **CT05.01 (Gráfico do dashboard):** conferir o estado de carregamento (esqueleto) e, em seguida,
  o gráfico dos últimos 7 dias separando consultas e exames, com tooltip.
- **CT05.02 (Recorte por período):** gerar o relatório de atendimentos em "Hoje" e em "Últimos 30
  dias". A prévia e o CSV devem conter quantidades diferentes, coerentes com o intervalo exibido.
- **CT05.03 (CSV íntegro):** cadastrar um paciente cujo nome contenha vírgula e aspas, exportar e
  abrir o arquivo em uma planilha — as colunas devem permanecer alinhadas.
- **CT05.04 (Somente ativos):** o relatório de pacientes deve trazer apenas os cadastros ativos.
- **CT05.05 (Auditoria):** como `admin`, abrir a trilha, inspecionar um registro e conferir a
  comparação "antes/depois". Como não administrador, apenas os próprios registros são visíveis.

## Cenário 6 — Interface e acessibilidade

- **CT06.01 (Mobile):** em uma tela de 390 px, abrir e fechar o menu lateral e percorrer os
  módulos sem rolagem horizontal.
- **CT06.02 (Teclado):** abrir uma modal, navegar com Tab (o foco não escapa do diálogo), fechar
  com Esc e conferir que o foco volta ao elemento de origem.
- **CT06.03 (Modais empilhados):** na farmácia, abrir um item e em seguida "Registrar saída";
  pressionar Esc deve fechar apenas o diálogo do topo.
- **CT06.04 (Falha de rede):** com a rede desligada, tentar salvar um registro. Deve aparecer um
  aviso explicando a falha — sem `alert()` e sem perda silenciosa dos dados digitados.
