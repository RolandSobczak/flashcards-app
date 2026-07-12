import { useState } from 'react'
import LatexContent from '../LatexContent'
import { useImageUrl, parseMCQ, getCorrectLetter, fileToDataUrl } from '../utils'
import { updateCard } from '../api'

function EditImageField({ label, image, onChange }) {
  const url = useImageUrl(image)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    onChange(await fileToDataUrl(file))
    e.target.value = ''
  }

  return (
    <div className="edit-image-field">
      <span className="edit-field-label">{label}</span>
      {url && <img className="card-image edit-image-preview" src={url} alt="" />}
      <div className="edit-image-actions">
        <label className="btn-secondary btn-small">
          {url ? 'Zamień obraz' : 'Dodaj obraz'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        {url && (
          <button type="button" className="btn-danger btn-small" onClick={() => onChange(null)}>
            Usuń obraz
          </button>
        )}
      </div>
    </div>
  )
}

function BrowseCardEdit({ card, onSaved, onCancel }) {
  const [draft, setDraft] = useState({
    front: card.front,
    back: card.back,
    frontImage: card.frontImage,
    backImage: card.backImage,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    const payload = {}
    if (draft.front !== card.front) payload.front = draft.front
    if (draft.back !== card.back) payload.back = draft.back
    if (draft.frontImage !== card.frontImage) payload.frontImage = draft.frontImage
    if (draft.backImage !== card.backImage) payload.backImage = draft.backImage

    if (Object.keys(payload).length === 0) {
      onCancel()
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await updateCard(card.id, payload)
      onSaved(updated)
    } catch {
      setError('Nie udało się zapisać zmian.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="browse-card-body">
      <label className="edit-field-label" htmlFor={`front-${card.id}`}>Przód</label>
      <textarea
        id={`front-${card.id}`}
        className="edit-textarea"
        rows={4}
        value={draft.front}
        onChange={e => setDraft(d => ({ ...d, front: e.target.value }))}
      />
      <EditImageField
        label="Obraz (przód)"
        image={draft.frontImage}
        onChange={img => setDraft(d => ({ ...d, frontImage: img }))}
      />

      {!card.matching && (
        <>
          <label className="edit-field-label" htmlFor={`back-${card.id}`}>Tył</label>
          <textarea
            id={`back-${card.id}`}
            className="edit-textarea"
            rows={4}
            value={draft.back}
            onChange={e => setDraft(d => ({ ...d, back: e.target.value }))}
          />
          <EditImageField
            label="Obraz (tył)"
            image={draft.backImage}
            onChange={img => setDraft(d => ({ ...d, backImage: img }))}
          />
        </>
      )}

      {error && <div className="edit-error">{error}</div>}

      <div className="browse-card-edit-actions">
        <button className="btn-primary btn-small" onClick={handleSave} disabled={saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </button>
        <button className="btn-secondary btn-small" onClick={onCancel} disabled={saving}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

function BrowseCard({ card, index, onCardUpdated }) {
  const [editing, setEditing] = useState(false)
  const frontImgUrl = useImageUrl(card.frontImage)
  const backImgUrl = useImageUrl(card.backImage)
  const mcq = parseMCQ(card.front)
  const correctLetter = mcq ? getCorrectLetter(card.back) : null

  return (
    <div className="browse-card">
      <div className="browse-card-index">{index + 1}</div>
      {editing ? (
        <BrowseCardEdit
          card={card}
          onSaved={updated => { onCardUpdated(updated); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="browse-card-body">
          {card.matching ? (
            <>
              <div className="browse-card-front"><LatexContent text={card.front} /></div>
              {frontImgUrl && <img className="card-image" src={frontImgUrl} alt="" />}
              <ul className="browse-matching-list">
                {card.matching.pairs.map(([left, right], i) => (
                  <li key={i}>
                    <LatexContent text={left} /> <span className="matching-sep">→</span> <LatexContent text={right} />
                  </li>
                ))}
              </ul>
            </>
          ) : mcq && correctLetter ? (
            <>
              <div className="browse-card-front"><LatexContent text={mcq.question} /></div>
              {frontImgUrl && <img className="card-image" src={frontImgUrl} alt="" />}
              <ul className="browse-mcq-list">
                {mcq.options.map(({ letter, text }) => (
                  <li key={letter} className={letter === correctLetter ? 'browse-mcq-correct' : ''}>
                    <span className="mcq-letter">{letter})</span> <LatexContent text={text} />
                  </li>
                ))}
              </ul>
              <div className="browse-card-divider" />
              <div className="browse-card-back"><LatexContent text={card.back} /></div>
              {backImgUrl && <img className="card-image" src={backImgUrl} alt="" />}
            </>
          ) : (
            <>
              <div className="browse-card-front"><LatexContent text={card.front} /></div>
              {frontImgUrl && <img className="card-image" src={frontImgUrl} alt="" />}
              <div className="browse-card-divider" />
              <div className="browse-card-back"><LatexContent text={card.back} /></div>
              {backImgUrl && <img className="card-image" src={backImgUrl} alt="" />}
              {card.symbols && (
                <ul className="card-symbols">
                  {card.symbols.split(';').map((s, i) => (
                    <li key={i}><LatexContent text={s.trim()} /></li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button className="btn-secondary btn-small browse-card-edit-btn" onClick={() => setEditing(true)}>
            Edytuj
          </button>
        </div>
      )}
    </div>
  )
}

export default function BrowseView({ cards, onBack, onCardUpdated }) {
  return (
    <div className="browse-view">
      <div className="browse-toolbar">
        <button className="btn-back" onClick={onBack}>← Wróć</button>
        <span className="browse-count">{cards.length} kart</span>
      </div>
      <div className="browse-list">
        {cards.map((card, i) => (
          <BrowseCard key={card.id} card={card} index={i} onCardUpdated={onCardUpdated} />
        ))}
      </div>
    </div>
  )
}
