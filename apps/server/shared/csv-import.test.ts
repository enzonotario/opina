import { describe, expect, it } from 'vitest'
import {
  isHotjarExport,
  normalizeDevice,
  parseCsv,
  parseImportDate,
  parseScore,
  splitUrl,
  suggestCsvMapping,
} from './csv-import'

const HOTJAR_HEADER = [
  'Number',
  'User',
  'Date Submitted',
  'Country',
  'Source URL',
  'Device',
  'Browser',
  'OS',
  'Hotjar User ID',
  'Response URL',
  '¿Cómo calificarías tu satisfacción con Compara Tasas?',
  'Dejanos tu comentario sobre tu calificación',
  'Tags for: ¿Cómo calificarías tu satisfacción con Compara Tasas?',
  'Tags for: Dejanos tu comentario sobre tu calificación',
]

describe('csv-import', () => {
  it('parses quoted Hotjar-style rows', () => {
    const csv = [
      HOTJAR_HEADER.map(h => `"${h}"`).join(','),
      '"278","8cbc3d60","2026-10-03 18:06:56","Argentina","https://comparatasas.ar/","phone","Chrome","Android","vid","https://insights.hotjar.com/x","5","Excelente, genial","",""',
    ].join('\n')

    const { headers, records } = parseCsv(csv)
    expect(headers).toEqual(HOTJAR_HEADER)
    expect(records).toHaveLength(1)
    expect(records[0]!['Source URL']).toBe('https://comparatasas.ar/')
    expect(records[0]!['¿Cómo calificarías tu satisfacción con Compara Tasas?']).toBe('5')
    expect(records[0]!['Dejanos tu comentario sobre tu calificación']).toBe('Excelente, genial')
  })

  it('suggests Hotjar mapping from question columns', () => {
    expect(isHotjarExport(HOTJAR_HEADER)).toBe(true)
    const mapping = suggestCsvMapping(HOTJAR_HEADER)
    expect(mapping.date).toBe('Date Submitted')
    expect(mapping.url).toBe('Source URL')
    expect(mapping.device).toBe('Device')
    expect(mapping.visitor).toBe('Hotjar User ID')
    expect(mapping.score).toBe('¿Cómo calificarías tu satisfacción con Compara Tasas?')
    expect(mapping.comment).toBe('Dejanos tu comentario sobre tu calificación')
  })

  it('normalizes devices and dates', () => {
    expect(normalizeDevice('phone')).toBe('mobile')
    expect(normalizeDevice('tablet')).toBe('tablet')
    expect(normalizeDevice('desktop')).toBe('desktop')
    expect(parseScore('5', 'csat')).toBe(5)
    expect(parseScore('0', 'thumbs')).toBe(0)
    expect(parseImportDate('2026-10-03 18:06:56')).toBeTruthy()
    expect(splitUrl('https://comparatasas.ar/fondos/').path).toBe('/fondos/')
  })
})
