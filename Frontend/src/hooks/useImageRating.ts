import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/appStore';
import { useToastStore } from '../stores/toastStore';

/**
 * Manages rating state, optimistic updates, and error revert for an image.
 * Consolidates rating logic so it can be reused across components.
 */
export function useImageRating(imagePath: string, initialRating: number) {
  const { t } = useTranslation();
  const updateImageRating = useAppStore((s) => s.updateImageRating);
  const [rating, setRating] = useState(initialRating);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when prop changes (e.g. metadata reload)
  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  const handleRate = async (e: React.MouseEvent, starIndex: number) => {
    e.stopPropagation();
    const newRating = starIndex + 1;
    setRating(newRating);
    setIsSaving(true);
    try {
      await updateImageRating(imagePath, newRating);
      useToastStore.getState().success(
        `${t('imageCard.ratingSet')} ${'★'.repeat(newRating)}${'☆'.repeat(5 - newRating)}`
      );
    } catch (error) {
      console.error('Failed to save rating:', error);
      setRating(initialRating);
      useToastStore.getState().error(t('imageCard.ratingFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRating(0);
    setIsSaving(true);
    try {
      await updateImageRating(imagePath, 0);
    } catch (error) {
      console.error('Failed to clear rating:', error);
      setRating(initialRating);
    } finally {
      setIsSaving(false);
    }
  };

  return { rating, isSaving, handleRate, handleClear };
}
