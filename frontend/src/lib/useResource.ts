import { useEffect, useState } from 'react'

/** Keep responses tied to their request; an obsolete response cannot replace the current data. */
export function useResource<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{ key: string; value?: T; error?: string } | null>(null)
  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    fetcher(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setResult({ key, value })
      },
      (reason: unknown) => {
        if (!controller.signal.aborted)
          setResult({ key, error: reason instanceof Error ? reason.message : 'Request failed' })
      },
    )
    return () => controller.abort()
  }, [key, fetcher])
  const current = result?.key === key ? result : null
  return {
    previous: result,
    value: current?.value ?? null,
    error: current?.error ?? null,
    loading: key !== null && !current,
  }
}
