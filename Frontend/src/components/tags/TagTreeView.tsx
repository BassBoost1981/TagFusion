import { useMemo } from 'react';
import { FolderTree, X } from 'lucide-react';
import { useTagStore } from '../../stores/tagStore';
import { useSelectedImages, useImages, useUpdateImageTags } from '../../stores/appStore';

interface TagTreeViewProps {
  onTagClick?: (tag: string) => void;
  searchQuery?: string;
}

export function TagTreeView({ onTagClick, searchQuery = '' }: TagTreeViewProps) {
  const { categories } = useTagStore();
  const selectedImages = useSelectedImages();
  const images = useImages();
  const updateImageTags = useUpdateImageTags();

  // O(1) lookup map for images by path
  const imageMap = useMemo(() => new Map(images.map(img => [img.path, img])), [images]);

  // Get all unique tags from selected images
  const selectedImagesTags = useMemo(() => {
    const selectedImgs = Array.from(selectedImages)
      .map(path => imageMap.get(path))
      .filter(Boolean);
    return new Set(selectedImgs.flatMap(img => img!.tags));
  }, [imageMap, selectedImages]);

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        subcategories: cat.subcategories
          .map(sub => ({
            ...sub,
            tags: sub.tags.filter(tag => tag.toLowerCase().includes(query))
          }))
          .filter(sub => sub.tags.length > 0)
      }))
      .filter(cat => cat.subcategories.length > 0);
  }, [categories, searchQuery]);

  // Add tag to selected images
  const handleTagClick = async (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
      return;
    }

    // Default behavior: add tag to selected images
    if (selectedImages.size === 0) return;

    for (const imagePath of selectedImages) {
      const image = imageMap.get(imagePath);
      if (image && !image.tags.includes(tag)) {
        await updateImageTags(imagePath, [...image.tags, tag]);
      }
    }
  };

  // Remove tag from selected images
  const handleRemoveTag = async (tag: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the add action
    if (selectedImages.size === 0) return;

    for (const imagePath of selectedImages) {
      const image = imageMap.get(imagePath);
      if (image && image.tags.includes(tag)) {
        await updateImageTags(imagePath, image.tags.filter(t => t !== tag));
      }
    }
  };

  if (filteredCategories.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <FolderTree size={20} className="mx-auto mb-2 opacity-50" />
        <p className="text-xs">{searchQuery ? 'Keine Tags gefunden' : 'Keine Tag-Bibliothek'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredCategories.map((cat) => (
        <div key={cat.id}>
          {/* Category Header */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-cyan-400 font-medium">
            <span>{cat.name}</span>
            <span className="text-xs text-slate-500 ml-auto">
              {cat.subcategories.reduce((acc, sub) => acc + sub.tags.length, 0)}
            </span>
          </div>

          {/* Subcategories - always expanded */}
          <div className="pl-2 space-y-1">
            {cat.subcategories.map((sub) => (
              <div key={sub.id}>
                {/* Subcategory Header */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-slate-400">
                  <span>{sub.name}</span>
                  <span className="text-slate-500 ml-auto">{sub.tags.length}</span>
                </div>

                {/* Tags - always visible */}
                {sub.tags.length > 0 && (
                  <div className="pl-3 py-1 flex flex-wrap gap-1.5">
                    {sub.tags.map((tag) => {
                      const isApplied = selectedImages.size > 0 && selectedImagesTags.has(tag);
                      return (
                        <div
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded-full text-xs cursor-pointer hover:scale-105 transition-transform"
                          style={{
                            background: isApplied
                              ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(6, 182, 212, 0.2) 100%)'
                              : 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)',
                            border: isApplied
                              ? '1px solid rgba(6, 182, 212, 0.6)'
                              : '1px solid rgba(6, 182, 212, 0.25)',
                          }}
                        >
                          <button
                            onClick={() => handleTagClick(tag)}
                            className={`px-2 py-0.5 ${isApplied ? 'text-cyan-300' : 'text-slate-200'}`}
                            title={selectedImages.size > 0 ? `"${tag}" zu ${selectedImages.size} Bild(ern) hinzufügen` : tag}
                          >
                            {tag}
                          </button>
                          {isApplied && (
                            <button
                              onClick={(e) => handleRemoveTag(tag, e)}
                              className="pr-1.5 pl-0.5 py-0.5 text-cyan-400 hover:text-red-400 transition-colors"
                              title={`"${tag}" von ${selectedImages.size} Bild(ern) entfernen`}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

