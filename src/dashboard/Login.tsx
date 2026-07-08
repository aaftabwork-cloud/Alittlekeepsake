import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Magic-link sign-in for the team workspace (cloud mode only). */
export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setError('')
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 text-paper">
      <div className="pointer-events-none fixed inset-0 dashboard-glow" />
      <div className="relative z-10 w-[360px] rounded-2xl bg-ink-850 p-8 shadow-pop ring-1 ring-ink-700">
        <div className="mb-6 flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#ffffff" />
            <path d="M16 5.5c2.2 4.4 5.9 8.1 10.5 10.5C21.9 18.4 18.2 22.1 16 26.5 13.8 22.1 10.1 18.4 5.5 16 10.1 13.6 13.8 9.9 16 5.5Z" fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="16" cy="16" r="2.1" fill="#3b82f6" />
          </svg>
          <div>
            <h1 className="font-display text-xl italic text-paper">Invite Studio</h1>
            <p className="text-2xs text-paper-faint">team workspace</p>
          </div>
        </div>
        {sent ? (
          <p className="text-sm leading-relaxed text-paper-dim">
            Check <span className="text-paper">{email}</span> for a sign-in link.
          </p>
        ) : (
          <>
            <label className="mb-1.5 block text-2xs font-medium uppercase tracking-[0.14em] text-paper-faint">Work email</label>
            <input
              className="mb-3 h-9 w-full rounded-lg bg-ink-950 px-3 text-sm text-paper outline-none ring-1 ring-inset ring-ink-700 focus:ring-gold/60"
              placeholder="you@studio.com"
              value={email}
              type="email"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
            />
            {error && <p className="mb-3 text-2xs text-danger">{error}</p>}
            <button
              className="h-9 w-full rounded-lg bg-gold text-xs font-semibold text-ink-950 transition hover:bg-gold-bright disabled:opacity-50"
              disabled={!email.includes('@')}
              onClick={send}
            >
              Send magic link
            </button>
          </>
        )}
      </div>
    </div>
  )
}
