import { useProjectArchiveContext } from '../../contexts';

export function ProjectArchivePanel() {
  const {
    projectName,
    isSupported,
    isReady,
    saving,
    configFileName,
    lastSavedLabel,
    error,
    selectProjectDirectory,
    clearProjectDirectory,
  } = useProjectArchiveContext();

  const statusText = saving
    ? 'Archiving...'
    : lastSavedLabel
      ? `Updated ${lastSavedLabel}`
      : projectName
        ? configFileName
        : 'No project';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-sans font-normal text-stone">Project Archive</label>
        <span className="max-w-[170px] truncate text-right text-xs font-sans text-silver">
          {statusText}
        </span>
      </div>

      <div className="rounded-container border border-border-light bg-white px-3 py-2">
        <div className="text-sm font-sans text-near-black truncate">
          {projectName || 'No project folder selected'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={selectProjectDirectory}
          disabled={!isSupported || !isReady}
          className="h-9 px-3 text-sm font-sans font-normal rounded-container border border-border-light bg-white text-near-black hover:border-light-gray disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {projectName ? 'Change' : 'Choose'}
        </button>
        <button
          type="button"
          onClick={clearProjectDirectory}
          disabled={!projectName}
          className="h-9 px-3 text-sm font-sans font-normal rounded-container border border-border-light bg-white text-near-black hover:border-light-gray disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>

      {!isSupported && (
        <div className="text-xs font-sans text-silver leading-relaxed">
          Project folders are unavailable in this browser.
        </div>
      )}

      {error && (
        <div className="px-3 py-2 text-xs font-sans bg-white border border-border-light rounded-container text-stone">
          {error}
        </div>
      )}
    </div>
  );
}
