import { createDocumentNode, validateFile } from './documentUtils'

describe('validateFile', () => {
  it('should reject files over the max size', () => {
    const file = new File(['a'.repeat(11 * 1024 * 1024)], 'big.txt', { type: 'text/plain' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/exceeds the maximum limit/)
  })

  it('should reject unsupported file types', () => {
    const file = new File(['test'], 'file.exe', { type: 'application/x-msdownload' })
    const result = validateFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/not supported/)
  })

  it('should accept supported file types', () => {
    const file = new File(['test'], 'file.txt', { type: 'text/plain' })
    const result = validateFile(file)
    expect(result.valid).toBe(true)
  })
})

describe('createDocumentNode', () => {
  it('should create a document node with required fields', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const node = createDocumentNode(file, 'docid123', { x: 10, y: 20 }, 'hello world')
    expect(node.type).toBe('document')
    expect(node.data.documentId).toBe('docid123')
    expect(node.data.label).toBe('test')
    expect(node.data.status).toBe('ready')
    expect(node.data.extractedText).toBe('hello world')
  })

  it('should set status to error if extraction failed', () => {
    const file = new File([''], 'fail.txt', { type: 'text/plain' })
    const node = createDocumentNode(file, 'docid123', { x: 0, y: 0 }, '[Error extracting text from fail.txt]')
    expect(node.data.status).toBe('error')
  })

  it('should set status to processing if no extracted text', () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' })
    const node = createDocumentNode(file, 'docid123', { x: 0, y: 0 }, '')
    expect(node.data.status).toBe('processing')
  })
}) 