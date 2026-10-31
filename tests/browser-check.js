// Run against the local FastAPI server: playwright-cli --raw run-code --filename=tests/browser-check.js
async page => {
  const context = await page.context().browser().newContext();
  const app = await context.newPage();
  const errors = [];
  app.on('pageerror', error => errors.push(error.message));
  const results = [];
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    results.push(message);
  };
  const count = () => app.locator('#cards .card').count();
  const names = () => app.locator('#cards h3').allTextContents();
  const reset = () => app.locator('#reset-filters').click();
  const open = () => app.locator('#add-item').click();
  const isOpen = () => app.locator('#item-dialog').evaluate(node => node.open);
  const addedNames = new Set();
  try {
    await app.route('**/api/mushrooms', route => route.abort());
    await app.goto('http://127.0.0.1:8000', { waitUntil: 'domcontentloaded' });
    await app.locator('#api-message:not([hidden])').waitFor();
    check(await app.locator('#result-count').textContent() === 'Каталог недоступен', 'API outage is reported as unavailable, not as an empty catalog');
    check(await app.locator('.api-message').textContent().then(text => text.includes('http://127.0.0.1:8000')) && !await app.locator('.empty-state').isVisible(), 'API outage explains how to start the app and hides the empty-state message');
    await app.unroute('**/api/mushrooms');
    await app.reload();
    await app.locator('#result-count').getByText('Показано').waitFor();
    const initialItems = await app.evaluate(async () => (await fetch('/api/mushrooms')).json());
    const baselineCount = initialItems.length;
    const baselineEdibleCount = initialItems.filter(item => item.category === 'edible').length;
    check(baselineCount >= 6, 'Frontend loads sample and saved records from REST API');
    check(await app.evaluate(() => localStorage.length) === 0, 'Catalog no longer uses localStorage');
    check(await app.locator('#add-field-record').count() === 0, 'No separate field-record button is shown');
    const original = await names();
    check(JSON.stringify(original) === JSON.stringify([...original].sort((a, b) => a.localeCompare(b, 'ru'))), 'Default alphabetical order');
    await app.locator('#query').fill('ЛИСИЧКА');
    check(await count() === 1 && (await names())[0] === 'Лисичка обыкновенная', 'Case-insensitive search');
    await app.locator('#category').selectOption('poisonous');
    check(await count() === 0 && await app.locator('.empty-state').isVisible(), 'Combined filters and empty state');
    await app.locator('.empty-state button').click();
    await app.locator('#category').selectOption('edible');
    check(await count() === baselineEdibleCount, 'Category filtering');
    await reset();
    await app.locator('#sort').selectOption('name-desc');
    check(JSON.stringify(await names()) === JSON.stringify([...original].reverse()), 'Reverse alphabetical order');

    await open();
    await app.locator('#submit-item').click();
    check(await app.locator('[aria-invalid=true]').count() === 5, 'Required fields show inline validation messages');
    await app.keyboard.press('Escape');
    check(!await isOpen(), 'Escape closes the modal');
    await open();
    await app.locator('#cancel-dialog').click();
    check(!await isOpen(), 'Cancel closes the modal');
    await open();
    await app.locator('#close-dialog').click();
    check(!await isOpen(), 'Close button closes the modal');
    await open();
    await app.mouse.click(2, 2);
    check(!await isOpen(), 'Backdrop closes the modal');

    const name = 'Тестовый гриб <img src=x onerror=alert(1)>';
    addedNames.add(name);
    await open();
    await app.locator('#item-name').fill(name);
    await app.locator('#item-family').fill('Тестовые');
    await app.locator('#item-season').fill('сентябрь');
    await app.locator('#item-category').selectOption('unknown');
    await app.locator('#item-description').fill('Учебная запись для проверки каталога.');
    await app.locator('#item-photo').setInputFiles('assets/images/chanterelle-photo.jpg');
    await app.locator('#item-photo-2').setInputFiles('assets/images/muscaria-photo.jpg');
    await app.locator('#submit-item').click();
    await app.locator('#cards h3').getByText(name).waitFor();
    check(!await isOpen() && await count() === baselineCount + 1, 'Field form creates a catalog record through POST');
    const testCard = app.locator('#cards .card').filter({ hasText: name });
    const uploadedPhoto = testCard.locator('img.photo');
    await uploadedPhoto.waitFor();
    const photoUrl = await uploadedPhoto.getAttribute('src');
    check(/^\/api\/mushrooms\/\d+\/photo$/.test(photoUrl), 'Uploaded photo is served from its database record');
    const secondPhotoUrl = await testCard.locator('img.photo').nth(1).getAttribute('src');
    check(secondPhotoUrl.endsWith('/photo?slot=2'), 'Second uploaded photo has its own database slot');
    check(await testCard.locator('h3 img').count() === 0, 'User text is rendered safely without HTML');
    await app.reload();
    check(await count() === baselineCount + 1, 'Created record persists in SQLite after reload');
    check(await app.locator('#cards .card').filter({ hasText: name }).locator('img.photo').getAttribute('src') === photoUrl, 'Uploaded photo remains available after reload');
    check(await app.locator('#cards .card').filter({ hasText: name }).locator('img.photo').nth(1).getAttribute('src') === secondPhotoUrl, 'Second photo remains available after reload');

    await app.locator('#query').fill(name);
    await app.locator('[data-edit-id]').click();
    check(await isOpen() && await app.locator('#dialog-title').textContent() === 'Изменить запись', 'Edit action opens the existing record');
    const description = 'Обновлённое описание проверочной записи.';
    await app.locator('#item-description').fill(description);
    await app.locator('#submit-item').click();
    await app.locator('#cards .desc').getByText(description).waitFor();
    check(await app.locator('#cards .desc').textContent() === description, 'Edit action persists a PATCH update');

    await app.locator('[data-delete-id]').click();
    await app.locator('#cards h3').getByText(name).waitFor({ state: 'detached' });
    check(await count() === 0, 'Delegated delete action calls DELETE');
    await reset();
    check(await count() === baselineCount, 'Deleted card disappears after clearing the filter');
    await app.reload();
    check(await count() === baselineCount && !(await names()).includes(name), 'Deleted record remains absent after reload');

    for (const width of [360, 768, 1280]) {
      await app.setViewportSize({ width, height: 900 });
      check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
      await open();
      check(await app.locator('#item-dialog').evaluate(node => node.scrollWidth <= node.clientWidth), `Modal fits at ${width}px`);
      await app.keyboard.press('Escape');
    }
    await app.locator('.theme-label').click();
    check(await app.locator('#theme-toggle').isChecked(), 'Dark theme remains available');
    check(errors.length === 0, 'No JavaScript runtime errors');
    return { passed: results.length, results };
  } finally {
    for (const name of addedNames) {
      await app.evaluate(async name => {
        const response = await fetch('/api/mushrooms');
        const items = await response.json();
        const item = items.find(entry => entry.name === name);
        if (item) await fetch(`/api/mushrooms/${item.id}`, { method: 'DELETE' });
      }, name).catch(() => {});
    }
    await context.close();
  }
}
