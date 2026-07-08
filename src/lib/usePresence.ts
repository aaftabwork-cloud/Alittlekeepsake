import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Peer { email: string; key: string }

/** Who else has this project open (Supabase Realtime presence; [] in local mode). */
export function usePresence(projectId: string | null): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([])

  useEffect(() => {
    if (!supabase || !projectId) return
    let email = 'unknown'
    const key = Math.random().toString(36).slice(2)
    const channel = supabase.channel(`presence:project:${projectId}`, {
      config: { presence: { key } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ email: string }>()
        const others: Peer[] = []
        for (const [k, metas] of Object.entries(state)) {
          if (k === key) continue
          for (const m of metas) others.push({ email: m.email, key: k })
        }
        setPeers(others)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          const { data } = await supabase!.auth.getUser()
          email = data.user?.email ?? 'teammate'
          await channel.track({ email })
        }
      })

    return () => { supabase?.removeChannel(channel) }
  }, [projectId])

  return peers
}
