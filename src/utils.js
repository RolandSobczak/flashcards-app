export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function useImageUrl(src) {
  if (!src) return null
  if (src.startsWith('data:') || src.startsWith('http') || src.startsWith('/') || src.startsWith('./')) {
    return src
  }
  return `data:image/png;base64,${src}`
}

export function parseMCQ(front) {
  const lines = front.split('\n')
  const optionRe = /^([a-d])\)\s*(.+)$/
  const options = []
  const questionLines = []

  for (const line of lines) {
    const m = line.trim().match(optionRe)
    if (m) {
      options.push({ letter: m[1], text: m[2] })
    } else if (options.length === 0 && line.trim()) {
      questionLines.push(line)
    }
  }

  if (options.length < 2) return null
  return { question: questionLines.join('\n').trim(), options }
}

export function getCorrectLetter(back) {
  const m = back.match(/^\*\*([a-d])\)/)
  return m ? m[1] : null
}
