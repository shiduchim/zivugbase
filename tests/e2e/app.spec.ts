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
  await expect(page.getByText('Which mode?')).toBeVisible();
  await shot(page, '01-first-run');
  await page.getByRole('button', { name: /Single mode/ }).click();
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
  await expect(page.getByRole('button', { name: 'Ideas for me', pressed: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Chaya Example/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Leah Example/ })).toHaveCount(0);

  /* Home: the imported call reminder is in Today, two days late. */
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByText('Calls due', { exact: true })).toBeVisible();
  await expect(page.getByText('1 day late')).toBeVisible();
  /* Single mode: Home and Shadchanim tabs only. */
  await expect(page.getByRole('link', { name: 'Shadchanim' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Guys' })).toHaveCount(0);
  await expect(page.getByText('Recently added')).toBeVisible();
  await shot(page, '04-home');

  /* An idea copied from a shadchan's WhatsApp: one tap on Paste, the sender is recognized. */
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('[25/09/2026, 10:00] Rivka Example: Miriam Example\n[25/09/2026, 10:01] Rivka Example: She is 28 years old, lives in Bnei Brak'));
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await expect(page.getByText('Saved to the Intake folder.')).toBeVisible();
  await page.getByRole('button', { name: 'File now' }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Miriam Example');
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('28');
  await expect(page.getByLabel('City')).toHaveValue('Bnei Brak');
  await expect(page.getByRole('button', { name: /Rivka Example — change/ })).toBeVisible();
  await shot(page, '04b-paste-idea');
  await page.getByRole('button', { name: 'Save idea' }).click();
  await expect(page.getByText(/Saved: Miriam Example/)).toBeVisible();
  await shot(page, '04c-home-after-idea');

  /* Search: a number becomes an age chip. */
  await page.goto('./#/people?show=everyone');
  await page.getByLabel('Search people').fill('29');
  await expect(page.getByRole('button', { name: /Age about 29/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Chaya Example/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Dovid Example/ })).toHaveCount(0);
  await shot(page, '05-search');
  await page.getByLabel('Search people').fill('rivka');
  await expect(page.getByRole('button', { name: /^Rivka Example/ })).toBeVisible();
  await page.getByLabel('Search people').fill('');

  /* The person screen */
  await page.getByRole('button', { name: /^Chaya Example/ }).click();
  await expect(page.getByRole('heading', { name: /Chaya Example/ }).first()).toBeVisible();
  await expect(page.getByText('A kind, learning guy')).toBeVisible();
  await expect(page.locator('.pcardx', { hasText: 'Up to age:' })).toContainText('35');
  await expect(page.getByText('ב״ה')).toBeVisible();
  await shot(page, '06-person');

  /* Add to… a new folder. The sheet opens, and the phone's Back button closes it (not the screen). */
  await page.getByRole('button', { name: 'Add to…' }).click();
  await expect(page.getByRole('dialog', { name: 'Add to…' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('A kind, learning guy')).toBeVisible();
  await page.getByRole('button', { name: 'Add to…' }).click();
  await page.getByPlaceholder('Folder name, e.g. Tzfat').fill('Tzfat');
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Girls › Tzfat')).toBeVisible();

  /* Calls due in one tap */
  await page.getByRole('button', { name: 'Call tomorrow' }).click();
  await expect(page.getByText('Call reminder set — tomorrow')).toBeVisible();

  /* A note from the bottom note bar, shown under History */
  await page.getByPlaceholder('Note…').fill('Her mother said to call after Sukkos');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Her mother said to call after Sukkos')).toBeVisible();
  await shot(page, '07-person-timeline');

  /* Tick her in the list, Delete, then Undo */
  await page.goto('./#/people?show=everyone');
  await page.getByLabel('Select Chaya Example').check();
  await expect(page.getByText('Share this contact')).toBeVisible();
  await page.locator('.selbar').getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Chaya Example/ })).toBeVisible();

  /* Backup: save the zip, then restore it (with Undo available). Settings is on Home only. */
  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await shot(page, '08-settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save to this phone' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^ZivugBase_Backup_\d{4}-\d{2}-\d{2}\.zip$/);
  const zipPath = await download.path();
  await page.locator('input[type=file]').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: readFileSync(zipPath!) });
  await expect(page.getByText(/This backup was made on/)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/^7 people · /)).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText(/Restored 7 people/)).toBeVisible();

  /* The emailable PDF backup restores too. */
  await page.getByRole('button', { name: 'Settings' }).click();
  const [pdfDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Email or Drive' }).click()]);
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
  const pdf = readFileSync((await pdfDownload.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await page.locator('input[type=file]').setInputFiles({ name: pdfDownload.suggestedFilename(), mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByRole('dialog').getByText(/^7 people · /)).toBeVisible();
});

test('Paste → Inbox → new person, then find her by city and age', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Shadchan mode/ }).click();
  await page.getByRole('button', { name: /Start fresh/ }).click();
  await expect(page.getByText('No one here yet.')).toBeVisible();
  await shot(page, '10-home-empty');

  /* One tap on Paste reads what was copied and fills in the form. */
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('Shira Example, age 27, lives in Jerusalem.\nCall her mother 050-000-0303'));
  await page.getByRole('button', { name: 'Paste', exact: true }).click();
  await expect(page.getByText('Saved to the Intake folder.')).toBeVisible();
  await page.getByRole('button', { name: 'File now' }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Shira Example');
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('27');
  await expect(page.getByLabel('City')).toHaveValue('Jerusalem');
  await expect(page.getByLabel('Phone')).toHaveValue('050-000-0303');
  await shot(page, '11-paste-form');
  await page.getByRole('button', { name: 'A single', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved: Shira Example.')).toBeVisible();
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: /Shira Example/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Call', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'SMS', exact: true }).first()).toBeVisible();

  /* The Inbox is empty again; the item is kept under "Filed". A person's page has no tabs. */
  await page.getByRole('button', { name: 'Back' }).click();
  await page.goto('./#/home');
  await expect(page.getByText('Intake folder — to file')).toHaveCount(0);
  /* Helping mode: Shadchanim, Guys and Girls tabs. */
  await expect(page.getByRole('link', { name: 'Girls' })).toBeVisible();
  await page.goto('./#/people?show=everyone');
  await page.getByLabel('Search people').fill('jerusalem 27');
  await expect(page.getByRole('button', { name: /^Jerusalem — remove/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Age about 27/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Shira Example/ })).toBeVisible();

  /* Text from the Android add-on's bubble arrives in the address, with the chat's name. */
  await page.goto('./#/capture/paste?addon=1&sender=' + encodeURIComponent('+972 50 000 0909') + '&text=' + encodeURIComponent('Tova Example\nage 30'));
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Tova Example');
  await expect(page.getByRole('button', { name: /Add “\+972 50 000 0909” as a new shadchan/ })).toBeVisible();
  await expect(page).toHaveURL(/#\/capture\/paste$/);

  /* Adding the same phone number again is flagged before saving. */
  await page.goto('./#/person/new?role=shadchan');
  await page.getByLabel('Phone number').first().fill('+972 50 000 0303');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Someone Else');
  await page.getByRole('button', { name: 'Save Shadchan' }).click();
  await expect(page.getByText('Already here?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Shira Example' })).toBeVisible();
});

test('Sharing into the app lands in the Inbox, one entry per share', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Shadchan mode/ }).click();
  await page.getByRole('button', { name: /Start fresh/ }).click();
  await expect(page.getByText('No one here yet.')).toBeVisible(); /* the choice is saved before reloading */
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
  /* Straight to the newest share's form, with a way back to WhatsApp. */
  await expect(page.getByText('Second shared idea — Example 000')).toBeVisible();
  await expect(page.getByRole('button', { name: /Later — back to WhatsApp/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
  await shot(page, '13-shared-form');
  await page.goto('./#/inbox');
  await expect(page.getByText('First shared idea — Example 000')).toBeVisible();
  await expect(page.getByText('Second shared idea — Example 000')).toBeVisible();
  await shot(page, '13-inbox');
});
