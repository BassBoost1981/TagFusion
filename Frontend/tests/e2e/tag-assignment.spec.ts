import { test, expect } from '@playwright/test';

test.describe('Tag Assignment', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Wait for app to be ready
        await expect(page.getByTestId('sidebar')).toBeVisible();
    });

    test('should display tag panel with folder tags section', async ({ page }) => {
        // Verify the tag panel is visible
        const tagPanel = page.getByTestId('tag-panel');
        await expect(tagPanel).toBeVisible();

        // Verify the "Tags im Ordner" section exists
        await expect(page.getByText('Tags im Ordner')).toBeVisible();
    });

    test('should display tag library section', async ({ page }) => {
        // Verify the Tag Bibliothek section exists
        await expect(page.getByText('Tag Bibliothek')).toBeVisible();
    });

    test('should have search input for tags', async ({ page }) => {
        // Verify tag search input exists (using role-based selector)
        const tagPanel = page.getByTestId('tag-panel');
        const searchInput = tagPanel.locator('input');
        await expect(searchInput).toBeVisible();
    });

    test('should have settings button to open tag manager', async ({ page }) => {
        // Verify the settings button exists in the tag panel
        const settingsButton = page.getByTitle('Tag Manager öffnen');
        await expect(settingsButton).toBeVisible();
    });
});
