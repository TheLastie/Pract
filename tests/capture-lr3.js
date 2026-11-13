// Capture delivery screenshots after starting FastAPI on http://127.0.0.1:8000.
async page => {
  const baseUrl = 'http://127.0.0.1:8000';
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#result-count').waitFor();
  await page.locator('#cards h3').first().waitFor();
  await page.screenshot({ path: 'screenshot-lr3-frontend.png', fullPage: true });

  await page.goto(`${baseUrl}/docs`, { waitUntil: 'domcontentloaded' });
  await page.locator('#swagger-ui').waitFor();
  const operations = page.locator('.opblock-summary');
  for (let index = 0; index < await operations.count(); index += 1) {
    await operations.nth(index).click();
  }
  await page.screenshot({ path: 'screenshot-lr3-api.png', fullPage: true });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const response = await fetch('/api/mushrooms');
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const mushrooms = await response.json();
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      body { max-width: 1200px; margin: 48px auto; padding: 0 28px; color: #263923; background: #efe9d4; font: 16px/1.5 Georgia, serif; }
      h1 { font-size: 34px; } .caption { margin-bottom: 24px; color: #5a6b4f; }
      table { width: 100%; border-collapse: collapse; background: #f5f0df; }
      th, td { padding: 11px 12px; border: 1px solid #b9ab85; text-align: left; vertical-align: top; }
      th { background: #e4dcc3; } tr:nth-child(even) { background: #eee8d5; }
    `;
    const heading = document.createElement('h1');
    heading.textContent = 'Таблица mushrooms';
    const caption = document.createElement('p');
    caption.className = 'caption';
    caption.textContent = `SQLite · данные получены через REST API · записей: ${mushrooms.length}`;
    const table = document.createElement('table');
    const headers = ['id', 'name', 'latin', 'family', 'season', 'category', 'created_at'];
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(value => {
      const cell = document.createElement('th');
      cell.textContent = value;
      headerRow.append(cell);
    });
    thead.append(headerRow);
    const tbody = document.createElement('tbody');
    mushrooms.forEach(mushroom => {
      const row = document.createElement('tr');
      headers.forEach(key => {
        const cell = document.createElement('td');
        cell.textContent = mushroom[key] ?? '';
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    document.head.replaceChildren(style);
    document.body.replaceChildren(heading, caption, table);
  });
  await page.screenshot({ path: 'screenshot-lr3-database.png', fullPage: true });
  return { captured: ['screenshot-lr3-frontend.png', 'screenshot-lr3-api.png', 'screenshot-lr3-database.png'] };
}
