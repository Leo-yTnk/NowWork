// Run against two production builds with Playwright and pngjs available via NODE_PATH.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { extname, join, resolve, sep } = require('node:path');
const { chromium, firefox, webkit } = require('playwright');
const { PNG } = require('pngjs');

const [before, after, output = 'prism-evidence'] = process.argv.slice(2);
const summaries = [];
const date = '2026-11-25T16:00:00.000Z';
const noteRoute = '#/materias/math/caderno/lesson';
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png',
  '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
};

async function serve(directory) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const path = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
      const file = path === root ? join(root, 'index.html') : path;
      assert.ok(file.startsWith(root + sep));
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  return { server, url: 'http://127.0.0.1:' + server.address().port + '/' };
}

function fixture(theme, toolbarMode) {
  const entry = (id, title, kind, dueAt) => ({
    id, title, kind, dueAt, note: '', importance: 2, effort: 2, minutes: 25,
    steps: [], status: 'active', postponeCount: 0, source: 'user', subjectId: 'math',
    createdAt: date, updatedAt: date, completedAt: null,
  });
  return {
    version: 1, profile: { name: 'Alex', theme, toolbarMode, reducedMotion: true },
    subjects: [
      { id: 'math', title: 'Matemática', icon: 'calculator', color: 'mint' },
      { id: 'history', title: 'História', icon: 'landmark', color: 'peach' },
      { id: 'science', title: 'Ciências', icon: 'flask', color: 'blue' },
      { id: 'portuguese', title: 'Português', icon: 'pen-nib', color: 'violet' },
    ],
    notes: [{
      id: 'lesson', subjectId: 'math', title: 'Geometria', updatedAt: date, blocks: [],
      content: { type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Triângulos ' },
        { type: 'text', text: 'semelhantes', marks: [{ type: 'bold' }] },
      ] }] },
    }],
    flashcards: [{
      id: 'question', subjectId: 'math', front: 'Qual é o teorema de Pitágoras?',
      back: 'a² + b² = c²', due: '2026-11-25', interval: 0,
    }],
    entries: [
      entry('test', 'Revisar os exercícios de geometria', 'task', '2026-11-25T21:00:00.000Z'),
      entry('reading', 'Separar as anotações da aula', 'task', '2026-11-25T22:00:00.000Z'),
      entry('club', 'Grupo de estudos', 'event', '2026-11-26T18:00:00.000Z'),
    ],
    rewards: [], activity: [],
  };
}

async function setup(browser, { width = 1440, height = 980, theme = 'light', mode = 'simple', touch = false, forcedColors = 'none' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
    reducedMotion: 'reduce', hasTouch: touch, forcedColors,
  });
  await context.addInitScript((snapshot) => {
    if (!localStorage.getItem('brisa-fallback-v1')) localStorage.setItem('brisa-fallback-v1', JSON.stringify(snapshot));
  }, fixture(theme, mode));
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(date));
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}

