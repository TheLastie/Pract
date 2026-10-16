// Запуск: playwright-cli -s=lr2 run-code --filename=tests/browser-check.js
async page => {
  const context = await page.context().browser().newContext();
  const app = await context.newPage();
  const errors = [];
  app.on('pageerror', error => errors.push(error.message));
  const key = 'gribnoy-atlas:items:v1';
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
  try {
    await app.goto('http://127.0.0.1:8000');
    check(await count() === 6, 'Default: six cards');
    const original = await names();
    check(JSON.stringify(original) === JSON.stringify([...original].sort((a, b) => a.localeCompare(b, 'ru'))), 'Default alphabetical order');
    await app.locator('#query').fill('ЛИСИЧКА');
    check(await count() === 1 && (await names())[0] === 'Лисичка обыкновенная', 'Case-insensitive search');
    await app.locator('#category').selectOption('poisonous');
    check(await count() === 0 && await app.locator('.empty-state').isVisible(), 'Combined filters and empty state');
    await app.locator('.empty-state button').click();
    await app.locator('#category').selectOption('edible');
    check(await count() === 3, 'Category filtering');
    await reset();
    await app.locator('#sort').selectOption('name-desc');
    check(JSON.stringify(await names()) === JSON.stringify([...original].reverse()), 'Reverse alphabetical order');
    await app.locator('#sort').selectOption('oldest');
    check((await names())[0] === 'Белый гриб', 'Oldest first');
    await app.locator('#sort').selectOption('newest');
    check((await names())[0] === 'Сатанинский гриб', 'Newest first');
    await open();
    await app.locator('#item-form button[type=submit]').click();
    check(await app.locator('[aria-invalid=true]').count() === 5, 'Required fields show inline errors');
    check(await app.locator('#item-name').evaluate(node => node === document.activeElement), 'First invalid field receives focus');
    await app.locator('#item-name').fill('  ');
    await app.locator('#item-description').fill('коротко');
    await app.locator('#item-form button[type=submit]').click();
    check(await app.locator('#name-error').textContent() !== '' && await app.locator('#description-error').textContent() !== '', 'Whitespace and minlength validation');
    await app.keyboard.press('Escape');
    check(!await isOpen(), 'Escape closes modal');
    await open();
    await app.locator('#cancel-dialog').click();
    check(!await isOpen(), 'Cancel closes modal');
    await open();
    await app.locator('#close-dialog').click();
    check(!await isOpen(), 'Cross closes modal');
    await open();
    await app.mouse.click(2, 2);
    check(!await isOpen(), 'Backdrop closes modal');
    await app.locator('#query').fill('несуществующий');
    await app.locator('#category').selectOption('edible');
    await open();
    const payload = '<img src=x onerror=alert(1)>';
    await app.locator('#item-name').fill(payload);
    await app.locator('#item-family').fill('Не определено');
    await app.locator('#item-season').fill('сентябрь');
    await app.locator('#item-category').selectOption('unknown');
    await app.locator('#item-description').fill('Наблюдение в смешанном лесу. ' + payload);
    await app.locator('#item-form button[type=submit]').click();
    check(!await isOpen() && await count() === 7 && (await names())[0] === payload, 'Add resets filters and shows new item');
    check(await app.locator('#cards .card').first().locator('img').count() === 0, 'User HTML renders as text');
    await app.reload();
    check(await count() === 7, 'Addition persists across reload');
    await app.locator('#query').fill(payload);
    await app.locator('[data-delete-id]').click();
    await app.reload();
    check(await count() === 6, 'Delegated deletion persists across reload');
    await app.evaluate(key => localStorage.setItem(key, '{broken'), key);
    await app.reload();
    check(await count() === 6 && await app.locator('#storage-message').isVisible(), 'Corrupt storage falls back with message');
    await app.evaluate(key => localStorage.setItem(key, JSON.stringify([{ id: 'invalid' }])), key);
    await app.reload();
    check(await count() === 6 && await app.locator('#storage-message').isVisible(), 'Invalid saved schema is handled');
    await app.locator('[data-delete-id]').first().click();
    check(!await app.locator('#storage-message').isVisible(), 'Successful save clears storage warning');
    while (await count()) await app.locator('[data-delete-id]').first().click();
    await app.reload();
    check(await count() === 0 && await app.locator('.empty-state').isVisible(), 'Empty atlas persists');
    await app.evaluate(key => localStorage.removeItem(key), key);
    await app.reload();
    for (const width of [360, 768, 1280]) {
      await app.setViewportSize({ width, height: 900 });
      check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
      await open();
      check(await app.locator('#item-dialog').evaluate(node => node.scrollWidth <= node.clientWidth), `Modal fits at ${width}px`);
      await app.keyboard.press('Escape');
    }
    await app.locator('.theme-label').click();
    check(await app.locator('#theme-toggle').isChecked(), 'Dark theme remains usable');
    await open();
    check(await isOpen(), 'Modal works in dark theme');
    await app.keyboard.press('Escape');
    await app.evaluate(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    });
    await app.locator('[data-delete-id]').first().click();
    check(await count() === 5 && await app.locator('#storage-message').isVisible(), 'Failed storage write keeps app usable and warns');
    await app.reload();
    check(await count() === 6, 'Failed write does not claim persistence');
    await app.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    });
    await app.reload();
    check(await count() === 6 && await app.locator('#storage-message').isVisible(), 'Blocked storage read falls back with warning');
    check(errors.length === 0, 'No JavaScript runtime errors');
    return { passed: results.length, results };
  } finally {
    await context.close();
  }
}
