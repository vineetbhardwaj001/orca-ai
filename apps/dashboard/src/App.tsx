import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  archiveProject,
  createProject,
  getCurrentSession,
  getProject,
  listProjects,
  loginAccount,
  logoutAccount,
  registerAccount,
  updateProject,
  type CurrentSession,
  type Project,
} from "./lib/api";

const capabilityCards = [
  { symbol: "◎", title: "Discovery", description: "Map pages, routes, controls and API contracts.", status: "Planned" },
  { symbol: "▤", title: "Functional QA", description: "Verify forms, navigation, permissions and user journeys.", status: "Planned" },
  { symbol: "⌁", title: "API QA", description: "Validate schemas, authorization and response behavior.", status: "Planned" },
  { symbol: "◉", title: "Real-time QA", description: "Inspect WebSocket events, ordering and reconnect behavior.", status: "Planned" },
  { symbol: "↗", title: "Performance", description: "Planned k6 scenarios with deterministic virtual users.", status: "Planned" },
  { symbol: "✳", title: "AI exploration", description: "Suggest scenarios and help investigate reproducible findings.", status: "Planned" },
];

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "Your role does not allow this action.";
    if (error.status === 409) return "An account with this email already exists.";
    return error.message;
  }
  if (error instanceof Error && error.name === "AbortError") return "";
  return "ORCA could not reach the API. Check that the API and database are running.";
}

