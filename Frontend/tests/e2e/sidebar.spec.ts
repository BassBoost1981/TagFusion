import { test, expect } from '@playwright/test';

test.describe('Sidebar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('sidebar')).toBeVisible();
    });

    test('should display sidebar with favorites section', async ({ page }) => {
        const sidebar = page.getByTestId('sidebar');
        // Use heading role to get a unique element (avoids matching button + list aria-label)
        await expect(sidebar.getByRole('heading', { name: 'Favoriten' })).toBeVisible();
    });

    test('should display recently opened section', async ({ page }) => {
        const sidebar = page.getByTestId('sidebar');
        await expect(sidebar.getByText('Zuletzt geöffnet')).toBeVisible();
    });

    test('should display mock drives from dev bridge', async ({ page }) => {
        // Drives appear in both sidebar tree AND hero section - scope to sidebar tree
        const sidebar = page.getByTestId('sidebar');
        const tree = sidebar.getByRole('tree');
        await expect(tree.getByRole('treeitem', { name: /Lokaler Datenträger \(C:\)/ })).toBeVisible({ timeout: 3000 });
        await expect(tree.getByRole('treeitem', { name: /Daten \(D:\)/ })).toBeVisible();
        await expect(tree.getByRole('treeitem', { name: /Backup \(E:\)/ })).toBeVisible();
    });

    test('sidebar should be resizable (has resize handle)', async ({ page }) => {
        const sidebar = page.getByTestId('sidebar');
        // The resize handle is the right edge div
        const resizeHandle = sidebar.locator('.cursor-ew-resize').first();
        await expect(resizeHandle).toBeVisible();
    });
});

test.describe('Hero Section (no folder selected)', () => {
    test('should display welcome title', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByText('Willkommen bei TagFusion')).toBeVisible();
    });

    test('should display drives section in hero', async ({ page }) => {
        await page.goto('/');
        // Hero section shows "Geräte und Laufwerke"
        await expect(page.getByText('Geräte und Laufwerke')).toBeVisible({ timeout: 3000 });
    });

    test('should show TagFusion subtitle', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByText(/Organisiere deine Bildersammlung/)).toBeVisible();
    });
});

