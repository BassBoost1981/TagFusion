import { useTranslation } from 'react-i18next';
import { Play, X, Power } from 'lucide-react';
import { useDescriptionStore } from '../../stores/descriptionStore';
import { useCurrentFolder } from '../../stores/appStore';
import { GlassModal, GlassButton } from '../ui/glass';
import { DESCRIPTION_PROMPTS } from '../../constants/descriptionPrompts';

const fieldClasses =
  'w-full h-10 text-sm px-4 rounded-lg backdrop-blur-glass-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500/50 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const textareaClasses =
  'w-full text-sm px-4 py-2 rounded-lg backdrop-blur-glass-sm bg-[var(--glass-bg)] border border-[var(--glass-border)] text-slate-100 placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500/50 transition-all duration-150';

export function DescriptionDialog() {
  const { t } = useTranslation();
  const currentFolder = useCurrentFolder();
  const {
    isDialogOpen, serverStatus, precheck, selectedModel, promptText, overwriteExisting,
    closeDialog, setModel, setPrompt, setOverwrite, startScan, startServer, stopServer,
  } = useDescriptionStore();

  if (!isDialogOpen || !currentFolder) return null;

  const reachable = serverStatus?.reachable === true;
  const loading = serverStatus === null;
  const canStart = reachable && !!selectedModel && promptText.trim().length > 0;

  return (
    <GlassModal isOpen={isDialogOpen} onClose={closeDialog} title={t('descriptions.dialogTitle')}>
      <div className="flex flex-col gap-4 p-1">
        {/* Server status + control / Serverstatus + Steuerung */}
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm ${reachable ? 'text-emerald-400' : 'text-amber-400'}`}>
            {loading
              ? '…'
              : reachable
                ? serverStatus!.state === 'loading' || serverStatus!.state === 'downloading'
                  ? t('descriptions.serverBusy', { progress: Math.max(0, Math.round(serverStatus!.progress)) })
                  : t('descriptions.serverOk')
                : serverStatus?.managedByApp
                  ? t('descriptions.serverStarting')
                  : serverStatus?.lastStartError
                    ? t('descriptions.serverFailed', { reason: serverStatus.lastStartError })
                    : t('descriptions.serverDown')}
          </p>
          {!loading && !reachable && (
            <GlassButton variant="ghost" onClick={() => void startServer()}>
              <Power size={16} /> {t('descriptions.startServer')}
            </GlassButton>
          )}
          {reachable && serverStatus?.managedByApp && (
            <GlassButton variant="ghost" onClick={() => void stopServer()}>
              <Power size={16} /> {t('descriptions.stopServer')}
            </GlassButton>
          )}
        </div>

        {/* Model / Modell */}
        <label className="flex flex-col gap-1 text-sm">
          {t('descriptions.model')}
          <select
            value={selectedModel}
            onChange={(e) => setModel(e.target.value)}
            disabled={!reachable}
            className={fieldClasses}
          >
            {(serverStatus?.models ?? []).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        {/* Prompt template + editable text / Vorlage + editierbarer Prompt */}
        <label className="flex flex-col gap-1 text-sm">
          {t('descriptions.promptTemplate')}
          <select
            onChange={(e) => {
              const tpl = DESCRIPTION_PROMPTS.find((p) => p.id === e.target.value);
              if (tpl) setPrompt(tpl.text);
            }}
            className={fieldClasses}
            defaultValue=""
          >
            <option value="" disabled>{t('descriptions.promptTemplate')}</option>
            {DESCRIPTION_PROMPTS.map((p) => (
              <option key={p.id} value={p.id}>{t(p.labelKey)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('descriptions.promptLabel')}
          <textarea
            value={promptText}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className={textareaClasses}
          />
        </label>

        {/* Existing descriptions / Vorhandene Beschreibungen */}
        {precheck && precheck.withDescription > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-3 text-sm">
            <p>{t('descriptions.existing', { count: precheck.withDescription, total: precheck.total })}</p>
            <label className="flex items-center gap-2">
              <input type="radio" checked={!overwriteExisting} onChange={() => setOverwrite(false)} />
              {t('descriptions.skipExisting')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={overwriteExisting} onChange={() => setOverwrite(true)} />
              {t('descriptions.overwriteExisting')}
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <GlassButton variant="ghost" onClick={closeDialog}>
            <X size={16} /> {t('descriptions.cancel')}
          </GlassButton>
          <GlassButton disabled={!canStart} onClick={() => void startScan(currentFolder)}>
            <Play size={16} /> {t('descriptions.start')}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
