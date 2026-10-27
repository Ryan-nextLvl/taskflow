# Testes

## Estratégia

| Nível                | Ferramentas                                         | Credenciais       |
| -------------------- | --------------------------------------------------- | ----------------- |
| Unitário e API       | Vitest + Supertest, com dublês de Redis e banco     | Não               |
| Integração com Redis | Vitest contra um Redis real (`REDIS_TEST_URL`)      | Não (Redis local) |
| Ponta a ponta        | Checklist manual abaixo, com Supabase e Redis reais | Sim               |

O dublê de Redis (`backend/tests/fakes/in-memory-cache-store.ts`) reproduz TTL, contador de geração e invalidação, com relógio controlável e simulação de queda e reconexão. O banco em memória implementa as mesmas interfaces de repositório usadas pela API.

## Como executar

```bash
npm test                                   # back-end e front-end
npm run lint && npm run typecheck          # análise estática
REDIS_TEST_URL=redis://localhost:6379/15 npm test -w backend   # inclui integração (use um banco separado)
```

PowerShell: `$env:REDIS_TEST_URL="redis://localhost:6379/15"; npm test -w backend`

## Cobertura

| Arquivo                                               | Casos                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/tests/dashboard-cache.test.ts`               | MISS grava com TTL · HIT sem consultar o banco · invalidação → MISS → HIT · expiração do TTL · BYPASS com Redis fora · invalidação pendente refeita na reconexão · descarte de gravação concorrente · valor corrompido · erro do banco não grava no cache |
| `backend/tests/dashboard-metrics.test.ts`             | Totais e taxa de conclusão · atrasadas, vence hoje e próximos 7 dias · agrupamento diário no fuso configurado · prioridade e projeto                                                                                                                      |
| `backend/tests/schemas.test.ts`                       | Validação de tarefas, projetos e filtros                                                                                                                                                                                                                  |
| `backend/tests/api.test.ts`                           | CRUD · 400, 404, 409 e 503 · JSON inválido · cabeçalho `X-Cache` · BYPASS · health · token do diagnóstico · invalidação manual                                                                                                                            |
| `backend/tests/redis-cache-store.integration.test.ts` | Leitura transacional, script Lua de geração, invalidação e PING em Redis real                                                                                                                                                                             |
| `frontend/src/lib/*.test.ts`                          | Rótulos de prazo, tempo relativo, validação e conversão dos formulários                                                                                                                                                                                   |

## Últimos resultados

```text
npm run lint / typecheck / format:check   sem erros
npm run build                             ok (chunk inicial ≈ 177 KB gzip; páginas sob demanda)

backend                    40 passed | 4 skipped (integração sem REDIS_TEST_URL)
backend + Redis real       44 passed
frontend                   10 passed
```

### Verificação ponta a ponta com Supabase na nuvem

API local apontando para o Supabase (us-east-1) e Redis local:

```text
health                      supabase ok · redis ok
chave pública lendo tasks   42501 permission denied for table tasks
dashboard                   MISS 257.84 ms → HIT 0.69 ms
criar projeto / tarefa      201 · nome duplicado → 409 · título vazio → 400
dashboard                   MISS 420.43 ms → HIT 0.53 ms
concluir tarefa             completed_at preenchido pelo trigger
dashboard                   MISS 164.68 ms → HIT 0.40 ms
leitura direta via REST     dados e eventos (created, completed) persistidos
excluir projeto             tarefa desvinculada · evento "Projeto excluído; tarefa ficou sem projeto"
excluir tarefa              eventos removidos em cascata
```

### Queda e retorno do Redis

```text
Redis no ar        MISS 75.73 ms → HIT 1.76 ms
Redis parado       BYPASS 22.67 ms · /api/health "degraded"
POST /api/tasks    201 · invalidação marcada como pendente
Redis de volta     "reconexão: invalidação pendente" → MISS 25.34 ms → HIT 1.36 ms
```

### Interface

Verificada em Chromium nas larguras 1440, 768 e 390 px:

- Criação pelo formulário com validação.
- Troca de status e histórico.
- Arrastar e soltar no Kanban, com persistência confirmada no banco.
- Painel de diagnóstico.
- Sem rolagem horizontal e sem erros no console.

## Checklist de verificação manual

### Conexões

- [ ] `npm run dev` registra `TaskFlow API em http://localhost:3333/api` e `Redis conectado`.
- [ ] `GET /api/health` → `"status":"ok"` com Supabase e Redis `ok`.
- [ ] Sem `SUPABASE_URL` no `.env`, a API não inicia e aponta a variável ausente.

### Persistência

- [ ] Criar o projeto "Verificação" → linha em `projects` no Table Editor do Supabase.
- [ ] Criar outro com o nome "verificação" → mensagem "Já existe um projeto com esse nome".
- [ ] Criar uma tarefa com prioridade, prazo e projeto → linha em `tasks` e evento `created` em `task_events`.
- [ ] Concluir a tarefa → `status = 'done'`, `completed_at` preenchido e evento `completed`.
- [ ] Reabrir a tarefa → `completed_at` nulo e evento `reopened`.
- [ ] Excluir o projeto → a tarefa continua, com `project_id` nulo.
- [ ] Excluir a tarefa → os eventos dela também são removidos.
- [ ] Reiniciar a API → todos os dados continuam disponíveis.

### Segurança

- [ ] `curl "$SUPABASE_URL/rest/v1/tasks?select=id" -H "apikey: <chave pública>"` → `permission denied`.
- [ ] Aba Network do navegador: requisições apenas para `/api/...`, sem chaves.

### Cache

- [ ] Diagnóstico → Invalidar → Consultar: **MISS**; `redis-cli TTL taskflow:v1:dashboard:summary` entre 1 e 60.
- [ ] Consultar de novo: **HIT** em cerca de 1 ms.
- [ ] Concluir uma tarefa: evento de invalidação no painel; `redis-cli EXISTS taskflow:v1:dashboard:summary` → `0`.
- [ ] Consultar: MISS com o valor novo; consultar de novo: HIT.
- [ ] Aguardar 60 s sem alterações: a próxima consulta é MISS.
- [ ] Parar o Redis: dashboard em **BYPASS**, health `degraded`, escritas funcionando.
- [ ] Religar o Redis: invalidação pendente refeita, depois MISS → HIT.
