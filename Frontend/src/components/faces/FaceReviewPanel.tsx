import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, EyeOff } from 'lucide-react';
import { useFaceStore } from '../../stores/faceStore';
import { useCurrentFolder } from '../../stores/appStore';
import { GlassModal, GlassButton, GlassInput } from '../ui/glass';
import type { FaceCrop } from '../../types';

// Small strip of face crops. / Kleine Leiste mit Gesichts-Ausschnitten.
function CropStrip({ crops }: { crops: FaceCrop[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {crops.map((c) => (
        <img
          key={c.faceId}
          src={`data:image/jpeg;base64,${c.crop}`}
          alt={c.imagePath}
          title={c.imagePath}
          className="h-16 w-16 rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export function FaceReviewPanel() {
  const { t } = useTranslation();
  const currentFolder = useCurrentFolder();
  const { isPanelOpen, review, persons, confirmGroup, rejectSuggestion, ignoreGroup, closePanel } = useFaceStore();
  const [groupNames, setGroupNames] = useState<Record<number, string>>({});

  if (!isPanelOpen || !review || !currentFolder) return null;

  const isEmpty = review.suggestions.length === 0 && review.groups.length === 0;

  return (
    <GlassModal isOpen={isPanelOpen} onClose={closePanel} title={t('faces.reviewTitle')}>
      <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto p-1">
        {isEmpty && <p className="text-sm opacity-70">{t('faces.empty')}</p>}

        {review.suggestions.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase opacity-70">{t('faces.suggestionsHeading')}</h3>
            {review.suggestions.map((s) => (
              <div key={`${s.personId}-${s.faceIds[0]}`} className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
                <p className="font-medium">
                  {t('faces.suggestionQuestion', { name: s.personName })}{' '}
                  <span className="text-xs opacity-60">({t('faces.groupSize', { count: s.faceIds.length })})</span>
                </p>
                <CropStrip crops={s.sample} />
                <div className="flex gap-2">
                  <GlassButton onClick={() => void confirmGroup(s.faceIds, s.personName, currentFolder)}>
                    <Check size={16} /> {t('faces.confirm')}
                  </GlassButton>
                  <GlassButton variant="ghost" onClick={() => void rejectSuggestion(s.faceIds, currentFolder)}>
                    <X size={16} /> {t('faces.reject')}
                  </GlassButton>
                </div>
              </div>
            ))}
          </section>
        )}

        {review.groups.length > 0 && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase opacity-70">{t('faces.unknownHeading')}</h3>
            {review.groups.map((g, index) => (
              <div key={g.faceIds[0]} className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
                <p className="text-xs opacity-60">{t('faces.groupSize', { count: g.faceIds.length })}</p>
                <CropStrip crops={g.sample} />
                <div className="flex items-center gap-2">
                  <GlassInput
                    value={groupNames[index] ?? ''}
                    onChange={(e) => setGroupNames((prev) => ({ ...prev, [index]: e.target.value }))}
                    placeholder={t('faces.namePlaceholder')}
                    list={`persons-${index}`}
                  />
                  <datalist id={`persons-${index}`}>
                    {persons.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                  <GlassButton
                    disabled={!(groupNames[index] ?? '').trim()}
                    onClick={() => void confirmGroup(g.faceIds, (groupNames[index] ?? '').trim(), currentFolder)}
                  >
                    <Check size={16} /> {t('faces.confirm')}
                  </GlassButton>
                  <GlassButton variant="ghost" onClick={() => void ignoreGroup(g.faceIds, currentFolder)}>
                    <EyeOff size={16} /> {t('faces.ignore')}
                  </GlassButton>
                </div>
              </div>
            ))}
          </section>
        )}

        <p className="text-xs opacity-50">{t('faces.renameHint')}</p>
      </div>
    </GlassModal>
  );
}
