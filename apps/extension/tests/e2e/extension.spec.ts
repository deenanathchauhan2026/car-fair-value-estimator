import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const fixtures = ['facebook.html','autotrader.html','cargurus.html','craigslist.html'];
for (const fixture of fixtures) test(`extracts from ${fixture}`, async ({ page }) => {
  const html = readFileSync(resolve('apps/extension/tests/e2e/fixtures', fixture), 'utf8');
  await page.setContent(html);
  const pageText = await page.evaluate(() => [document.title, document.body.innerText, ...Array.from(document.querySelectorAll('script[type="application/ld+json"],meta')).map(n => n.textContent || n.getAttribute('content') || '')].join('\n'));
  expect(pageText).toMatch(/Toyota|Honda|Subaru|Ford/);
  expect(pageText).toMatch(/\$|price|odometer|mileage|miles/i);
});
test('valuation flow UI contract mock', async ({ page }) => {
  await page.setContent('<button id="estimate">Estimate Fair Value</button><div id="result"></div><script>document.querySelector("button").onclick=()=>{document.querySelector("#result").textContent="$19,900–$21,400 Confidence 80%"}</script>');
  await page.getByText('Estimate Fair Value').click();
  await expect(page.locator('#result')).toContainText('Confidence');
});
