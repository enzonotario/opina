type RefreshFn = () => unknown

/**
 * Periodically call `refresh` while the tab is visible.
 * Preference is shared across pages via localStorage (default: on).
 */
export function useAutoRefresh(
  refresh: RefreshFn,
  options: {
    intervalMs?: number
    key?: string
  } = {},
) {
  const intervalMs = options.intervalMs ?? 10_000
  const autoRefresh = useLocalStorage(options.key ?? 'opina:auto-refresh', true)
  const visibility = useDocumentVisibility()

  const { pause, resume } = useIntervalFn(() => {
    void refresh()
  }, intervalMs, { immediate: false })

  watch([autoRefresh, visibility], ([enabled, vis]) => {
    if (enabled && vis === 'visible') resume()
    else pause()
  }, { immediate: true })

  return { autoRefresh }
}
