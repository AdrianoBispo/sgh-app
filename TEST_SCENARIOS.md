# Cenários de Teste - Sistema de Gestão Hospitalar

Este documento descreve os principais fluxos de testes de ponta a ponta (E2E) para garantir a integridade do sistema, focando nas regras de negócio e nas permissões (RBAC).

## Cenário 1: Autenticação e Autorização (RBAC)
- **CT01.01 (Login Admin):** Realizar login com um usuário `admin`. Verificar se todas as páginas estão acessíveis e se todas as ações (adição, edição, exclusão lógica) estão habilitadas.
- **CT01.02 (Restrição de Recepção):** Realizar login como `reception`. Entrar no módulo de Estoque e garantir que os botões de adicionar e editar itens de farmácia estejam ocultos ou desabilitados (apenas leitura).
- **CT01.03 (Restrição do Médico):** Realizar login como `doctor`. Tentar acessar o formulário de Agendamento/Detalhes de um paciente. Verificar se é possível adicionar anotações médicas ou alterar o status e fechar/cancelar, mas com restrições explícitas em informações centrais (se aplicável).
- **CT01.04 (Criação de Usuário):** Realizar o cadastro de um novo usuário na tela inicial preenchendo o nome. Garantir que o nome, e-mail e função sejam gravados no banco de dados e que o usuário seja autenticado com sucesso e repassado para o painel.

## Cenário 2: Gestão de Agendamentos
- **CT02.01 (Prevenção de Conflito):** Tentar marcar duas consultas com o MESMO médico no MESMO horário. O sistema deve exibir uma mensagem indicando que o horário está indisponível ("Médico já tem agendamento neste horário.").
- **CT02.02 (Conclusão de Consulta no Dashboard):** No Dashboard, ir à lista de 'Agendamentos Hoje', clicar sobre o botão de concluir um agendamento ("Agendado" -> "Concluído") e confirmar na modal. Validar se o status mudou na tabela de agendamentos para Concluído.
- **CT02.03 (Visualização Diária/Semanal):** Validar se o calendário e a tabela de agenda refletem de forma fiel o agendamento salvo no banco (data e hora).

## Cenário 3: Fluxo da Farmácia (Estoque)
- **CT03.01 (Alerta de Estoque Mínimo):** Logar com `pharmacy` ou `admin`. Criar ou alterar um item de estoque reduzindo sua `quantidade` atual para um número <= `minQuantity`. Voltar ao Dashboard e validar a exibição do Card "Alerta de Estoque Crítico".
- **CT03.02 (Estabilidade do Alerta):** Aumentar novamente a quantidade do produto afetado para uma margem segura maior que seu valor mínimo. Certificar-se de que a contagem do "Alerta de Estoque" no Dashboard zera e exibe a mensagem de tranquilidade ("Estoque Dentro da Margem").

## Cenário 4: Cadastro de Pacientes e Médicos
- **CT04.01 (Ativação e Inativação):** Como `admin`, acessar a tela respectiva e desativar um médico ou paciente. Garantir que a entidade agora recebe o selo de inativa ("Inativo"), pois o sistema evita a exclusão física (`delete`) dos documentos por questões de histórico em conformidade com as regras no Firebase (`firestore.rules`).
- **CT04.02 (Edição de Médicos):** Editar a descrição textual de disponibilidade do expediente de um médico visível para a recepção. Testar persistência das informações.

## Cenário 5: Relatórios e Gráficos
- **CT05.01 (Gráficos Dashboard - Recharts):** Entrar na tela de Dashboard e conferir o estado "Carregando..." (skeleton), em seguida confirmar se o gráfico em barras exibe os 7 últimos dias e separa visualmente a métrica de exames e consultas, renderizando a tooltips ao passar o cursor.
- **CT05.02 (Exportação CSV):** Na respectiva tela de Relatórios, gerar um novo relatório do tipo escolhido. Acionar o exportador clicando em "Baixar", para receber e verificar a formatação de separação de vírgula que foi configurada pela lógica da exportação.
