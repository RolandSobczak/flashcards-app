import { useState } from 'react'
import { requestCode, verifyCode } from './auth'

// Two-step passwordless login: enter an email, receive a one-time code
// (delivered by email — in local dev it lands in Mailpit at
// http://localhost:8026), then enter the code to get a session. On success
// auth.js stores the token and notifies App, which swaps this screen out.
export default function Login() {
  const [step, setStep] = useState('email') // email | code
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleRequest(e) {
    e.preventDefault()
    if (!email.trim() || busy) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await requestCode(email.trim())
      setStep('code')
      setInfo('Wysłaliśmy kod na podany adres. Sprawdź skrzynkę (w trybie dev: Mailpit — http://localhost:8026).')
    } catch (err) {
      setError(err.message || 'Nie udało się wysłać kodu.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email.trim(), code.trim())
      // success → auth.js notifies App, this component unmounts.
    } catch (err) {
      setError(err.message || 'Nieprawidłowy kod.')
    } finally {
      setBusy(false)
    }
  }

  function backToEmail() {
    setStep('email')
    setCode('')
    setError(null)
    setInfo(null)
  }

  return (
    <div className="login">
      <div className="login-card">
        <h2 className="login-title">Zaloguj się</h2>

        {step === 'email' && (
          <form className="login-form" onSubmit={handleRequest}>
            <p className="login-desc">Podaj adres e-mail, a wyślemy Ci jednorazowy kod logowania.</p>
            <label className="answer-label" htmlFor="login-email">Adres e-mail</label>
            <input
              id="login-email"
              className="answer-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ty@example.com"
              autoComplete="email"
              autoFocus
              spellCheck={false}
            />
            <button className="btn-primary login-submit" type="submit" disabled={!email.trim() || busy}>
              {busy ? 'Wysyłam…' : 'Wyślij kod'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form className="login-form" onSubmit={handleVerify}>
            <p className="login-desc">Wpisz kod wysłany na <strong>{email.trim()}</strong>.</p>
            <label className="answer-label" htmlFor="login-code">Kod z e-maila</label>
            <input
              id="login-code"
              className="answer-input"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="np. 123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              spellCheck={false}
            />
            <button className="btn-primary login-submit" type="submit" disabled={!code.trim() || busy}>
              {busy ? 'Sprawdzam…' : 'Zaloguj się'}
            </button>
            <button className="btn-secondary login-back" type="button" onClick={backToEmail} disabled={busy}>
              ← Zmień adres e-mail
            </button>
          </form>
        )}

        {info && <div className="login-info">{info}</div>}
        {error && (
          <div className="tasks-error login-error">
            <div className="tasks-error-icon">⚠</div>
            <div>{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}
