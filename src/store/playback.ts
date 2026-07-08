import { create } from 'zustand'

/** Drives one-shot animation previews on canvas objects. */
interface PlaybackState {
  nonce: number
  targets: 'all' | string[]
  play(targets: 'all' | string[]): void
}

export const usePlayback = create<PlaybackState>(set => ({
  nonce: 0,
  targets: [],
  play: targets => set(s => ({ nonce: s.nonce + 1, targets })),
}))
