## Objetivo

Adicionar o tipo de prova **UFPR – Universidade Federal do Paraná** (80 questões objetivas A–D, peso 1) no seletor de "Tipo de Prova", e garantir que o **modelo Excel de importação para correção** seja gerado corretamente para esse novo preset.

Os pesos por campus (Curitiba: Biologia e Português peso 2; Toledo: Biologia e Química peso 2) serão tratados depois, na camada de boletins de desempenho — fora deste passo.

## Sem alterações no banco

Nenhuma migração. O preset usa apenas tabelas/colunas existentes (`templates`, `template_questions`, `question_type = 'objective'`, `language_variant` para Inglês/Espanhol). **Nenhum dado existente é perdido ou alterado.**

## Mudanças de código

### 1. `src/lib/exam-presets.ts` — novo preset `ufpr`

Adicionar ao objeto `EXAM_PRESETS`:

- `totalQuestions: 80`
- `alternatives: ["A", "B", "C", "D"]`
- `subjects` na ordem do edital:
  - Português 10
  - Biologia 8
  - Física 8
  - Geografia 8
  - História 8
  - Matemática 8
  - Química 8
  - Língua Estrangeira 7 *(gera duas linhas por questão: Inglês e Espanhol, padrão já usado no ACAFE)*
  - Literatura Brasileira 5
  - Filosofia 5
  - Sociologia 5

Total = 80. Todas `question_type: "objective"`, peso 1 (padrão de `generatePresetQuestions`).

### 2. `src/pages/Templates.tsx` — opção no Select

Acrescentar `<SelectItem value="ufpr">UFPR</SelectItem>` no select de "Tipo de Prova". A lógica existente já preenche o total de questões e cria automaticamente as `template_questions` via `generatePresetQuestions`.

### 3. Modelo Excel para importação

O fluxo de correção em `src/pages/Correct.tsx` **já possui** o botão **"Baixar modelo"** (`downloadTemplate`), que gera uma planilha `.xlsx` com:

- Cabeçalhos fixos: `ID`, `E-mail`, `Nome`, `Sede`, `Idioma escolhido`
- Uma coluna por questão: `Questão 01` … `Questão NN` (usa `template.total_questions`)
- Coluna final `Redação`

Como o preset UFPR define `total_questions = 80`, o modelo Excel passa a ser gerado automaticamente com **80 colunas de questões** (A–D) + colunas fixas + Redação, sem precisar de novo código.

Ajustes verificados (sem mudança de código necessária):
- Importação aceita `.xlsx`, `.xls` e `.csv` (já implementado).
- Coluna **"Idioma escolhido"** já é usada para resolver Inglês × Espanhol nas questões de Língua Estrangeira no `recalculate.ts`.

## Validação manual

1. Criar gabarito com tipo **UFPR** → conferir 80 questões com a distribuição correta (e duas linhas de Língua Estrangeira por número de questão: Inglês e Espanhol).
2. Em **Correção**, selecionar o gabarito UFPR → clicar em **Baixar modelo** → abrir o `.xlsx` e conferir cabeçalhos: `ID, E-mail, Nome, Sede, Idioma escolhido, Questão 01 … Questão 80, Redação`.
3. Importar a planilha preenchida e conferir que a correção roda normalmente.

## Fora deste escopo

- Pesos por campus (Curitiba/Toledo) na pontuação final → será feito depois nos boletins, sem alterar o gabarito base.
- Layout de boletim específico UFPR.
