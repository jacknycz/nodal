export interface CursorUser {
  id: string
  name: string
  avatar?: string
  color: string
}

export interface CursorPayload {
  user: CursorUser
  x: number // board coords
  y: number // board coords
  ts: number // ms epoch
}