function Capabilities() {
  return (
    <section className="capabilities-section" aria-labelledby="capabilities-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE ORCA ROADMAP</span>
          <h2 id="capabilities-heading">One lab. Multiple testing engines.</h2>
          <p>Deterministic execution and AI-assisted exploration will work together.</p>
        </div>
      </div>
      <div className="capabilities-grid">
        {capabilityCards.map((capability) => (
          <article className="capability-card" key={capability.title}>
            <span className="capability-symbol" aria-hidden="true">{capability.symbol}</span>
            <div className="capability-copy">
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              <span className="planned-label">{capability.status}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function App() {
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [organizationId, setOrganizationId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getCurrentSession(controller.signal)
      .then((current) => {
        setSession(current);
        setOrganizationId(current.organizations[0]?.organization_id ?? "");
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status !== 401) setAuthError(describeError(error));
        else if (!(error instanceof ApiError) && !(error instanceof Error && error.name === "AbortError")) {
          setAuthError(describeError(error));
        }
      })
      .finally(() => setIsCheckingSession(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!session || !organizationId) {
      setProjects([]);
      setSelectedProjectId("");
      setActiveProject(null);
      return;
    }
    const controller = new AbortController();
    setProjectsLoading(true);
    setProjectError("");
    listProjects(organizationId, controller.signal)
      .then((items) => setProjects(items))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setProjectError(describeError(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setProjectsLoading(false);
      });
    return () => controller.abort();
  }, [session, organizationId]);

  useEffect(() => {
    if (!session || !organizationId || !selectedProjectId) {
      setActiveProject(null);
      return;
    }
    const controller = new AbortController();
    getProject(organizationId, selectedProjectId, controller.signal)
      .then((project) => {
        setActiveProject(project);
        setProjectName(project.name);
        setProjectDescription(project.description);
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === "AbortError")) setProjectError(describeError(error));
      });
    return () => controller.abort();
  }, [session, organizationId, selectedProjectId]);

  const selectedOrganization = session?.organizations.find(
    (organization) => organization.organization_id === organizationId,
  );
  const canWriteProjects = ["owner", "admin", "member"].includes(selectedOrganization?.role ?? "");
  const canArchiveProjects = ["owner", "admin"].includes(selectedOrganization?.role ?? "");

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authMode === "register") {
        await registerAccount({ name, email, password, organizationName });
      } else {
        await loginAccount({ email, password });
      }
      const current = await getCurrentSession();
      setSession(current);
      setOrganizationId(current.organizations[0]?.organization_id ?? "");
      setPassword("");
      setAuthMode("login");
    } catch (error) {
      setAuthError(describeError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    try {
      await logoutAccount();
      setSession(null);
      setProjects([]);
      setSelectedProjectId("");
      setActiveProject(null);
      setAuthMode("login");
      setNotice("");
    } catch (error) {
      setAuthError(describeError(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !canWriteProjects) return;
    setProjectBusy(true);
    setProjectError("");
    setNotice("");
    try {
      const project = await createProject(organizationId, {
        name: newProjectName,
        description: newProjectDescription,
      });
      setProjects((current) => [project, ...current]);
      setSelectedProjectId(project.id);
      setNewProjectName("");
      setNewProjectDescription("");
      setNotice("Project created.");
    } catch (error) {
      setProjectError(describeError(error));
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleUpdateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !activeProject || !canWriteProjects) return;
    setProjectBusy(true);
    setProjectError("");
    setNotice("");
    try {
      const updated = await updateProject(organizationId, activeProject.id, {
        name: projectName,
        description: projectDescription,
      });
      setActiveProject(updated);
      setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
      setNotice("Project changes saved.");
    } catch (error) {
      setProjectError(describeError(error));
    } finally {
      setProjectBusy(false);
    }
  }

  async function handleArchiveProject() {
    if (!organizationId || !activeProject || !canArchiveProjects) return;
    if (!window.confirm("Archive " + activeProject.name + "? It will disappear from the active project list.")) return;
    setProjectBusy(true);
    setProjectError("");
    setNotice("");
    try {
      await archiveProject(organizationId, activeProject.id);
      setProjects((current) => current.filter((project) => project.id !== activeProject.id));
      setSelectedProjectId("");
      setActiveProject(null);
      setNotice("Project archived.");
    } catch (error) {
      setProjectError(describeError(error));
    } finally {
      setProjectBusy(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="auth-page">
        <div className="auth-brand"><span className="brand-mark">◈</span><span>ORCA<small>QUALITY LAB</small></span></div>
        <div className="loading-card" role="status">Restoring your secure session…</div>
        <Capabilities />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-page">
        <div className="auth-brand"><span className="brand-mark">◈</span><span>ORCA<small>QUALITY LAB</small></span></div>
        <section className="auth-hero">
          <div className="auth-intro">
            <span className="eyebrow">OMNI-PURPOSE RELIABILITY, COVERAGE & ASSURANCE</span>
            <h1>Know your product.<br /><em>Prove it works.</em></h1>
            <p>Manage your QA workspace, organize products and prepare evidence-backed test operations from one place.</p>
            <div className="trust-points">
              <span><b>01</b> Tenant-isolated workspaces</span>
              <span><b>02</b> Role-aware project access</span>
              <span><b>03</b> Real API-backed data</span>
            </div>
          </div>
          <section className="auth-card" aria-labelledby="auth-heading">
            <span className="eyebrow">{authMode === "register" ? "START YOUR WORKSPACE" : "WELCOME BACK"}</span>
            <h2 id="auth-heading">{authMode === "register" ? "Create your ORCA workspace" : "Sign in to ORCA"}</h2>
            <p className="auth-subtitle">{authMode === "register" ? "Create an account and your first owner workspace." : "Continue to your projects and workspace."}</p>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <>
                  <label htmlFor="auth-name">Your name</label>
                  <input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
                </>
              )}
              <label htmlFor="auth-email">Work email</label>
              <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
              <label htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === "register" ? 12 : 1} maxLength={128} required />
              {authMode === "register" && (
                <>
                  <label htmlFor="auth-organization">Workspace name</label>
                  <input id="auth-organization" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} minLength={2} maxLength={100} required />
                </>
              )}
              {authError && <p className="form-error" role="alert">{authError}</p>}
              <button className="button button-primary button-full" type="submit" disabled={authBusy}>
                {authBusy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "register" ? "Already have an account?" : "New to ORCA?"}
              {" "}
              <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>
                {authMode === "register" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </section>
        </section>
        <Capabilities />
        <footer className="page-footer"><span>ORCA AI · Omni-purpose Reliability, Coverage & Assurance</span><span>0.4.0-alpha.1</span></footer>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="sidebar-brand" href="#overview" aria-label="ORCA overview">
          <span className="brand-mark">◈</span><span>ORCA<small>QUALITY LAB</small></span>
        </a>
        <span className="sidebar-label">WORKSPACE</span>
        <a className="sidebar-link active" href="#overview"><span>⌂</span>Overview</a>
        <a className="sidebar-link" href="#projects"><span>▦</span>Projects</a>
        <span className="sidebar-label sidebar-label-spaced">TESTING ENGINES</span>
        <div className="sidebar-link disabled"><span>◎</span>Discovery <small>Planned</small></div>
        <div className="sidebar-link disabled"><span>▷</span>Execution <small>Planned</small></div>
        <div className="sidebar-link disabled"><span>✳</span>AI exploration <small>Planned</small></div>
        <div className="sidebar-bottom">
          <div className="worker-status"><span className="status-dot" /> Worker execution is not enabled yet</div>
          <div className="sidebar-user"><span className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</span><span className="user-copy"><b>{session.user.name}</b><small>{session.user.email}</small></span></div>
        </div>
      </aside>

      <main className="dashboard-main" id="overview">
        <header className="topbar">
          <div><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-separator">/</span><b>Overview</b></div>
          <div className="topbar-actions">
            {session.organizations.length > 1 && (
              <label className="workspace-select-label">
                <span className="sr-only">Workspace</span>
                <select aria-label="Workspace" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setSelectedProjectId(""); }}>
                  {session.organizations.map((organization) => <option key={organization.organization_id} value={organization.organization_id}>{organization.organization_name}</option>)}
                </select>
              </label>
            )}
            <span className="environment-pill"><span className="status-dot" /> Development</span>
            <button className="button button-quiet" type="button" onClick={handleLogout} disabled={authBusy}>Sign out</button>
          </div>
        </header>

        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">OMNI-PURPOSE RELIABILITY, COVERAGE & ASSURANCE</span>
            <h1>Know your product.<br /><em>Prove it works.</em></h1>
            <p>Start by organizing an authorized product in your workspace. Test execution engines are being built in separate milestones.</p>
          </div>
          <a className="button button-primary" href="#projects">＋ Manage projects</a>
        </section>

        <section className="stats-grid" aria-label="Workspace summary">
          <article className="stat-card"><span>Active projects</span><strong>{projects.length}</strong><small>From your selected workspace</small></article>
          <article className="stat-card"><span>Test runs</span><strong>—</strong><small>Execution engine planned</small></article>
          <article className="stat-card"><span>Verified findings</span><strong>—</strong><small>Evidence workflow planned</small></article>
          <article className="stat-card"><span>Connected workers</span><strong>0</strong><small>Worker execution disabled</small></article>
        </section>

        <section className="projects-section" id="projects">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR WORKSPACE</span>
              <h2>Your projects</h2>
              <p>Create and manage projects. Data is loaded from the ORCA API.</p>
            </div>
            <span className="role-pill">{selectedOrganization?.role ?? "No role"} access</span>
          </div>

          {notice && <p className="notice-message" role="status">{notice}</p>}
          {projectError && <p className="form-error" role="alert">{projectError}</p>}

          <div className="project-workspace">
            <section className="panel project-list-panel" aria-label="Project list">
              <div className="panel-heading"><div><h3>Project directory</h3><span>{projects.length} active {projects.length === 1 ? "project" : "projects"}</span></div></div>
              {canWriteProjects && (
                <form className="create-project-form" onSubmit={handleCreateProject}>
                  <label htmlFor="new-project-name">Project name</label>
                  <input id="new-project-name" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} minLength={2} maxLength={120} placeholder="e.g. Customer portal" required />
                  <label htmlFor="new-project-description">Description <span>Optional</span></label>
                  <textarea id="new-project-description" value={newProjectDescription} onChange={(event) => setNewProjectDescription(event.target.value)} maxLength={1000} rows={3} placeholder="What are you planning to test?" />
                  <button className="button button-primary button-full" type="submit" disabled={projectBusy}>{projectBusy ? "Saving…" : "＋ Create project"}</button>
                </form>
              )}
              {projectsLoading ? <p className="muted-empty">Loading projects…</p> : projects.length === 0 ? (
                <div className="empty-projects"><span>⌘</span><b>No projects yet</b><p>{canWriteProjects ? "Create your first project to get started." : "A workspace admin can create a project for you."}</p></div>
              ) : (
                <div className="project-list">
                  {projects.map((project) => (
                    <button className={"project-row" + (selectedProjectId === project.id ? " selected" : "")} type="button" key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                      <span className="project-icon">◈</span>
                      <span className="project-row-copy"><b>{project.name}</b><small>{project.description || "No description"}</small></span>
                      <span className="project-arrow">›</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="panel project-detail-panel" aria-label="Project details">
              {activeProject ? (
                <form className="project-detail-form" onSubmit={handleUpdateProject}>
                  <div className="panel-heading">
                    <div><span className="eyebrow">PROJECT DETAILS</span><h3>Manage project</h3></div>
                    <span className="active-status"><span className="status-dot" /> Active</span>
                  </div>
                  <label htmlFor="project-name">Project name</label>
                  <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} minLength={2} maxLength={120} required disabled={!canWriteProjects} />
                  <label htmlFor="project-description">Project description</label>
                  <textarea id="project-description" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={1000} rows={5} disabled={!canWriteProjects} />
                  <div className="project-meta">
                    <span>Created</span><b>{new Date(activeProject.created_at).toLocaleString()}</b>
                    <span>Updated</span><b>{new Date(activeProject.updated_at).toLocaleString()}</b>
                    <span>Project ID</span><code>{activeProject.id}</code>
                  </div>
                  <div className="detail-actions">
                    {canWriteProjects && <button className="button button-primary" type="submit" disabled={projectBusy}>{projectBusy ? "Saving…" : "Save changes"}</button>}
                    {canArchiveProjects && <button className="button button-danger-quiet" type="button" onClick={handleArchiveProject} disabled={projectBusy}>Archive project</button>}
                  </div>
                </form>
              ) : (
                <div className="detail-placeholder"><span>◫</span><h3>Select a project</h3><p>Choose a project from the directory to view its details, update its description or archive it based on your role.</p></div>
              )}
            </section>
          </div>
        </section>

        <Capabilities />
        <footer className="page-footer"><span>ORCA AI · Workspace and project control plane</span><span>0.4.0-alpha.1</span></footer>
      </main>
    </div>
  );
}
