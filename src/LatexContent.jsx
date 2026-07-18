import katex from 'katex'
import 'katex/dist/katex.min.css'

// Renders text with inline ($...$) and display ($$...$$) LaTeX blocks
export default function LatexContent({ text }) {
  if (!text) return null

  const parts = []
  // Split on $$...$$ first, then $...$
  const displayRegex = /\$\$([\s\S]+?)\$\$/g
  const inlineRegex = /\$((?:[^$\\]|\\.)+?)\$/g

  let remaining = text
  let key = 0

  // Process display math blocks
  const segments = []
  let lastIndex = 0
  let match

  const combined = /\$\$([\s\S]+?)\$\$|\$((?:[^$\\]|\\.)+?)\$/g
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    if (match[0].startsWith('$$')) {
      segments.push({ type: 'display', value: match[1] })
    } else {
      segments.push({ type: 'inline', value: match[2] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>
        try {
          const html = katex.renderToString(seg.value, {
            displayMode: seg.type === 'display',
            throwOnError: false,
            strict: false,
          })
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: html }}
              style={seg.type === 'display' ? { display: 'block', textAlign: 'center', margin: '8px 0' } : undefined}
            />
          )
        } catch {
          return <span key={i}>{seg.value}</span>
        }
      })}
    </span>
  )
}
