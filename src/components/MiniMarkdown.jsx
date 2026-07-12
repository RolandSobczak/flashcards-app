function splitTableRow(row) {
  const PLACEHOLDER = '\u0001'
  return row
    .replace(/\\\|/g, PLACEHOLDER)
    .split('|')
    .slice(1, -1)
    .map(c => c.trim().split(PLACEHOLDER).join('|'))
}

function renderInline(str, key) {
  const parts = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let lastIndex = 0
  let match
  let i = 0
  while ((match = re.exec(str)) !== null) {
    if (match.index > lastIndex) parts.push(str.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('`')) {
      parts.push(<code key={`${key}-${i++}`}>{token.slice(1, -1)}</code>)
    } else {
      parts.push(<strong key={`${key}-${i++}`}>{token.slice(2, -2)}</strong>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < str.length) parts.push(str.slice(lastIndex))
  return parts
}

function parseBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length
      blocks.push({ type: 'heading', level, content: line.replace(/^#{1,3}\s/, '') })
      i++
      continue
    }

    if (line.trim() === '---') {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    if (/^\s*-\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*-\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s/, ''))
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }

    if (line.startsWith('>')) {
      const quoteLines = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', content: quoteLines.join('\n') })
      continue
    }

    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i])
        i++
      }
      const cells = rows
        .filter(r => !/^\|[\s-:|]+\|$/.test(r))
        .map(splitTableRow)
      blocks.push({ type: 'table', header: cells[0], rows: cells.slice(1) })
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('|') &&
      lines[i].trim() !== '---' &&
      !/^\s*-\s/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', content: paraLines.join('\n') })
  }

  return blocks
}

export default function MiniMarkdown({ text }) {
  const blocks = parseBlocks(text)

  return (
    <div className="docs-markdown">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          const Tag = `h${Math.min(b.level + 1, 4)}`
          return <Tag key={i}>{renderInline(b.content, i)}</Tag>
        }
        if (b.type === 'code') {
          return (
            <pre key={i} className="docs-code">
              <code>{b.content}</code>
            </pre>
          )
        }
        if (b.type === 'hr') return <hr key={i} />
        if (b.type === 'quote') return <blockquote key={i}>{renderInline(b.content, i)}</blockquote>
        if (b.type === 'list') {
          return (
            <ul key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item, `${i}-${j}`)}</li>
              ))}
            </ul>
          )
        }
        if (b.type === 'table') {
          return (
            <table key={i} className="docs-table">
              <thead>
                <tr>
                  {b.header.map((h, j) => (
                    <th key={j}>{renderInline(h, `${i}h${j}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k}>{renderInline(cell, `${i}${j}${k}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
        return <p key={i}>{renderInline(b.content, i)}</p>
      })}
    </div>
  )
}
