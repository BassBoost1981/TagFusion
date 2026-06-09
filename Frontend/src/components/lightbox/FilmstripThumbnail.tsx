import { forwardRef, useEffect } from 'react';
import type { ImageFile } from '../../types';
import { useThumbnail, requestThumbnail } from '../../hooks/useThumbnailManager';

interface FilmstripThumbnailProps {
  image: ImageFile;
  isActive: boolean;
  onSelect: () => void;
}

/**
 * Single filmstrip entry. Sources its thumbnail through the thumbnail manager so a
 * lightbox edit (rotate/flip) that calls invalidateThumbnail also refreshes here —
 * the previous inline version read a static prop and stayed stale after edits.
 * Bezieht das Vorschaubild über den Thumbnail-Manager, damit Bildbearbeitungen
 * (Drehen/Spiegeln) auch in der Filmstrip-Leiste aktualisiert werden.
 */
export const FilmstripThumbnail = forwardRef<HTMLButtonElement, FilmstripThumbnailProps>(function FilmstripThumbnail(
  { image, isActive, onSelect },
  ref
) {
  const [thumbnail] = useThumbnail(image.path, image.thumbnailBase64);

  // Filmstrip is horizontally scrollable; request the thumbnail when this entry mounts.
  useEffect(() => {
    requestThumbnail(image.path);
  }, [image.path]);

  // Manager returns either an http(s) virtual-host URL or legacy base64.
  const thumbSrc = thumbnail
    ? thumbnail.startsWith('http')
      ? thumbnail
      : `data:image/jpeg;base64,${thumbnail}`
    : image.thumbnailUrl || '';

  return (
    <button
      ref={ref}
      onClick={onSelect}
      title={image.fileName}
      className={`
          flex-shrink-0 rounded overflow-hidden transition-all duration-150
          outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
          ${isActive ? 'ring-2 ring-cyan-400 opacity-100 brightness-110' : 'opacity-40 hover:opacity-75'}
        `}
      style={{ width: 56, height: 40 }}
    >
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={image.fileName}
          className="w-full h-full object-cover"
          draggable={false}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-slate-700 flex items-center justify-center">
          <span className="text-[8px] text-slate-400 truncate px-0.5">{image.fileName}</span>
        </div>
      )}
    </button>
  );
});
