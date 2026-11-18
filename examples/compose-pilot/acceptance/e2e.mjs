import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://api:3000');
 await page.getByLabel('Note title').fill('  Compose browser note  ');
 await page.getByRole('button',{name:'Save note'}).click();
 await page.getByText('Saved',{exact:true}).waitFor();
 assert.equal(await page.locator('li').last().textContent(),'Compose browser note');
 await page.reload();
 await page.getByText('Compose browser note',{exact:true}).waitFor();
 const count=await page.locator('li').count();
 await page.getByLabel('Note title').fill('   ');
 await page.getByRole('button',{name:'Save note'}).click();
 await page.getByText('Enter a title of 1–120 characters',{exact:true}).waitFor();
 assert.equal(await page.locator('li').count(),count);
 const response=await fetch('http://api:3000/api/notes');
 assert.equal(response.status,200);
 console.log('PASS: browser save, trim, reload persistence, invalid input, and API retrieval');
} finally {await browser.close();}
