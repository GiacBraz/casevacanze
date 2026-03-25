'use client'
import { useState, useEffect } from 'react'
import Calendar from '@/components/Calendar'

const NOMI_VALIDI = [
  'Giacomo', 'Francesca', 'Giorgio',
  'Simonetta', 'Gianluca', 'Tommaso', 'Michele'
]

export default function Home() {
  const [user, setUser] = useState<string | null>(null)
  const [nomeInput, setNomeInput] = useState('')
  const [ricordami, setRicordami] = useState(false)
  const [errore, setErrore] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const nomeSalvato = localStorage.getItem('casevacanze_utente')
    if (nomeSalvato) setUser(nomeSalvato)
  }, [])

  // Aspetta che la pagina sia pronta
  if (!mounted) return null

  const accedi = () => {
    const nomePulito = nomeInput.trim()

    // Controlla se c'è già un nome salvato
    const nomeSalvato = localStorage.getItem('casevacanze_utente')
    if (nomeSalvato && nomeSalvato.toLowerCase() !== nomePulito.toLowerCase()) {
      setErrore('Nice Try 😉')
      return
    }

    // Controlla se il nome è valido
    const nomeValido = NOMI_VALIDI.find(
      n => n.toLowerCase() === nomePulito.toLowerCase()
    )
    if (!nomeValido) {
      setErrore('Nome non riconosciuto. Controlla di aver scritto correttamente.')
      return
    }

    if (ricordami) {
      localStorage.setItem('casevacanze_utente', nomeValido)
    }
    setUser(nomeValido)
  }

  const esci = () => {
    setUser(null)
    setNomeInput('')
    setErrore('')
  }

  if (user) return <Calendar nome={user} onEsci={esci} />

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">

        {/* TITOLO */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏠</div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            Case Vacanze
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Inserisci il tuo nome per accedere
          </p>
        </div>

        {/* INPUT NOME */}
        <input
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 mb-3 text-gray-900 text-base font-medium focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Il tuo nome (es. Giacomo)"
          value={nomeInput}
          onChange={e => {
            setNomeInput(e.target.value)
            setErrore('')
          }}
          onKeyDown={e => e.key === 'Enter' && accedi()}
          autoComplete="off"
          suppressHydrationWarning
        />

        {/* ERRORE */}
        {errore && (
          <p className="text-red-500 text-sm mb-3 text-center font-medium">
            {errore}
          </p>
        )}

        {/* RICORDAMI */}
        <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={ricordami}
            onChange={e => setRicordami(e.target.checked)}
            className="w-5 h-5 rounded accent-blue-600"
            suppressHydrationWarning
          />
          <span className="text-gray-600 text-sm">
            Ricordami su questo dispositivo
          </span>
        </label>

        {/* BOTTONE ACCEDI */}
        <button
          onClick={accedi}
          className="w-full bg-blue-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Accedi
        </button>

      </div>
    </div>
  )
}