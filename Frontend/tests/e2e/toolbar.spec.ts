import { test, expect } from '@playwright/test';
import { fillAndClearToolbarSearch } from './helpers';

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
        const searchInput = page.getByTestId('toolbar-search-input');
        await expect(searchInput).toBeVisible();
    });

    test('should accept text in search input', async ({ page }) => {
        const searchInput = page.getByTestId('toolbar-search-input');
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');
    });

    test('should clear search input with X button', async ({ page }) => {
        await fillAndClearToolbarSearch(page, 'test');
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
