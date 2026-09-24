/* End-to-end, in a phone-sized Chromium. Uses only the SYNTHETIC PeerMatch fixture and made-up
   text (numbers contain 000). Screenshots go to test-results/shots (not committed). */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { peerMatchZip } from '../unit/peermatch-fixture';

const shotDir = process.env.SHOTS ?? 'test-results/shots';
const shot = (page: Page, name: string) => page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true });

/* A fixed "today" two days after the fixture's call reminder, so Today is predictable. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-26T10:00:00'));
});

async function importFixture(page: Page) {
  await page.goto('./');
  await expect(page.getByText('Who is this for?')).toBeVisible();
  await shot(page, '01-first-run');
  await page.getByRole('button', { name: /I’m single/ }).click();
  await expect(page.getByText('How do you want to start?')).toBeVisible();
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'PeerMatch_Backup_2026-09-24.zip', mimeType: 'application/zip', buffer: Buffer.from(peerMatchZip()) });
  await expect(page.getByText(/A PeerMatch backup with 2 shadchanim, 1 guy and 2 girls/)).toBeVisible();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(/Imported 2 shadchanim, 3 singles and 1 contact person/)).toBeVisible();
  await shot(page, '02-imported');
  await page.getByRole('button', { name: /which girls were suggested/ }).click();
}

test('PeerMatch import, review, Home, search, person, backup and restore', async ({ page }) => {
  await importFixture(page);

  /* "Was she suggested to me?" — Chaya is pre-ticked (she came from a shadchan), Leah is not. */
  await expect(page.getByText('Chaya Example, 29')).toBeVisible();
  await shot(page, '03-review');
  await page.getByRole('button', { name: /Save \(1 Yes\)/ }).click();
  await expect(page.getByRole('button', { name: 'Suggested to me', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Chaya Example/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Leah Example/ })).toHaveCount(0);

  /* Home: the imported call reminder is in Today, two days late. */
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByText('Call — 1 day late')).toBeVisible();
  await expect(page.getByText('Recently added')).toBeVisible();
  await shot(page, '04-home');

  /* Search: a number becomes an age chip. */
  await page.getByRole('link', { name: 'People' }).click();
  await page.getByRole('button', { name: 'Everyone' }).click();
  await page.getByLabel('Search people').fill('29');
  await expect(page.getByRole('button', { name: /Age about 29/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Chaya Example/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dovid Example/ })).toHaveCount(0);
  await shot(page, '05-search');
  await page.getByLabel('Search people').fill('rivka');
  await expect(page.getByRole('button', { name: /Rivka Example/ })).toBeVisible();
  await page.getByLabel('Search people').fill('');

  /* The person screen */
  await page.getByRole('button', { name: /Chaya Example/ }).click();
  await expect(page.getByRole('heading', { name: /Chaya Example/ }).first()).toBeVisible();
  await expect(page.getByText('A kind, learning guy')).toBeVisible();
  await expect(page.getByText('Up to age 35')).toBeVisible();
  await expect(page.getByText('ב״ה')).toBeVisible();
  await shot(page, '06-person');

  /* Where things stand: the sheet opens, and the phone's Back button closes it (not the screen). */
  await page.locator('button.stands').click();
  await expect(page.getByRole('dialog', { name: 'Where things stand' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('A kind, learning guy')).toBeVisible();

  /* A next step, saved from the sheet */
  await page.locator('button.stands').click();
  await page.getByRole('button', { name: 'Send profile' }).click();
  await page.getByRole('button', { name: 'Tomorrow' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Next: Send profile tomorrow')).toBeVisible();

  /* A note on the timeline, then delete it and Undo */
  const tl = page.locator('details', { has: page.locator('summary', { hasText: 'Timeline' }) });
  if ((await tl.getAttribute('open')) === null) await tl.locator('summary').click();
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.getByRole('dialog').locator('textarea').fill('Her mother said to call after Sukkos');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Her mother said to call after Sukkos')).toBeVisible();
  await shot(page, '07-person-timeline');

  /* Delete the person, then Undo */
  await page.getByRole('button', { name: 'Delete Chaya Example' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('link', { name: 'People' }).click();
  await page.getByRole('button', { name: 'Everyone' }).click();
  await expect(page.getByRole('button', { name: /Chaya Example/ })).toBeVisible();

  /* Backup: save the zip, then restore it (with Undo available). */
  await page.getByRole('button', { name: 'Settings' }).click();
  await shot(page, '08-settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save to this phone' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^ZivugBase_Backup_\d{4}-\d{2}-\d{2}\.zip$/);
  const zipPath = await download.path();
  await page.locator('input[type=file]').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: readFileSync(zipPath!) });
  await expect(page.getByText(/This backup was made on/)).toBeVisible();
  await expect(page.getByText(/7 people/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText(/Restored 7 people/)).toBeVisible();

  /* The emailable PDF backup restores too. */
  await page.getByRole('button', { name: 'Settings' }).click();
  const [pdfDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Email or Drive' }).click()]);
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
  const pdf = readFileSync((await pdfDownload.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await page.locator('input[type=file]').setInputFiles({ name: pdfDownload.suggestedFilename(), mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByText(/7 people/)).toBeVisible();
});

test('Paste → Inbox → new person, then find her by city and age', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /People I help/ }).click();
  await page.getByRole('button', { name: /Start fresh/ }).click();
  await expect(page.getByText('No one here yet.')).toBeVisible();
  await shot(page, '10-home-empty');

  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await page.locator('textarea').fill('Shira Example, age 27, lives in Jerusalem.\nCall her mother 050-000-0303');
  await page.getByRole('button', { name: 'Save to Inbox' }).click();
  await expect(page.getByText('Saved to Inbox ✓')).toBeVisible();
  await page.getByRole('button', { name: 'File it now' }).click();
  await expect(page.getByText('Call her mother 050-000-0303')).toBeVisible();
  await shot(page, '11-inbox-item');

  await page.getByRole('button', { name: 'New person' }).click();
  await page.getByRole('button', { name: 'A girl (single)' }).click();
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('27');
  await expect(page.getByLabel('Phone number')).toHaveValue('050-000-0303');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Shira Example');
  await shot(page, '12-new-person-form');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Shira Example/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Call' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SMS' })).toBeVisible();

  /* The Inbox is empty again; the item is kept under "Filed". */
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByText(/Inbox: /)).toHaveCount(0);

  await page.getByRole('link', { name: 'People' }).click();
  await page.getByLabel('Search people').fill('jerusalem 27');
  await expect(page.getByRole('button', { name: /Jerusalem/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Age about 27/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Shira Example/ })).toBeVisible();

  /* Adding the same phone number again is flagged before saving. */
  await page.goto('./#/person/new?role=shadchan');
  await page.getByRole('button', { name: 'Add a phone' }).click();
  await page.getByLabel('Phone number').fill('+972 50 000 0303');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Someone Else');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Already here?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shira Example' })).toBeVisible();
});

test('Sharing into the app lands in the Inbox, one entry per share', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Both/ }).click();
  await page.getByRole('button', { name: /Start fresh/ }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  /* Two shares in a row, the way Android's share sheet posts them. */
  await page.evaluate(async () => {
    for (const text of ['First shared idea — Example 000', 'Second shared idea — Example 000']) {
      const form = new FormData();
      form.append('title', '');
      form.append('text', text);
      form.append('url', '');
      await fetch('./share-target', { method: 'POST', body: form, redirect: 'manual' });
    }
  });
  await page.goto('./#/inbox?shared=1');
  await expect(page.getByText('Saved to Inbox ✓')).toBeVisible();
  await expect(page.getByText('First shared idea — Example 000')).toBeVisible();
  await expect(page.getByText('Second shared idea — Example 000')).toBeVisible();
  await shot(page, '13-inbox');
});
