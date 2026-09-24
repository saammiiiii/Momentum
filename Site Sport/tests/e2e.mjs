import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { fakeSupabase } from "./supabaseMock.mjs";
import { validateImport } from "../src/storage.js";

// Isolated fake configuration, used only for this test build. No real accounts.
process.env.VITE_SUPABASE_URL = "https://momentum-test.invalid";
process.env.VITE_SUPABASE_ANON_KEY = "sb_publishable_test_only";
const { build, preview } = await import("vite");
const outDir = "test-results/e2e-dist";
await build({ build: { outDir }, logLevel: "warn" });
const server = await preview({ build: { outDir }, preview: { port: 4175, strictPort: true, host: "127.0.0.1" } });
const base = "http://127.0.0.1:4175/";
const executablePath = process.env.EDGE_PATH || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
const browser = await chromium.launch({ executablePath, headless: true });
const backend = fakeSupabase();
const context = await browser.newContext({ viewport: { width:390,height:844 } });
await backend.route(context);
const page = await context.newPage(), errors=[],failedResponses=[];
page.on("pageerror", error=>errors.push(error.message));
page.on("response", response=>{ if(response.status()>=400 && new URL(response.url()).origin===new URL(base).origin)failedResponses.push(response.status()+" "+response.url()); });
const go=async(route)=>{await page.evaluate(value=>location.hash=value,route);await expect(page.locator("main#main-content h1")).toBeVisible();};
const login=async(email,password="Momentum1234")=>{await page.getByLabel("Adresse e-mail").fill(email);await page.locator('input[name="password"]').fill(password);await page.getByRole("button",{name:"Se connecter",exact:true}).click();await expect(page.locator(".sidebar")).toBeAttached();};
const settle=async()=>{await expect(page.locator(".cloud-status").first()).toContainText("Données synchronisées",{timeout:15000});};
const logout=async()=>{await Promise.all([page.waitForEvent("load"),page.getByRole("button",{name:"Se déconnecter"}).click()]);};
const create=async(email,name)=>{
  await page.getByRole("button",{name:"Créer un compte",exact:true}).click();
  await page.getByLabel("Pseudo").fill(name); await page.getByLabel("Adresse e-mail").fill(email);
  await page.locator('input[name="password"]').fill("Momentum1234");
  await page.getByLabel("Confirmer le mot de passe").fill("Different1234");
  await page.getByRole("button",{name:"Créer mon compte"}).click();
  await expect(page.getByRole("alert")).toContainText("ne correspondent pas");
  await page.getByLabel("Confirmer le mot de passe").fill("Momentum1234");
  await page.getByRole("button",{name:"Créer mon compte"}).click();
  await expect(page.getByRole("heading",{name:"Vérifiez votre adresse e-mail"})).toBeVisible();
  await expect(page.locator("main#main-content")).toHaveCount(0);
  await page.getByRole("button",{name:"Renvoyer l’e-mail",exact:true}).click();
  await expect.poll(()=>backend.calls.resend).toBeGreaterThan(0);
  await page.goto(base+backend.callback(email));
  await expect(page.getByRole("heading",{name:"Adresse e-mail confirmée"})).toBeVisible();
  await page.getByRole("button",{name:"Continuer",exact:true}).click();
  await page.getByRole("button",{name:"Configurer plus tard"}).click();await settle();
};
try {
  await page.goto(base+"#dashboard");
  await expect(page.getByRole("heading",{name:"Heureux de vous revoir."})).toBeVisible();
  await create("alpha@example.test","Profil Alpha");
  await go("hydration");
  await page.getByRole("button",{name:"500 ml",exact:true}).click();
  await page.getByRole("button",{name:"500 ml",exact:true}).click();
  await expect(page.locator(".water-number")).toContainText("1");
  await go("recovery");await page.getByLabel("Heures").fill("7");await page.getByLabel("Minutes").selectOption("30");
  await page.getByLabel("Qualité ressentie").selectOption("good");await page.getByRole("button",{name:"Enregistrer la nuit"}).click();
  await expect(page.getByText("Votre nuit est enregistrée.")).toBeVisible();
  await go("weight");await page.getByRole("button",{name:"Ajouter une pesée",exact:true}).click();
  await page.getByLabel("Poids (kg)",{exact:true}).fill("73.2");
  await page.getByRole("dialog").getByRole("button",{name:/Enregistrer/}).click();
  await go("nutrition");await page.getByRole("button",{name:"Ajouter un aliment",exact:true}).first().click();
  await page.getByLabel("Aliment / repas").fill("Repas test");await page.getByLabel("Quantité de la portion").fill("1 portion");
  await page.getByLabel("Protéines de cette portion (g)").fill("30");await page.getByRole("button",{name:"Enregistrer l’aliment"}).click();
  await go("training");await page.getByLabel("Choisir une séance").selectOption("push");
  await page.getByRole("button",{name:"Commencer la séance",exact:true}).click();
  await page.getByLabel("Charge série 1 en kg",{exact:true}).first().fill("30");
  await page.getByLabel("Répétitions série 1",{exact:true}).first().fill("10");
  await page.getByRole("button",{name:"Valider la série 1",exact:true}).first().click();
  await page.getByRole("button",{name:"Terminer et enregistrer"}).click();
  await page.getByRole("button",{name:/Séances enregistrées/}).click();
  await expect(page.locator(".history-item")).toHaveCount(1);await settle();
  await page.reload();await expect(page.locator(".sidebar")).toBeAttached();
  await go("settings");
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Exporter mes données",exact:true}).click();
  const download=await downloadPromise;const text=await readFile(await download.path(),"utf8");const exported=validateImport(JSON.parse(text));
  assert.equal(exported.sessions.length,1);assert.equal(exported.weights.length,1);assert.equal(exported.meals.length,1);
  assert.ok(!/access_token|refresh_token|passwordVerifier|supabase/i.test(text));
  await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(text)});
  await page.getByRole("button",{name:"Remplacer mes données"}).click();
  await expect(page.getByText("Sauvegarde importée. Vos données sont restaurées.")).toBeVisible();await settle();

  // A second device reads the same account from the fake remote, with an empty IndexedDB.
  const device=await browser.newContext({viewport:{width:430,height:932}});await backend.route(device);
  const other=await device.newPage();await other.goto(base);
  await other.getByLabel("Adresse e-mail").fill("alpha@example.test");await other.locator('input[name="password"]').fill("Momentum1234");
  await other.getByRole("button",{name:"Se connecter",exact:true}).click();await expect(other.locator(".sidebar")).toBeAttached();
  await other.evaluate(()=>location.hash="hydration");await expect(other.locator(".water-number")).toContainText("1");
  await device.close();
  await go("profile");await logout();
  await expect(page.getByRole("heading",{name:"Heureux de vous revoir."})).toBeVisible();
  assert.equal(await page.evaluate(()=>localStorage.getItem("momentum.supabase.session")),null);
  await create("beta@example.test","Profil Beta");
  await go("hydration");await expect(page.locator(".water-number")).toContainText("0");
  await go("profile");await logout();
  await page.getByRole("button",{name:"Mot de passe oublié ?"}).click();
  await page.getByLabel("Adresse e-mail").fill("alpha@example.test");
  await page.getByRole("button",{name:"Envoyer le lien de récupération"}).click();
  await expect.poll(()=>backend.calls.recover).toBe(1);
  await page.goto(base+backend.callback("alpha@example.test","recovery"));
  await expect(page.getByRole("heading",{name:"Choisir un nouveau mot de passe"})).toBeVisible();
  await page.reload();await expect(page.getByRole("heading",{name:"Choisir un nouveau mot de passe"})).toBeVisible();
  await page.getByLabel("Nouveau mot de passe",{exact:true}).fill("NouveauPass123");
  await page.getByLabel("Confirmer le mot de passe").fill("NouveauPass123");
  await page.getByRole("button",{name:"Enregistrer le mot de passe"}).click();
  await expect(page.getByRole("heading",{name:"Mot de passe modifié"})).toBeVisible();
  await page.getByRole("button",{name:"Continuer",exact:true}).click();await settle();

  const routes=["dashboard","training","program","progression","weight","nutrition","hydration","recovery","supplements","goals","exercises","profile","advice","accessories","history","statistics","records","global","meals","arms","settings"];
  for(const width of [375,390,430,1440]){
    await page.setViewportSize({width,height:width>500?900:844});
    for(const route of routes){
      await go(route);
      const size=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
      assert.ok(size.content<=size.viewport+1,route+" must fit "+width+"px");
    }
    await go("dashboard");await page.screenshot({path:"test-results/momentum-"+width+".png",fullPage:true});
  }
  await go("dashboard");await settle();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await expect(page.locator(".sidebar")).toBeAttached();
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();await expect(page.getByRole("heading",{name:/Bonjour/})).toBeVisible();
  await go("hydration");await page.getByRole("button",{name:"250 ml",exact:true}).click();
  await expect(page.locator(".water-number")).toContainText("1,25");
  await page.reload();await expect(page.locator(".water-number")).toContainText("1,25");
  await context.setOffline(false);await settle();
  await go("profile");await logout();
  await login("alpha@example.test","NouveauPass123");await settle();
  await page.goto(base+"?auth=recovery#error=access_denied&error_code=otp_expired");
  await expect(page.getByRole("heading",{name:"Ce lien ne peut plus être utilisé"})).toBeVisible();
  assert.deepEqual(errors,[],"No uncaught page errors");
  assert.deepEqual(failedResponses,[],"Every local asset must load");
  console.log("E2E: auth, verification, reset, session, isolation, multi-device, import/export, workouts, weight, nutrition, hydration, sleep, PWA offline; 84 route/viewport checks OK.");
} catch(error) {
  await mkdir("test-results",{recursive:true});await page.screenshot({path:"test-results/e2e-failure.png",fullPage:true});
  console.error("Browser errors:",errors);throw error;
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
