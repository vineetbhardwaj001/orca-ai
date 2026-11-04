import { expect, test } from "@playwright/test";

test("registers, manages a project, signs out and signs back in", async ({ page }) => {
  const unique = String(Date.now());
  const email = "orca-e2e-" + unique + "@example.test";
  const password = "StrongPassphrase123!";
  const projectName = "ORCA acceptance " + unique;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to ORCA" })).toBeVisible();

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Your name").fill("ORCA E2E Owner");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Workspace name").fill("ORCA E2E Workspace");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();

  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Description", { exact: false }).fill("Created through the real dashboard API.");
  await page.getByRole("button", { name: "Create project" }).click();

  const projectRow = page.getByRole("button", { name: new RegExp(projectName) });
  await expect(projectRow).toBeVisible();
  await projectRow.click();
  await expect(page.getByRole("heading", { name: "Manage project" })).toBeVisible();

  await page.getByLabel("Project name").last().fill(projectName + " updated");
  await page.getByLabel("Project description").fill("Updated through the dashboard.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByLabel("Project name").last()).toHaveValue(projectName + " updated");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive project" }).click();
  await expect(page.getByText("No projects yet")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to ORCA" })).toBeVisible();
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();
});
