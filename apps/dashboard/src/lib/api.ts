import { z } from "zod";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});
const organizationSchema = z.object({
  organization_id: z.string().uuid(),
  organization_name: z.string(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});
export const projectSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
  updated_at: z.string(),
});
const envelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }).optional(),
});

export type User = z.infer<typeof userSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CurrentSession = { user: User; organizations: Organization[] };

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(code: string, message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function request<T>(
  path: string,
  responseSchema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body !== undefined) headers.set("content-type", "application/json");

  const response = await fetch("/api/v1" + path, {
    ...init,
    headers,
    credentials: "include",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("INVALID_RESPONSE", "The API returned an unreadable response.", response.status);
  }

  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) {
    throw new ApiError("INVALID_RESPONSE", "The API response did not match the expected contract.", response.status);
  }
  if (!response.ok || !envelope.data.success) {
    throw new ApiError(
      envelope.data.error?.code ?? "REQUEST_FAILED",
      envelope.data.error?.message ?? "The request could not be completed.",
      response.status,
      envelope.data.error?.requestId,
    );
  }

  const parsed = responseSchema.safeParse(envelope.data.data);
  if (!parsed.success) {
    throw new ApiError("INVALID_RESPONSE", "The API response data did not match the expected contract.", response.status);
  }
  return parsed.data;
}

const currentSessionSchema = z.object({
  user: userSchema,
  organizations: z.array(organizationSchema),
});
const registerResponseSchema = z.object({
  user: userSchema,
  organizationId: z.string().uuid(),
});
const loginResponseSchema = z.object({ user: userSchema });
const logoutResponseSchema = z.object({ loggedOut: z.literal(true) });
const projectsResponseSchema = z.object({ projects: z.array(projectSchema) });
const projectResponseSchema = z.object({ project: projectSchema });

export function getCurrentSession(signal?: AbortSignal): Promise<CurrentSession> {
  return request("/auth/me", currentSessionSchema, { signal });
}

export function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}): Promise<z.infer<typeof registerResponseSchema>> {
  return request("/auth/register", registerResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginAccount(input: { email: string; password: string }): Promise<z.infer<typeof loginResponseSchema>> {
  return request("/auth/login", loginResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutAccount(): Promise<z.infer<typeof logoutResponseSchema>> {
  return request("/auth/logout", logoutResponseSchema, { method: "POST", body: JSON.stringify({}) });
}

export function listProjects(organizationId: string, signal?: AbortSignal): Promise<Project[]> {
  return request(
    "/organizations/" + encodeURIComponent(organizationId) + "/projects",
    projectsResponseSchema,
    { signal },
  ).then((result) => result.projects);
}

export function getProject(organizationId: string, projectId: string, signal?: AbortSignal): Promise<Project> {
  return request(
    "/organizations/" + encodeURIComponent(organizationId) + "/projects/" + encodeURIComponent(projectId),
    projectResponseSchema,
    { signal },
  ).then((result) => result.project);
}

export function createProject(
  organizationId: string,
  input: { name: string; description: string },
): Promise<Project> {
  return request(
    "/organizations/" + encodeURIComponent(organizationId) + "/projects",
    projectResponseSchema,
    { method: "POST", body: JSON.stringify(input) },
  ).then((result) => result.project);
}

export function updateProject(
  organizationId: string,
  projectId: string,
  input: { name: string; description: string },
): Promise<Project> {
  return request(
    "/organizations/" + encodeURIComponent(organizationId) + "/projects/" + encodeURIComponent(projectId),
    projectResponseSchema,
    { method: "PATCH", body: JSON.stringify(input) },
  ).then((result) => result.project);
}

export function archiveProject(organizationId: string, projectId: string): Promise<Project> {
  return request(
    "/organizations/" + encodeURIComponent(organizationId) + "/projects/" + encodeURIComponent(projectId) + "/archive",
    projectResponseSchema,
    { method: "POST", body: JSON.stringify({}) },
  ).then((result) => result.project);
}
