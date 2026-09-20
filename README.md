# Serene · Sistema de Gestão Clínica

Sistema web de gestão clínica e hospitalar construído em React + TypeScript sobre o Firebase.
Cobre o ciclo completo de atendimento: agenda de consultas e exames, prontuário cadastral do
paciente, controle de estoque da farmácia, emissão de documentos em PDF, relatórios gerenciais
e trilha de auditoria — tudo sob um modelo de permissões por perfil (RBAC).

> O nome comercial do produto é **Serene**; a unidade de saúde exibida nos documentos emitidos é
> o **Hospital São Gabriel** (`CLINIC_NAME` em `src/lib/navigation.ts`).

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Perfis de acesso](#perfis-de-acesso)
- [Como executar](#como-executar)
- [Scripts](#scripts)
- [Arquitetura](#arquitetura)
- [Modelo de dados e segurança](#modelo-de-dados-e-segurança)
- [Importação e exportação de planilhas](#importação-e-exportação-de-planilhas)
- [Testes](#testes)
- [Decisões de implementação](#decisões-de-implementação)
- [Correções e melhorias desta revisão](#correções-e-melhorias-desta-revisão)

---

## Funcionalidades

- **Dashboard operacional** — agendamentos do dia, fila de espera, atendimentos em andamento,
  volume dos últimos 7 dias e **alerta de estoque crítico** (saldo abaixo do mínimo, saldo zerado,
  lotes vencidos e lotes a vencer em até 30 dias). O painel muda conforme o perfil: a farmácia vê
  o estoque, e não a agenda com dados de pacientes.
- **Agendamentos** — visão em lista e em calendário semanal, navegação entre semanas,
  reagendamento por arrastar e soltar, busca por paciente ou profissional, prevenção de conflito
  de horário do profissional e cancelamento com motivo obrigatório.
- **Pacientes** — cadastro com validação real de CPF (dígitos verificadores), detecção de
  duplicidade, histórico de atendimentos, resumo em PDF e inativação lógica (o histórico nunca
  é apagado).
- **Estoque da farmácia** — controle por lote e validade, registro de entradas e saídas com
  motivo, filtros por situação e histórico de movimentação por item.
- **Relatórios** — atendimentos do período, produtividade por profissional, cadastro de pacientes
  ativos e posição do estoque, com prévia na tela e exportação em CSV.
- **Trilha de auditoria** — registro somente-acréscimo de ações críticas, com comparação
  "antes/depois" dos dados alterados.
- **Documentos em PDF** — comprovante de agendamento, atestado, receituário e encaminhamento.
- **Gestão de usuários** — criação de contas com perfil, validação de CRM para médicos e bloqueio
  de acesso de contas inativas.

## Perfis de acesso

| Perfil | Dashboard | Pacientes | Agendamentos | Estoque | Relatórios | Usuários |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `reception` | ✅ | ✅ | ✅ | — | ✅ | — |
| `doctor` | ✅ | ✅ | ✅ | — | — | — |
| `pharmacy` | ✅ | — | — | ✅ | — | — |

Dentro do módulo de agendamentos as responsabilidades também são separadas:

- **Recepção e administração** marcam, remarcam e cancelam: `Agendado`, `Confirmado`,
  `Aguardando Atendimento`, `Cancelado`, `Faltou`.
- **Médicos e administração** registram a evolução clínica: `Em Andamento`, `Concluído`,
  `Faltou`, além das observações e do CID-10.
- O status atual de um agendamento sempre aparece na lista de opções, para que abrir o formulário
  nunca altere o registro sem intenção.

## Como executar

Pré-requisitos: Node.js 20+ e um projeto Firebase com Authentication (e-mail/senha) e Firestore.

```bash
npm install
npm run dev      # http://localhost:3000
```

As credenciais do Firebase ficam em `firebase-applet-config.json` (chaves públicas de cliente —
a proteção real dos dados é feita pelas regras do Firestore, em `firestore.rules`).

Para publicar as regras de segurança:

```bash
firebase deploy --only firestore:rules
```

### Primeiro acesso

Toda conta precisa de um documento correspondente em `users/{uid}` com `role` e `status`.
Contas autenticadas **sem** esse documento não recebem mais nenhuma permissão: a aplicação
mostra "Perfil não configurado" e as regras do Firestore negam leitura e escrita. Crie o primeiro
administrador pelo console do Firebase (Authentication + um documento em `users/`); a partir daí
os demais usuários são cadastrados pela tela **Usuários**.

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | Verificação de tipos (`tsc --noEmit`, modo `strict`) |
| `npm run test` | Testes unitários e de componente (Vitest) |
| `npm run test:watch` | Testes em modo observador |
| `npm run check` | `lint` + `test` — use antes de abrir um PR |

## Arquitetura

```
src/
├── components/
│   ├── layout/        Sidebar, Header e Layout (gaveta responsiva)
│   └── ui/            Modal acessível, ConfirmModal, Toast, Importar/Exportar
├── context/
│   └── AppContext     Sessão, perfil, assinaturas em tempo real e escritas
├── hooks/
│   └── useInfiniteScroll
├── lib/
│   ├── appointments   Status, conflitos de agenda e permissões por perfil
│   ├── csv            Escape RFC 4180 e download de arquivos
│   ├── date           Datas locais (AAAA-MM-DD sem deslocamento de fuso)
│   ├── firebase       Instâncias do app, Auth e Firestore
│   ├── firebase-errors Tradução de erros para mensagens ao usuário
│   ├── id             Geração de IDs compatíveis com as regras
│   ├── inventory      Saúde do estoque (saldo e validade)
│   ├── navigation     Fonte única de rotas, perfis e títulos
│   ├── pdf            Documentos clínicos (carregado sob demanda)
│   ├── reports        Períodos e montagem dos relatórios
│   ├── spreadsheet    Importação/exportação XLSX e CSV (sob demanda)
│   ├── theme          Tema claro/escuro
│   └── validators     CPF, CRM, telefone e data de nascimento
├── pages/             Dashboard, Pacientes, Agendamentos, Estoque, Relatórios, Usuários
└── types/             Contratos de domínio compartilhados
```

**Regras que o código segue:**

- Nenhuma data de negócio passa por `new Date('AAAA-MM-DD')` — sempre por `src/lib/date.ts`.
  Essas strings representam um dia do calendário local, e a conversão direta as trata como UTC.
- Toda regra de negócio testável (conflito de agenda, alerta de estoque, período de relatório,
  validação de documento) vive em `src/lib/`, fora dos componentes.
- Escritas no Firestore retornam `Promise` e falham com `AppError`; as páginas traduzem o erro
  em um aviso visível (nunca em `alert()` nem em silêncio).
- A navegação, os perfis com acesso e os títulos das páginas vêm de `src/lib/navigation.ts`.

## Modelo de dados e segurança

Coleções: `users`, `patients`, `doctors`, `appointments`, `inventory`, `reportLogs`, `auditLogs`.
O contrato de cada uma está em `firebase-blueprint.json` e é imposto por `firestore.rules`.

Pontos centrais das regras:

- **Sem perfil, sem acesso.** Leituras exigem um documento em `users/{uid}`; escritas exigem que
  ele não esteja `inactive`.
- **Imutabilidade.** `cpf` e `birthDate` do paciente, `crm` do profissional e `patientId` do
  agendamento não podem ser alterados depois de criados — a interface desabilita esses campos
  em vez de deixar o usuário tentar e falhar.
- **Privacidade.** A lista de usuários (com CPF e contato) é visível apenas para administradores;
  cada pessoa lê o próprio perfil. A trilha de auditoria é filtrada por autor para não
  administradores.
- **Auditoria somente-acréscimo.** Registros de auditoria não podem ser alterados nem removidos,
  nem pelo administrador.
- **Exclusão lógica.** Nenhuma tela apaga documentos; entidades são inativadas para preservar
  histórico.

## Importação e exportação de planilhas

Pacientes, agendamentos, estoque e usuários aceitam importação de `.xlsx` e `.csv` (até 5 MB).
Os cabeçalhos são reconhecidos em português ou inglês, sem diferenciar maiúsculas e acentos
(`Nome`, `nome`, `name`). Cada linha é validada individualmente: as válidas são gravadas e as
demais são relatadas com o número da linha e o motivo — uma linha ruim não interrompe a
importação. Em agendamentos, paciente e profissional podem ser referenciados por ID, CPF/CRM ou
nome exato. Para criar usuários, a planilha **precisa** conter uma senha com no mínimo 6
caracteres para cada linha.

## Testes

```bash
npm run test
```

A suíte cobre as regras de negócio e os componentes de interface mais sensíveis:
validação de CPF/CRM, datas locais, conflitos de agenda e permissões de status, saúde do estoque,
filtro de período dos relatórios, escape de CSV, rolagem infinita, acessibilidade do modal,
navegação por perfil e os cartões do dashboard.

Os roteiros de teste manual ponta a ponta estão em [`TEST_SCENARIOS.md`](./TEST_SCENARIOS.md) e a
lista de payloads maliciosos usada para conferir as regras, em [`security_spec.md`](./security_spec.md).

## Decisões de implementação

- **Documentos e planilhas sob demanda.** `jspdf` e `xlsx` somam cerca de 1 MB e só são baixados
  quando alguém emite um PDF ou importa/exporta uma planilha. As páginas internas também entram
  por *code splitting*.
- **Avisos não bloqueantes.** Um provedor de *toasts* substitui os `alert()`, que travavam a aba
  e não diziam o que fazer em seguida.
- **Relatórios verificáveis.** O conteúdo de cada relatório é montado por funções puras em
  `src/lib/reports.ts`, o que permite testar o recorte de período sem subir a interface.
- **Dependências herdadas do scaffold.** `express`, `dotenv` e `@google/genai` continuam no
  `package.json` porque fazem parte do runtime de hospedagem do AI Studio; nenhum código da
  aplicação os utiliza.

## Correções e melhorias desta revisão

### Bugs de dados corrigidos

- **Médico salvava e destruía o agendamento.** Campos desabilitados não entram no `FormData`;
  como o formulário lia tudo dele, alterar apenas o status gravava `patientId`, `date` e `time`
  vazios. Cada campo agora recai sobre o valor já persistido.
- **CID-10 nunca era salvo.** O campo existia no formulário, mas ficava de fora do objeto enviado
  ao Firestore — e as regras também não o aceitavam.
- **Status trocado sem intenção.** A lista de status do médico não incluía o status atual, então o
  `<select>` caía na primeira opção e salvar mudava o registro.
- **Quatro dos sete status não tinham cor.** O mapa de estilos cobria apenas três, e as etiquetas
  saíam com `className="... undefined"`.
- **Regras rejeitavam operações legítimas.** `firestore.rules` só aceitava 3 status, desconhecia
  `cid10`, bloqueava a edição da descrição clínica do paciente, exigia exatamente 6 campos no
  cadastro do profissional (a aplicação grava 7) e impedia a farmácia de corrigir nome, lote e
  validade. Como os erros eram engolidos, a gravação falhava em silêncio.
- **Datas com um dia a menos.** Nascimento, validade e "hoje" eram convertidos com
  `new Date('AAAA-MM-DD')`/`toISOString()`, que interpretam a string como UTC — em fusos negativos
  isso exibe o dia anterior e, após as 21h, mostrava a agenda do dia seguinte.
- **Histórico do estoque com rótulo errado.** A tela comparava com as ações `UPDATE` e
  `STOCK_WITHDRAW`, que nunca eram gravadas: toda linha aparecia como "Atualização".
- **Baixas sem rastro.** Reduzir a quantidade pelo formulário de edição não gerava registro de
  auditoria; apenas as entradas eram registradas.
- **Farmácia reativava itens sem querer.** O seletor de status só é renderizado para o admin e o
  valor ausente virava `'active'`, reativando itens inativos a cada edição.
- **Período dos relatórios era decorativo.** O filtro era gravado como texto no log e o CSV
  exportava a base inteira; o relatório de "pacientes ativos" incluía inativos.
- **CSV corrompido por aspas e vírgulas.** A exportação concatenava strings sem escape. Agora
  segue a RFC 4180.
- **CPF aceito sem validação real.** A checagem via *regex* olhava só a máscara, então
  `111.111.111-11` entrava no prontuário. Passou a validar os dígitos verificadores e a detectar
  duplicidade de cadastro.
- **CRM nunca era validado.** `validateCRM` existia no projeto, mas não era chamado em lugar algum.
- **Contas inativas continuavam entrando.** O cadastro permitia bloquear um usuário, mas nada
  verificava isso no login — agora a aplicação e as regras barram o acesso.
- **Acesso presumido.** Autenticados sem documento de perfil recebiam o papel `reception` por
  padrão.
- **Dados sensíveis no erro.** O tratador montava um JSON com uid, e-mail e provedores do usuário
  e o lançava como mensagem, chegando a aparecer em `alert()` na tela.
- **Erros de leitura travavam a tela.** O contador de carregamento só avançava no caminho feliz:
  uma coleção negada pelas regras deixava a interface em esqueleto indefinidamente.
- **Campo inexistente na importação.** A importação de pacientes gravava `address`, ausente do
  tipo e do contrato do banco.
- **Vazamentos e obsolescências.** `URL.createObjectURL` sem `revoke`, `IntersectionObserver` sem
  desconexão, `FileReader.readAsBinaryString` e `String.prototype.substr` (IDs aleatórios agora
  usam `crypto.randomUUID`).

### Verificação de tipos

`@types/react` e `@types/react-dom` não estavam instalados: sem eles todo JSX era `any` e
`npm run lint` passava mesmo com erros reais. Com os tipos instalados e o `strict` do TypeScript
ligado, os erros latentes apareceram e foram corrigidos.

### UI/UX

- Menu lateral utilizável no celular (gaveta), com opção de fixar no desktop e navegação por teclado.
- Diálogos com `role="dialog"`, fechamento por Esc, foco preso e devolvido, rolagem de fundo
  travada e empilhamento correto (só o diálogo do topo responde ao Esc).
- Barras de rolagem voltaram a ser visíveis: a regra global `::-webkit-scrollbar { display: none }`
  escondia a única pista de que havia mais conteúdo abaixo.
- Títulos do cabeçalho derivados da rota (antes o título era fixo, apontava para `/medicos`,
  removida, e desconhecia `/usuarios`).
- Avisos em *toast*, com mensagens que explicam a causa, no lugar dos `alert()`.
- Validação com destaque no campo, máscara de CPF durante a digitação e campos imutáveis
  desabilitados com a explicação do motivo.
- Alerta de estoque crítico no dashboard e filtros por pendência na farmácia.
- Prévia do relatório antes do download e exportação em XLSX ou CSV.
- Calendário com navegação entre semanas, semana completa e horários fora do expediente quando
  houver agendamentos neles.
- Login com `autocomplete`, alternância de visibilidade da senha e mensagens de erro anunciadas
  por leitores de tela.
- Documento em `pt-BR`, descrição, favicon corrigido e rota 404 tratada.
