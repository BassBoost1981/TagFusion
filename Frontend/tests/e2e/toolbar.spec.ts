import { test, expect } from '@playwright/test';

test.describe('Toolbar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('sidebar')).toBeVisible();
    });

    test('should display TagFusion branding', async ({ page }) => {
        // Logo image and title text
        await expect(page.locator('img[alt="TagFusion"]')).toBeVisible();
        await expect(page.getByText('TagFusion').first()).toBeVisible();
    });

    test('should display home button', async ({ page }) => {
        await expect(page.getByTitle('Startseite')).toBeVisible();
    });

    test('should display search input with placeholder', async ({ page }) => {
        const searchInput = page.locator('input[placeholder="Bilder oder Tags suchen..."]');
        await expect(searchInput).toBeVisible();
    });

    test('should accept text in search input', async ({ page }) => {
        const searchInput = page.locator('input[placeholder="Bilder oder Tags suchen..."]');
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');
    });

    test('should clear search input with X button', async ({ page }) => {
        const searchInput = page.locator('input[placeholder="Bilder oder Tags suchen..."]');
        await searchInput.fill('test');
        // Base UI Combobox.Clear renders as a button inside the .w-72.relative container
        const searchContainer = page.locator('div').filter({
            has: page.locator('input[placeholder="Bilder oder Tags suchen..."]'),
        }).first();
        const clearButton = searchContainer.locator('button');
        await expect(clearButton).toBeVisible();
        await clearButton.click();
        await expect(searchInput).toHaveValue('');
    });

    test('should display sort dropdown with default sort option', async ({ page }) => {
        // Default sort is 'name' = "Name" in German
        await expect(page.getByText('Name').first()).toBeVisible();
    });

    test('should display rating filter button', async ({ page }) => {
        // Rating filter button shows "Bewertung" when no filter active
        await expect(page.getByText('Bewertung').first()).toBeVisible();
    });
});

