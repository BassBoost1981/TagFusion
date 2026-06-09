export const canNavigateUpFromFolder = (folderPath: string | null | undefined) => {
  if (!folderPath) return false;

  const normalized = folderPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 1;
};
