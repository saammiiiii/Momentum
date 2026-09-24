import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_URL || "http://127.0.0.1:4173";
const executablePath =
  process.env.EDGE_PATH ||
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage(),
  errors = [],
  failedResponses = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (
    response.status() >= 400 &&
    new URL(response.url()).origin === new URL(base).origin
  )
    failedResponses.push(`${response.status()} ${response.url()}`);
});
const go = async (route) => {
  await page.evaluate((value) => (location.hash = value), route);
  await expect(page.locator("main#main-content")).toBeVisible();
};
try {
  await page.goto(base);
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await page.getByLabel("Pseudo").fill("Profil Alpha");
  await page.getByLabel("Adresse e-mail").fill("alpha@example.test");
  await page.locator('input[name="password"]').fill("Momentum1234");
  await page.getByLabel("Confirmer le mot de passe").fill("Momentum1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  const recovery = await page.locator(".recovery-code").textContent();
  assert.match(recovery, /^[A-Z2-9-]{29}$/);
  await page.getByRole("button", { name: "Je l’ai noté, continuer" }).click();
  await page.getByRole("button", { name: "Configurer plus tard" }).click();
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();

  await go("hydration");
  await page.getByRole("button", { name: "500 ml", exact: true }).click();
  await page.getByRole("button", { name: "500 ml", exact: true }).click();
  await expect(page.locator(".water-number")).toContainText("1");
  await go("recovery");
  await page.getByLabel("Heures").fill("7");
  await page.getByLabel("Minutes").selectOption("30");
  await page.getByLabel("Qualité ressentie").selectOption("good");
  await page.getByRole("button", { name: "Enregistrer la nuit" }).click();
  await expect(page.getByText("Votre nuit est enregistrée.")).toBeVisible();

  await go("training");
  await page.getByLabel("Choisir une séance").selectOption("push");
  await page
    .getByRole("button", { name: "Commencer la séance", exact: true })
    .click();
  await page
    .getByLabel("Charge série 1 en kg", { exact: true })
    .first()
    .fill("30");
  await page
    .getByLabel("Répétitions série 1", { exact: true })
    .first()
    .fill("10");
  await page
    .getByRole("button", { name: "Valider la série 1", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Terminer et enregistrer" }).click();
  await page.getByRole("button", { name: /Séances enregistrées/ }).click();
  await expect(page.locator(".history-item")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".sidebar")).toBeAttached();
  await go("hydration");
  await expect(page.locator(".water-number")).toContainText("1");
  await go("profile");
  await expect(
    page.getByText("Profil Alpha", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await page.getByRole("button", { name: "Créer un compte" }).click();
  await page.getByLabel("Pseudo").fill("Profil Beta");
  await page.getByLabel("Adresse e-mail").fill("beta@example.test");
  await page.locator('input[name="password"]').fill("Momentum5678");
  await page.getByLabel("Confirmer le mot de passe").fill("Momentum5678");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.getByRole("button", { name: "Je l’ai noté, continuer" }).click();
  await page.getByRole("button", { name: "Configurer plus tard" }).click();
  await go("hydration");
  await expect(page.locator(".water-number")).toContainText("0");
  await go("profile");
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Adresse e-mail").fill("alpha@example.test");
  await page.getByLabel("Code de récupération").fill(recovery);
  await page.locator('input[name="password"]').fill("NouveauPass123");
  await page
    .getByRole("button", { name: "Réinitialiser mon mot de passe" })
    .click();
  await expect(page.locator(".sidebar")).toBeAttached();
  await go("hydration");
  await expect(page.locator(".water-number")).toContainText("1");
  for (const routeName of [
    "dashboard",
    "training",
    "program",
    "progression",
    "weight",
    "nutrition",
    "hydration",
    "recovery",
    "supplements",
    "goals",
    "exercises",
    "profile",
    "advice",
    "accessories",
    "history",
    "statistics",
    "records",
    "global",
    "meals",
    "arms",
    "settings",
  ]) {
    await go(routeName);
    await expect(page.locator("main#main-content h1")).toBeVisible();
    const width = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(
      width.content <= width.viewport + 1,
      `${routeName} must not overflow the mobile viewport`,
    );
  }
  await go("profile");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByLabel("Adresse e-mail").fill("alpha@example.test");
  await page.locator('input[name="password"]').fill("NouveauPass123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator(".sidebar")).toBeAttached();
  await go("dashboard");
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
  await context.setOffline(false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeHidden();
  const desktopWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(desktopWidth.content <= desktopWidth.viewport + 1);
  assert.deepEqual(errors, [], "No uncaught page errors expected");
  assert.deepEqual(
    failedResponses,
    [],
    "Every local asset and route must load successfully",
  );
  console.log(
    "E2E account isolation, recovery, workout, hydration and sleep: OK",
  );
} finally {
  await browser.close();
}
