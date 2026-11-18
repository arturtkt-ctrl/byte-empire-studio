// Rec : filme Byte Empire en format téléphone à partir d'une sauvegarde préparée.
// Usage : node capture.mjs --scene orbit --out raw.webm
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { SCENES } from './scenes.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const scene = SCENES[args.scene];
if (!scene) { console.error(`Scène inconnue : ${args.scene}. Scènes : ${Object.keys(SCENES).join(', ')}`); process.exit(2); }
const outDir = path.resolve(args.dir || 'rush');
fs.mkdirSync(outDir, { recursive: true });

const URL = 'https://byte-empire.com/';
const KEY = 'datamine.save.v1';
// Rien ne doit toucher les vrais serveurs du jeu ni afficher de pub pendant le tournage.
const BLOCK = [/supabase\.co/, /workers\.dev/, /googlesyndication/, /doubleclick/, /google-analytics/, /googletagmanager/, /adservice/, /\/api\//];

async function newContext(browser, record) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR',
    ...(record ? { recordVideo: { dir: outDir, size: { width: 780, height: 1688 } } } : {}),
  });
  await ctx.route('**/*', (r) => (BLOCK.some((re) => re.test(r.request().url())) ? r.abort() : r.continue()));
  return ctx;
}

// 1. Laisse le jeu créer une sauvegarde neuve, puis applique le patch de la scène.
async function preparedSave(browser, patch) {
  const ctx = await newContext(browser, false);
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction((k) => !!localStorage.getItem(k), KEY, { timeout: 30000 });
  const base = JSON.parse(await p.evaluate((k) => localStorage.getItem(k), KEY));
  await ctx.close();
  const now = Date.now();
  return { ...base, welcomed: true, lastSeen: now, createdAt: now - 86400000, ...patch, pseudo: 'ByteEmpire' };
}

async function openApp(page, label) {
  const el = page.getByText(label, { exact: true }).first();
  await el.click({ timeout: 8000 }).catch(() => console.warn(`Appli introuvable : ${label}`));
}

async function closeApp(page) {
  await page.getByLabel('Fermer la fenêtre').first().click({ timeout: 3000 }).catch(() => {});
}

async function tap(page, label, times, every = 120) {
  const el = page.getByText(label, { exact: false }).first();
  for (let i = 0; i < times; i++) { await el.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(every); }
}

const browser = await chromium.launch();
const shots = [];
for (const [i, shot] of scene.shots.entries()) {
  const save = await preparedSave(browser, shot.patch || {});
  const ctx = await newContext(browser, true);
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('rec')) { localStorage.setItem(k, v); sessionStorage.setItem('rec', '1'); } }, [KEY, JSON.stringify(save)]);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Ferme toute fenêtre d'accueil ou de gains hors ligne restée ouverte.
  for (const t of ['Récupérer', 'Continuer', 'OK', 'Fermer', 'Plus tard']) await page.getByRole('button', { name: t }).first().click({ timeout: 600 }).catch(() => {});
  for (const step of shot.steps || []) {
    if (step.open) await openApp(page, step.open);
    if (step.close) await closeApp(page);
    if (step.tap) await tap(page, step.tap, step.times || 10, step.every || 120);
    if (step.scroll) await page.mouse.wheel(0, step.scroll);
    if (step.wait) await page.waitForTimeout(step.wait);
  }
  await page.waitForTimeout(shot.hold || 2500);
  const video = page.video();
  await ctx.close();
  const file = path.join(outDir, `shot_${String(i).padStart(2, '0')}.webm`);
  fs.renameSync(await video.path(), file);
  // On coupe la première seconde de chargement de chaque plan.
  shots.push({ file, trim: shot.trim ?? 1.5 });
  console.log(`Plan ${i + 1}/${scene.shots.length} filmé`);
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'shots.json'), JSON.stringify(shots, null, 2));
console.log(`OK ${shots.length} plans dans ${outDir}`);
