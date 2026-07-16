export interface Mascot {
  id: string
  title: string
  description: string
  image: string
}

export interface Suggestion {
  id: string
  mascotId: string
  name: string
  createdAt: string
  votes: number
}