async function open(page, url, hash = '') {
  await page.goto(url + hash);
  await page.locator('.workspace-primary').waitFor();
  await page.locator('#main-content').waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function save(page, name) {
  return page.screenshot({ path: join(output, name + '.png'), animations: 'disabled' });
}

const routes = [
  ['hoje', '#/hoje'], ['planejar', '#/planejar/tarefas'], ['agenda', '#/planejar/agenda'],
  ['materias', '#/materias'], ['estudar', '#/estudar/foco'], ['progresso', '#/estudar/progresso'],
  ['revisao', '#/materias/math/revisao'],
];

function combine(beforeImage, afterImage) {
  const a = PNG.sync.read(beforeImage);
  const b = PNG.sync.read(afterImage);
  const gap = 20;
  const out = new PNG({ width: a.width + gap + b.width, height: Math.max(a.height, b.height) });
  out.data.fill(240);
  for (let index = 3; index < out.data.length; index += 4) out.data[index] = 255;
  PNG.bitblt(a, out, 0, 0, a.width, a.height, 0, 0);
  PNG.bitblt(b, out, 0, 0, b.width, b.height, a.width + gap, 0);
  return PNG.sync.write(out);
}

async function toolbarStyles(locator) {
  return locator.evaluate((root) => [root, ...root.querySelectorAll('button, input, [role="option"], .ds-select-frame')].map((el) => {
    const computed = getComputedStyle(el);
    const properties = [
      'backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow', 'color',
      'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'minHeight', 'minWidth',
      'height', 'width', 'backdropFilter', 'cornerShape',
    ];
    return [el.getAttribute('aria-label') || el.className, ...properties.map((property) => computed[property])];
  }));
}

async function toolbarCase(browser, url, test, phase) {
  const { width, theme, mode } = test;
  const { context, page, errors } = await setup(browser, { width, theme, mode, touch: width <= 800 });
  const name = [width, theme, mode].join('-');
  try {
    await open(page, url, noteRoute);
    await page.locator('.tiptap').waitFor();
    const bar = page.locator('.note-command-bar');
    const baseline = await toolbarStyles(bar);
    const screenshot = await bar.screenshot({ path: join(output, phase + '-toolbar-' + name + '.png') });
    if (width <= 800) {
      await page.getByRole('button', { name: 'Mais ferramentas', exact: true }).click();
      await page.locator('.note-tool-panel').waitFor();
    }
    const style = page.getByRole('combobox', { name: 'Estilo', exact: true });
    let menu;
    if (await style.isVisible()) {
      await style.click();
      const portal = page.locator('.ds-select-content[data-state="open"]');
      await portal.waitFor();
      menu = await toolbarStyles(portal);
      await portal.screenshot({ path: join(output, phase + '-menu-' + name + '.png') });
      await page.keyboard.press('Escape');
      await portal.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
    return { baseline, screenshot, menu };
  } finally {
    await context.close();
  }
}

async function visualReview(browser, left, right) {
  const failures = [];
  for (const view of [{ width: 1440, theme: 'light' }, { width: 390, theme: 'dark', touch: true }]) {
    const a = await setup(browser, view);
    const b = await setup(browser, view);
    try {
      for (const [name, hash] of [...routes, ['caderno', noteRoute], ['configuracoes', '#/hoje']]) {
        await Promise.all([open(a.page, left, hash), open(b.page, right, hash)]);
        if (name === 'caderno') await Promise.all([a.page, b.page].map((page) => page.locator('.tiptap').waitFor()));
        if (name === 'configuracoes') {
          await Promise.all([a.page, b.page].map(async (page) => {
            await page.getByRole('button', { name: 'Configurações', exact: true }).click();
            await page.getByRole('dialog', { name: 'Configurações' }).waitFor();
          }));
        }
        const key = name + '-' + view.width + '-' + view.theme;
        const [first, second] = await Promise.all([save(a.page, 'antes-' + key), save(b.page, 'depois-' + key)]);
        await writeFile(join(output, 'comparativo-' + key + '.png'), combine(first, second));
      }
      assert.deepEqual(a.errors, []);
      assert.deepEqual(b.errors, []);
    } finally {
      await Promise.all([a.context.close(), b.context.close()]);
    }
  }
  for (const test of [
    { width: 1440, mode: 'simple', theme: 'light' }, { width: 1440, mode: 'simple', theme: 'dark' },
    { width: 1440, mode: 'advanced', theme: 'light' }, { width: 1440, mode: 'advanced', theme: 'dark' },
    { width: 801, mode: 'advanced', theme: 'light' }, { width: 801, mode: 'simple', theme: 'dark' },
    { width: 390, mode: 'simple', theme: 'light' }, { width: 390, mode: 'advanced', theme: 'dark' },
  ]) {
    const key = [test.width, test.theme, test.mode].join('-');
    try {
      const [a, b] = await Promise.all([toolbarCase(browser, left, test, 'antes'), toolbarCase(browser, right, test, 'depois')]);
      await writeFile(join(output, 'comparativo-toolbar-' + key + '.png'), combine(a.screenshot, b.screenshot));
      assert.deepEqual(b.baseline, a.baseline, 'Estilos computados da barra');
      assert.deepEqual(b.menu, a.menu, 'Estilos computados do menu em portal');
      summaries.push({ name: 'Toolbar ' + key, pass: true, menu: Boolean(b.menu) });
    } catch (error) {
      failures.push(error);
      summaries.push({ name: 'Toolbar ' + key, pass: false, error: error.message });
    }
  }
  return failures;
}

async function checkViewport(page, url, widths, expectBottom = true) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 430 ? 390 : 900 });
    for (const [, hash] of routes) {
      await open(page, url, hash);
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
        navigation: getComputedStyle(document.querySelector('.workspace-primary')).position,
        active: document.querySelectorAll('.workspace-primary [aria-current="page"]').length,
      }));
      assert.ok(layout.scroll <= layout.width + 1, width + 'px em ' + hash + ': ' + JSON.stringify(layout));
      assert.equal(layout.active, 1);
      if (expectBottom) assert.equal(layout.navigation, width < 600 ? 'fixed' : 'relative');
    }
  }
}

