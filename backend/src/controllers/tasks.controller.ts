import type { RequestHandler } from 'express';
import { idParamSchema } from '../schemas/common.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '../schemas/task.schemas.js';
import type { TasksService } from '../services/tasks.service.js';

export function createTasksController(service: TasksService) {
  const list: RequestHandler = async (req, res) => {
    const query = listTasksQuerySchema.parse(req.query);
    const { items, total } = await service.list(query);
    res.json({
      data: items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    });
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await service.get(id) });
  };

  const history: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await service.getHistory(id) });
  };

  const create: RequestHandler = async (req, res) => {
    const input = createTaskSchema.parse(req.body);
    const { task, invalidation } = await service.create(input);
    res.status(201).json({ data: task, meta: { cacheInvalidation: invalidation } });
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateTaskSchema.parse(req.body);
    const { task, invalidation } = await service.update(id, input);
    res.json({ data: task, meta: { cacheInvalidation: invalidation } });
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { invalidation } = await service.delete(id);
    res.json({ data: { id }, meta: { cacheInvalidation: invalidation } });
  };

  return { list, get, history, create, update, remove };
}
