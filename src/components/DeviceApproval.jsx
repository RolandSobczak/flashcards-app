import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, ShieldX, TriangleAlert } from 'lucide-react'
import { approveDevice, denyDevice, deviceInfo } from '../api'

const OPIS_STANU = {
  pending: 'czeka na Twoją decyzję',
  approved: 'już zatwierdzone',
  denied: 'odrzucone',
  expired: 'nieaktualne — minął termin',
}

export default function DeviceApproval({ code, onDone }) {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [wynik, setWynik] = useState(null)

  useEffect(() => {
    let cancelled = false
    deviceInfo(code)
      .then(data => { if (!cancelled) setInfo(data) })
      .catch(err => { if (!cancelled) setError(err.message || 'Nie znalazłem tego żądania.') })
    return () => { cancelled = true }
  }, [code])

  async function decyzja(zatwierdzam) {
    setBusy(true)
    setError(null)
    try {
      await (zatwierdzam ? approveDevice(code) : denyDevice(code))
      setWynik(zatwierdzam ? 'approved' : 'denied')
    } catch (err) {
      setError(err.message || 'Nie udało się zapisać decyzji.')
    } finally {
      setBusy(false)
    }
  }

  if (wynik) {
    return (
      <div className="device-approval">
        <div className="device-approval-icon">
          {wynik === 'approved' ? <ShieldCheck size={28} aria-hidden="true" /> : <ShieldX size={28} aria-hidden="true" />}
        </div>
        <h2>{wynik === 'approved' ? 'Dostęp przyznany' : 'Dostęp odrzucony'}</h2>
        <p>
          {wynik === 'approved'
            ? 'Narzędzie odbierze własny token przy najbliższym sprawdzeniu. Możesz zamknąć tę kartę.'
            : 'Nic nie zostało przyznane.'}
        </p>
        <button className="btn-primary" onClick={onDone}>Wróć do fiszek</button>
      </div>
    )
  }

  return (
    <div className="device-approval">
      <div className="device-approval-icon"><KeyRound size={28} aria-hidden="true" /></div>
      <h2>Zalogować narzędzie?</h2>

      {error && (
        <div className="tasks-error">
          <div className="tasks-error-icon"><TriangleAlert size={20} aria-hidden="true" /></div>
          <div>{error}</div>
        </div>
      )}

      {!info && !error && <div className="tasks-status">Sprawdzam żądanie…</div>}

      {info && (
        <>
          <div className="device-approval-code">{info.userCode}</div>
          <dl className="device-approval-meta">
            <dt>Narzędzie</dt>
            <dd>{info.clientName}</dd>
            <dt>Stan</dt>
            <dd>{OPIS_STANU[info.status] ?? info.status}</dd>
          </dl>
          <p className="device-approval-warn">
            Zatwierdzenie daje temu narzędziu taki sam dostęp do Twoich zestawów jaki masz tutaj —
            czytanie, zmianę i kasowanie. Rób to tylko dla kodu, który sam widzisz u siebie na ekranie.
          </p>
          <div className="device-approval-actions">
            <button
              className="btn-primary"
              onClick={() => decyzja(true)}
              disabled={busy || info.status !== 'pending'}
            >
              Zatwierdź
            </button>
            <button className="btn-secondary" onClick={() => decyzja(false)} disabled={busy}>
              Odrzuć
            </button>
          </div>
        </>
      )}

      <button className="btn-secondary btn-small" onClick={onDone}>Wróć do fiszek</button>
    </div>
  )
}
