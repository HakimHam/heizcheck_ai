import { DISCLAIMER } from '@/lib/disclaimer'

export function Disclaimer() {
  return (
    <footer className="disclaimer" role="note">
      <strong>Hinweis:</strong> {DISCLAIMER}
    </footer>
  )
}
