import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('nav')).toBeVisible();
});

test('blog TOC sidebar is present on post with headings', async ({ page }) => {
	// Set large viewport before navigating so CSS media query applies
	await page.setViewportSize({ width: 900, height: 800 });
	await page.goto('/blog/post-partum');

	// The outermost toc-container should be in the DOM
	const toc = page.locator('.toc-container').first();
	await expect(toc).toBeAttached();

	// Dash markers should exist — one per heading
	const dashes = toc.locator('.dash');
	const dashCount = await dashes.count();
	expect(dashCount).toBeGreaterThan(0);

	// TOC panel should be in the DOM with heading links populated
	const links = toc.locator('.toc-link');
	const linkCount = await links.count();
	expect(linkCount).toBeGreaterThan(0);
	expect(linkCount).toEqual(dashCount); // one link per dash
});

test('blog TOC marks first section active on load', async ({ page }) => {
	await page.setViewportSize({ width: 900, height: 800 });
	await page.goto('/blog/post-partum');

	// After mount the first heading should be active
	const toc = page.locator('.toc-container').first();
	const firstLink = toc.locator('.toc-link').first();
	await expect(firstLink).toHaveClass(/active/, { timeout: 2000 });
});

test('blog TOC active section updates after scrolling to bottom', async ({ page }) => {
	await page.setViewportSize({ width: 900, height: 800 });
	await page.goto('/blog/post-partum');

	const toc = page.locator('.toc-container').first();

	// Scroll to the very bottom of the page
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await page.waitForTimeout(300);

	// The last link should now be active
	const lastLink = toc.locator('.toc-link').last();
	await expect(lastLink).toHaveClass(/active/);
});

test('blog TOC not shown on posts without headings', async ({ page }) => {
	await page.setViewportSize({ width: 900, height: 800 });
	await page.goto('/blog/vax-deaths-averted');
	await expect(page.locator('.toc-container')).not.toBeAttached();
});
