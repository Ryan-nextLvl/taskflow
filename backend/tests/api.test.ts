import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/app-error.js';
import { buildTestApp, DIAGNOSTICS_TOKEN } from './helpers.js';

describe('API TaskFlow', () => {
  let ctx: ReturnType<typeof buildTestApp>;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  const createTask = (body: Record<string, unknown>) =>
    request(ctx.app).post('/api/tasks').send(body);

  describe('tarefas', () => {
    it('cria, consulta, atualiza e exclui uma tarefa', async () => {
      const created = await createTask({ title: 'Preparar apresentação', priority: 'high' });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ title: 'Preparar apresentação', status: 'todo' });
      const { id } = created.body.data;

      const fetched = await request(ctx.app).get(`/api/tasks/${id}`);
      expect(fetched.status).toBe(200);

      const updated = await request(ctx.app).patch(`/api/tasks/${id}`).send({ status: 'done' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.status).toBe('done');
      expect(updated.body.data.completed_at).not.toBeNull();

      const removed = await request(ctx.app).delete(`/api/tasks/${id}`);
      expect(removed.status).toBe(200);
      expect((await request(ctx.app).get(`/api/tasks/${id}`)).status).toBe(404);
    });

    it('lista com paginação e busca', async () => {
      await createTask({ title: 'Comprar café' });
      await createTask({ title: 'Revisar código' });

      const response = await request(ctx.app).get('/api/tasks?search=caf&pageSize=10');
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
    });

    it('retorna 400 com detalhes por campo para dados inválidos', async () => {
      const response = await createTask({ title: '', status: 'qualquer' });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.map((d: { field: string }) => d.field)).toEqual(
        expect.arrayContaining(['title', 'status']),
      );
    });

    it('retorna 400 para identificador malformado e 404 para inexistente', async () => {
      expect((await request(ctx.app).get('/api/tasks/abc')).status).toBe(400);
      const missing = await request(ctx.app).get('/api/tasks/00000000-0000-4000-8000-000000000000');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('NOT_FOUND');
    });

    it('retorna 400 para JSON malformado', async () => {
      const response = await request(ctx.app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title":');
      expect(response.status).toBe(400);
    });

    it('propaga indisponibilidade do banco como 503 sem detalhes internos', async () => {
      ctx.db.failWith = new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Não foi possível conectar ao banco',
      );
      const response = await request(ctx.app).get('/api/tasks');
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    });
  });

  describe('projetos', () => {
    it('cria projeto e rejeita nome duplicado com 409', async () => {
      const created = await request(ctx.app).post('/api/projects').send({ name: 'Lançamento' });
      expect(created.status).toBe(201);
      const duplicated = await request(ctx.app).post('/api/projects').send({ name: 'lançamento' });
      expect(duplicated.status).toBe(409);
    });

    it('ao excluir projeto, informa quantas tarefas ficaram sem projeto', async () => {
      const project = await request(ctx.app).post('/api/projects').send({ name: 'Lançamento' });
      await createTask({ title: 'Revisar plano de mídia', project_id: project.body.data.id });

      const removed = await request(ctx.app).delete(`/api/projects/${project.body.data.id}`);
      expect(removed.body.data.detachedTasks).toBe(1);
    });
  });

  describe('dashboard com cache Redis', () => {
    it('MISS → HIT → invalidação na escrita → MISS → HIT', async () => {
      const first = await request(ctx.app).get('/api/dashboard/summary');
      expect(first.headers['x-cache']).toBe('MISS');
      expect(first.headers['cache-control']).toBe('no-store');
      expect(first.body.data.totals.total).toBe(0);

      const second = await request(ctx.app).get('/api/dashboard/summary');
      expect(second.headers['x-cache']).toBe('HIT');
      expect(ctx.db.metricQueries).toBe(1);

      const created = await createTask({ title: 'Nova tarefa' });
      expect(created.body.meta.cacheInvalidation).toMatchObject({ ok: true, keysDeleted: 1 });

      const third = await request(ctx.app).get('/api/dashboard/summary');
      expect(third.headers['x-cache']).toBe('MISS');
      expect(third.body.data.totals.total).toBe(1);

      const fourth = await request(ctx.app).get('/api/dashboard/summary');
      expect(fourth.headers['x-cache']).toBe('HIT');
      expect(ctx.db.metricQueries).toBe(2);
    });

    it('com Redis fora do ar responde do banco (BYPASS) e a escrita continua funcionando', async () => {
      ctx.store.goDown();

      const created = await createTask({ title: 'Funciona sem cache' });
      expect(created.status).toBe(201);
      expect(created.body.meta.cacheInvalidation.ok).toBe(false);

      const summary = await request(ctx.app).get('/api/dashboard/summary');
      expect(summary.status).toBe(200);
      expect(summary.headers['x-cache']).toBe('BYPASS');
      expect(summary.body.data.totals.total).toBe(1);
    });
  });

  describe('saúde e diagnóstico', () => {
    it('health indica "degraded" quando só o Redis está fora', async () => {
      ctx.store.goDown();
      const response = await request(ctx.app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.redis.ok).toBe(false);
    });

    it('diagnóstico exige token', async () => {
      expect((await request(ctx.app).get('/api/diagnostics/cache')).status).toBe(401);
      const wrong = await request(ctx.app)
        .get('/api/diagnostics/cache')
        .set('x-diagnostics-token', 'errado');
      expect(wrong.status).toBe(401);
    });

    it('diagnóstico reflete as operações reais do cache', async () => {
      await request(ctx.app).get('/api/dashboard/summary');
      await request(ctx.app).get('/api/dashboard/summary');

      const response = await request(ctx.app)
        .get('/api/diagnostics/cache')
        .set('x-diagnostics-token', DIAGNOSTICS_TOKEN);
      expect(response.status).toBe(200);
      expect(response.body.data.stats).toMatchObject({ hits: 1, misses: 1, hitRate: 50 });
      expect(response.body.data.cache).toMatchObject({
        key: 'taskflow:v1:dashboard:summary',
        ttlSeconds: 60,
        exists: true,
      });
      expect(response.body.data.lastRequest.strategy).toBe('HIT');
    });

    it('invalidação manual pelo painel remove a chave', async () => {
      await request(ctx.app).get('/api/dashboard/summary');
      const response = await request(ctx.app)
        .post('/api/diagnostics/cache/invalidate')
        .set('x-diagnostics-token', DIAGNOSTICS_TOKEN);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ ok: true, keysDeleted: 1 });
      const next = await request(ctx.app).get('/api/dashboard/summary');
      expect(next.headers['x-cache']).toBe('MISS');
    });

    it('rota inexistente retorna 404 em JSON', async () => {
      const response = await request(ctx.app).get('/api/nao-existe');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
