import React, { useEffect, useState } from 'react'
import { Dashboard } from './dashboard/Dashboard'
import { Login } from './dashboard/Login'
import { EditorShell } from './editor/EditorShell'
import { isCloud, supabase } from './lib/supabase'

type Route = { view: 'dashboard' } | { view: 'editor'; projectId: string }

function routeFromHash(): Route {
  const m = /^#\/edit\/(.+)$/.exec(location.hash)
  return m ? { view: 'editor', projectId: m[1] } : { view: 'dashboard' }
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash())
  const [authed, setAuthed] = useState<boolean | null>(isCloud ? null : true)

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (authed === null) {
    return <div className="flex h-screen items-center justify-center bg-ink-950 font-display italic text-paper-dim">Invite Studio</div>
  }
  if (!authed) return <Login />

  if (route.view === 'editor') {
    return (
      <EditorShell
        projectId={route.projectId}
        onBack={() => { location.hash = '' }}
      />
    )
  }
  return <Dashboard onOpen={id => { location.hash = `#/edit/${id}` }} />
}
