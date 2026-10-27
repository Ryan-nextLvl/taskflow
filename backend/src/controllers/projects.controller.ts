import type { RequestHandler } from 'express';
import { idParamSchema } from '../schemas/common.js';
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schemas.js';
import type { ProjectsService } from '../services/projects.service.js';

export function createProjectsController(service: ProjectsService) {
  const list: RequestHandler = async (_req, res) => {
    res.json({ data: await service.list() });
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: await service.get(id) });
  };

  const create: RequestHandler = async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const { project, invalidation } = await service.create(input);
    res.status(201).json({ data: project, meta: { cacheInvalidation: invalidation } });
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateProjectSchema.parse(req.body);
    const { project, invalidation } = await service.update(id, input);
    res.json({ data: project, meta: { cacheInvalidation: invalidation } });
  };

  const remove: RequestHandler = async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { detachedTasks, invalidation } = await service.delete(id);
    res.json({ data: { id, detachedTasks }, meta: { cacheInvalidation: invalidation } });
  };

  return { list, get, create, update, remove };
}
