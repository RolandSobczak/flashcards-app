import { useState, useEffect } from 'react'
import LatexContent from './LatexContent'
import { authFetch } from './auth'

// ── Exercise list ──────────────────────────────────────────────────────────────

function ExerciseList({ exercises, onSelect }) {
  return (
    <div className="task-list">
      {exercises.map((ex, i) => (
        <button key={ex.id} className="task-list-item" onClick={() => onSelect(ex)}>
          <span className="task-number">{i + 1}</span>
          <span className="task-title">{ex.title}</span>
          <span className="task-arrow">→</span>
        </button>
      ))}
    </div>
  )
}

// ── Answer input with live LaTeX preview ───────────────────────────────────────

function AnswerInput({ value, onChange }) {
  return (
    <div className="answer-input-wrap">
      <label className="answer-label">Twoja odpowiedź (LaTeX)</label>
      <input
        className="answer-input"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="np. A \oplus B"
        spellCheck={false}
      />
      {value.trim() && (
        <div className="answer-preview">
          <span className="answer-preview-label">Podgląd:</span>
          <span className="answer-preview-content">
            <LatexContent text={`$${value.trim()}$`} />
          </span>
        </div>
      )}
    </div>
  )
}

// ── Step-by-step solution ──────────────────────────────────────────────────────

function Solution({ steps, answer }) {
  return (
    <div className="solution">
      <div className="solution-header">Rozwiązanie krok po kroku</div>
      <ol className="solution-steps">
        {steps.map((step, i) => (
          <li key={i} className="solution-step">
            <div className="step-law">
              <LatexContent text={step.law} />
            </div>
            <div className="step-expr">
              <LatexContent text={step.expr} />
            </div>
          </li>
        ))}
      </ol>
      <div className="solution-answer">
        Odpowiedź: <LatexContent text={`$${answer}$`} />
      </div>
    </div>
  )
}

// ── Single exercise view ───────────────────────────────────────────────────────

function ExerciseDetail({ exercise, onBack }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null) // null | 'correct' | 'wrong'
  const [solution, setSolution] = useState(null)
  const [loadingSolution, setLoadingSolution] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    if (!answer.trim()) return
    setChecking(true)
    setResult(null)
    try {
      const res = await authFetch(`/api/exercises/${exercise.id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answer.trim() }),
      })
      const data = await res.json()
      setResult(data.correct ? 'correct' : 'wrong')
    } catch {
      setResult('error')
    } finally {
      setChecking(false)
    }
  }

  async function handleShowSolution() {
    if (solution) return
    setLoadingSolution(true)
    try {
      const res = await authFetch(`/api/exercises/${exercise.id}/solution`)
      setSolution(await res.json())
    } catch {
      setSolution({ error: true })
    } finally {
      setLoadingSolution(false)
    }
  }

  return (
    <div className="exercise-detail">
      <button className="btn-back" onClick={onBack}>← Wróć</button>

      <div className="exercise-question">
        <div className="exercise-question-label">Zadanie</div>
        <div className="exercise-question-title">{exercise.title}</div>
        <div className="exercise-question-body">
          <LatexContent text={exercise.question} />
        </div>
      </div>

      <AnswerInput value={answer} onChange={v => { setAnswer(v); setResult(null) }} />

      <div className="exercise-controls">
        <button
          className="btn-primary"
          onClick={handleCheck}
          disabled={!answer.trim() || checking}
        >
          {checking ? 'Sprawdzam…' : 'Sprawdź'}
        </button>
        <button
          className="btn-secondary"
          onClick={handleShowSolution}
          disabled={loadingSolution}
        >
          {loadingSolution ? 'Ładuję…' : 'Pokaż rozwiązanie'}
        </button>
      </div>

      {result === 'correct' && (
        <div className="result result-correct">✓ Poprawna odpowiedź!</div>
      )}
      {result === 'wrong' && (
        <div className="result result-wrong">✗ Niepoprawna — spróbuj jeszcze raz lub pokaż rozwiązanie.</div>
      )}
      {result === 'error' && (
        <div className="result result-wrong">Błąd połączenia z backendem.</div>
      )}

      {solution && !solution.error && (
        <Solution steps={solution.steps} answer={solution.answer} />
      )}
    </div>
  )
}

// ── Top-level tasks view ───────────────────────────────────────────────────────

export default function TasksView({ onBack }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    authFetch('/api/exercises')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then(data => { setExercises(data); setLoading(false) })
      .catch(() => {
        setError('Nie udało się wczytać zadań. Sprawdź, czy backend działa (jeśli sesja wygasła, zaloguj się ponownie).')
        setLoading(false)
      })
  }, [])

  if (selected) {
    return <ExerciseDetail exercise={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div className="tasks-view">
      <div className="tasks-header">
        <button className="btn-back" onClick={onBack}>← Menu</button>
        <h2 className="tasks-title">Zadania — Algebra Boole'a</h2>
      </div>

      {loading && <div className="tasks-status">Ładuję zadania…</div>}

      {error && (
        <div className="tasks-error">
          <div className="tasks-error-icon">⚠</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && exercises.length === 0 && (
        <div className="tasks-status">
          Brak zadań. Dodaj je do <code>backend/exercises.json</code>
          {' '}(wzór: <code>backend/exercises_example.json</code>).
        </div>
      )}

      {!loading && !error && exercises.length > 0 && (
        <ExerciseList exercises={exercises} onSelect={setSelected} />
      )}
    </div>
  )
}
