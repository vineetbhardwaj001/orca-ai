import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { getSessionUser } from "../auth/session.js";
import { PROJECT_ARCHIVE_ROLES, PROJECT_WRITE_ROLES } from "./access.js";

export const projectsRouter = Router();

const uuidSchema = z.string().uuid();
const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
});
const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required");

async function requireUser(req: Request, res: Response) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
    return null;
  }
  return user;
}

projectsRouter.get("/:organizationId/projects", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const organizationId = uuidSchema.safeParse(req.params.organizationId);
    if (!organizationId.success) return res.status(400).json({ success: false, error: { code: "INVALID_ORGANIZATION_ID", message: "Organization ID is invalid." } });
    const result = await getPool().query(
      `SELECT p.id, p.organization_id, p.name, p.description, p.status, p.created_at, p.updated_at
         FROM projects p
         JOIN organization_members m ON m.organization_id = p.organization_id
        WHERE p.organization_id = $1 AND m.user_id = $2 AND m.status = 'active'
          AND p.status = 'active'
        ORDER BY p.created_at DESC`,
      [organizationId.data, user.id],
    );
    return res.status(200).json({ success: true, data: { projects: result.rows } });
  } catch (error) { return next(error); }
});

projectsRouter.post("/:organizationId/projects", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const organizationId = uuidSchema.safeParse(req.params.organizationId);
    const body = createProjectSchema.safeParse(req.body);
    if (!organizationId.success) return res.status(400).json({ success: false, error: { code: "INVALID_ORGANIZATION_ID", message: "Organization ID is invalid." } });
    if (!body.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Please check the project fields." } });
    const result = await getPool().query(
      `INSERT INTO projects (organization_id, name, description, created_by)
       SELECT $1, $3, $4, $2
        WHERE EXISTS (
          SELECT 1 FROM organization_members
           WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
             AND role = ANY($5::varchar[])
        )
       RETURNING id, organization_id, name, description, status, created_at, updated_at`,
      [organizationId.data, user.id, body.data.name, body.data.description, [...PROJECT_WRITE_ROLES]],
    );
    if (!result.rows[0]) return res.status(403).json({ success: false, error: { code: "PROJECT_CREATE_FORBIDDEN", message: "You do not have permission to create projects in this organization." } });
    return res.status(201).json({ success: true, data: { project: result.rows[0] } });
  } catch (error) { return next(error); }
});

projectsRouter.get("/:organizationId/projects/:projectId", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const organizationId = uuidSchema.safeParse(req.params.organizationId);
    const projectId = uuidSchema.safeParse(req.params.projectId);
    if (!organizationId.success || !projectId.success) return res.status(400).json({ success: false, error: { code: "INVALID_RESOURCE_ID", message: "Organization or project ID is invalid." } });
    const result = await getPool().query(
      `SELECT p.id, p.organization_id, p.name, p.description, p.status, p.created_at, p.updated_at
         FROM projects p
         JOIN organization_members m ON m.organization_id = p.organization_id
        WHERE p.id = $1 AND p.organization_id = $2 AND m.user_id = $3
          AND m.status = 'active' AND p.status = 'active'
        LIMIT 1`,
      [projectId.data, organizationId.data, user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project was not found." } });
    return res.status(200).json({ success: true, data: { project: result.rows[0] } });
  } catch (error) { return next(error); }
});

projectsRouter.patch("/:organizationId/projects/:projectId", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const organizationId = uuidSchema.safeParse(req.params.organizationId);
    const projectId = uuidSchema.safeParse(req.params.projectId);
    const body = updateProjectSchema.safeParse(req.body);
    if (!organizationId.success || !projectId.success) return res.status(400).json({ success: false, error: { code: "INVALID_RESOURCE_ID", message: "Organization or project ID is invalid." } });
    if (!body.success) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Provide at least one valid project field." } });
    const result = await getPool().query(
      `UPDATE projects p
          SET name = COALESCE($4, p.name),
              description = COALESCE($5, p.description),
              updated_at = now()
         FROM organization_members m
        WHERE p.id = $1 AND p.organization_id = $2
          AND m.organization_id = p.organization_id AND m.user_id = $3
          AND m.status = 'active' AND m.role = ANY($6::varchar[])
          AND p.status = 'active'
       RETURNING p.id, p.organization_id, p.name, p.description, p.status, p.created_at, p.updated_at`,
      [projectId.data, organizationId.data, user.id, body.data.name ?? null, body.data.description ?? null, [...PROJECT_WRITE_ROLES]],
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: "PROJECT_NOT_FOUND_OR_FORBIDDEN", message: "Project was not found or cannot be updated by this account." } });
    return res.status(200).json({ success: true, data: { project: result.rows[0] } });
  } catch (error) { return next(error); }
});

projectsRouter.post("/:organizationId/projects/:projectId/archive", async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const organizationId = uuidSchema.safeParse(req.params.organizationId);
    const projectId = uuidSchema.safeParse(req.params.projectId);
    if (!organizationId.success || !projectId.success) return res.status(400).json({ success: false, error: { code: "INVALID_RESOURCE_ID", message: "Organization or project ID is invalid." } });
    const result = await getPool().query(
      `UPDATE projects p SET status = 'archived', updated_at = now()
         FROM organization_members m
        WHERE p.id = $1 AND p.organization_id = $2
          AND m.organization_id = p.organization_id AND m.user_id = $3
          AND m.status = 'active' AND m.role = ANY($4::varchar[])
          AND p.status = 'active'
       RETURNING p.id, p.organization_id, p.name, p.description, p.status, p.created_at, p.updated_at`,
      [projectId.data, organizationId.data, user.id, [...PROJECT_ARCHIVE_ROLES]],
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: "PROJECT_NOT_FOUND_OR_FORBIDDEN", message: "Project was not found or cannot be archived by this account." } });
    return res.status(200).json({ success: true, data: { project: result.rows[0] } });
  } catch (error) { return next(error); }
});
