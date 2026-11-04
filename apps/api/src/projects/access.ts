export const PROJECT_WRITE_ROLES = ["owner", "admin", "member"] as const;
export const PROJECT_ARCHIVE_ROLES = ["owner", "admin"] as const;

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

export function canReadProjects(role: OrganizationRole): boolean {
  return ["owner", "admin", "member", "viewer"].includes(role);
}
export function canWriteProjects(role: OrganizationRole): boolean {
  return PROJECT_WRITE_ROLES.includes(role as (typeof PROJECT_WRITE_ROLES)[number]);
}
export function canArchiveProjects(role: OrganizationRole): boolean {
  return PROJECT_ARCHIVE_ROLES.includes(role as (typeof PROJECT_ARCHIVE_ROLES)[number]);
}