async function flows(browser, url, widths, engine) {
  const { context, page, errors } = await setup(browser);
  try {
    await checkViewport(page, url, widths);
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, url, '#/planejar/tarefas');
    const sort = page.getByRole('combobox', { name: 'Ordenar tarefas' });
    await sort.press('Enter');
    await page.getByRole('listbox').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('listbox').waitFor({ state: 'hidden' });
    assert.equal(await sort.evaluate((el) => el === document.activeElement), true);
    await sort.click();
    await page.getByRole('option', { name: 'Mais recentes' }).click();
    assert.match(await sort.innerText(), /Mais recentes/);

    await page.getByRole('button', { name: 'Nova tarefa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo registro' });
    await dialog.getByLabel('Título', { exact: true }).fill('Verificar persistência Prism');
    await dialog.getByRole('button', { name: 'Salvar registro' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Concluir Verificar persistência Prism' }).click();
    await page.getByRole('button', { name: /^Concluídas/ }).click();
    const reopen = page.getByRole('button', { name: 'Reabrir Verificar persistência Prism' });
    await reopen.waitFor();
    await page.reload();
    await page.getByRole('button', { name: /^Concluídas/ }).click();
    await reopen.waitFor();

    await open(page, url, '#/materias/math/revisao');
    await page.getByRole('button', { name: 'Mostrar resposta' }).click();
    await page.getByText('a² + b² = c²', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Bom', exact: true }).click();
    await page.getByText('Revisões em dia').waitFor();

    await open(page, url, noteRoute);
    const editor = page.locator('.tiptap');
    await editor.waitFor();
    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('End');
    await page.keyboard.type(' persiste');
    assert.match(await editor.innerText(), /persiste/);
    await page.keyboard.press('Control+z');
    assert.doesNotMatch(await editor.innerText(), /persiste/);
    await page.keyboard.press('Control+Shift+z');
    assert.match(await editor.innerText(), /persiste/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.note-dock').waitFor();
    assert.equal(await page.locator('.workspace-primary').evaluate((el) => getComputedStyle(el).position), 'relative');
    await page.getByRole('button', { name: 'Expandir páginas da matéria' }).click();
    await page.locator('.document-layout[data-pages-open="true"]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.document-layout[data-pages-open="false"]').waitFor();

    if (engine === 'chromium') {
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await context.setOffline(true);
      await page.reload();
      await editor.waitFor();
      assert.match(await editor.innerText(), /persiste/);
      await context.setOffline(false);
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

async function reportRun(name, operation) {
  try {
    await operation();
    summaries.push({ name, pass: true });
    return [];
  } catch (error) {
    summaries.push({ name, pass: false, error: error.stack || String(error) });
    return [error];
  }
}

async function main() {
  assert.ok(before && after, 'Informe os diretórios dist da baseline e da versão Prism.');
  await mkdir(output, { recursive: true });
  const [left, right] = await Promise.all([serve(before), serve(after)]);
  const failures = [];
  try {
    for (const [engine, browserType] of Object.entries({ chromium, firefox, webkit })) {
      failures.push(...await reportRun(engine, async () => {
        const browser = await browserType.launch();
        try {
          if (engine === 'chromium') {
            failures.push(...await reportRun('Capturas e paridade da toolbar', async () => {
              failures.push(...await visualReview(browser, left.url, right.url));
            }));
          }
          await flows(browser, right.url, engine === 'chromium'
            ? [320, 390, 399, 400, 401, 430, 599, 600, 699, 700, 768, 799, 800, 801, 1023, 1024, 1440]
            : [320, 390, 768, 1024, 1440], engine);
        } finally {
          await browser.close();
        }
      }));
    }
  } finally {
    left.server.close();
    right.server.close();
    await writeFile(join(output, 'resultados.json'), JSON.stringify(summaries, null, 2));
  }
  for (const result of summaries) console.log(result.pass ? 'PASS' : 'FAIL', result.name, result.error ?? '');
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
