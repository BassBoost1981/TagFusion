import { test, expect } from '@playwright/test';
import { expectAppShellVisible } from './helpers';

test.describe('Navigation', () => {
    test('should load application and show main layout components', async ({ page }) => {
        // Go to the app
        await page.goto('/');

        // Wait for the app to load (basic check)
        await expect(page).toHaveTitle(/TagFusion/);

        await expectAppShellVisible(page);
    });

    test('should show hero section when no folder is selected', async ({ page }) => {
        await page.goto('/');

        // When no folder is selected, HeroSection should be visible in MainContent
        // We can search for the "Willkommen bei TagFusion" text which is likely in HeroSection
        await expect(page.getByText(/Willkommen bei TagFusion/i)).toBeVisible();
    });
});
