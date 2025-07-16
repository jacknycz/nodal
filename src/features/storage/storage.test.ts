import { boardStorage } from './storage'
import { supabaseStorage } from './supabaseStorage'

describe('boardStorage', () => {
  it('should call supabaseStorage.deleteDocument when deleting a document', async () => {
    const spy = jest.spyOn(supabaseStorage, 'deleteDocument').mockResolvedValue(undefined)
    await expect(boardStorage.deleteDocument('docid123')).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith('docid123')
    spy.mockRestore()
  })

  it('should warn for unimplemented getDocumentMetadata', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(boardStorage.getDocumentMetadata('docid123')).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith('getDocumentMetadata not yet implemented for Supabase storage')
    warn.mockRestore()
  })
}) 