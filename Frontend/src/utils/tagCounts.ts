import type { ImageFile } from '../types';

export interface TagCount {
  name: string;
  count: number;
}

export const countImageTags = (images: Pick<ImageFile, 'tags'>[]): TagCount[] => {
  const tagCounts = new Map<string, number>();

  images.forEach((img) => {
    img.tags?.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};
