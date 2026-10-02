import { type PackageStatus, PROGRESS_STEPS, STEPS_DONE } from '@/lib/package-status'

export function PackageProgress({ status }: { status: PackageStatus }) {
  const done = STEPS_DONE[status]
  return (
    <ol className="progress" aria-label="Fortschritt">
      {PROGRESS_STEPS.map((label, i) => {
        const state =
          i < done ? 'done' : i > done ? 'todo' : status === 'extraction_failed' ? 'failed' : 'current'
        return (
          <li key={label} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            {label}
          </li>
        )
      })}
    </ol>
  )
}
