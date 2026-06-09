import { expect, type Page } from '@playwright/test';

export const expectAppShellVisible = async (page: Page) => {
  await expect(page.getByTestId('sidebar')).toBeVisible();
  await expect(page.getByTestId('main-content')).toBeVisible();
  await expect(page.getByTestId('tag-panel')).toBeVisible();
};

export const fillAndClearToolbarSearch = async (page: Page, value: string) => {
  const searchInput = page.getByTestId('toolbar-search-input');

  await searchInput.fill(value);
  await expect(searchInput).toHaveValue(value);

  const clearButton = page.getByTestId('toolbar-search-clear');
  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(searchInput).toHaveValue('');
};
