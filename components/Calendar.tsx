'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSaturday,
  isSunday,
  parseISO,
  isMonday
} from 'date-fns'
import { it } from 'date-fns/locale'

// Raggruppa giorni consecutivi in intervalli
function raggruppaGiorni(date: string[]): { inizio: string; fine: string }[] {
  if (date.length === 0) return []
  const sorted = [...date].sort()
  const gruppi: { inizio: string; fine: string }[] = []
  let inizio = sorted[0]
  let fine = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diffGiorni = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diffGiorni === 1) {
      fine = sorted[i]
    } else {
      gruppi.push({ inizio, fine })
      inizio = sorted[i]
      fine = sorted[i]
    }
  }
  gruppi.push({ inizio, fine })
  return gruppi
}

export default function Calendar({
  nome,
  onEsci
}: {
  nome: string
  onEsci: () => void
}) {
  const [casa, setCasa] = useState<any>(null)
  const [caseList, setCaseList] = useState<any[]>([])
  const [mese, setMese] = useState(new Date())
  const [prenotazioni, setPrenotazioni] = useState<any[]>([])
  const [utente, setUtente] = useState<any>(null)
  const [giorniSelezionati, setGiorniSelezionati] = useState<string[]>([])
  const [messaggio, setMessaggio] = useState('')
  const [loading, setLoading] = useState(true)
  const [popupGiorno, setPopupGiorno] = useState<{
    data: string
    membro: string
    famiglia: string
  } | null>(null)

  useEffect(() => {
    caricaUtente()
    caricaCase()
  }, [])

  useEffect(() => {
    if (casa) caricaPrenotazioni()
  }, [mese, casa])

  const caricaUtente = async () => {
    const { data } = await supabase
      .from('utenti')
      .select('*, famiglie(nome)')
      .eq('nome', nome)
      .single()
    if (data) setUtente(data)
    setLoading(false)
  }

  const caricaCase = async () => {
    const { data } = await supabase
      .from('case_vacanze')
      .select('*')
    if (data && data.length > 0) {
      setCaseList(data)
      setCasa(data[0])
    }
  }

  const caricaPrenotazioni = async () => {
    const inizio = format(startOfMonth(mese), 'yyyy-MM-dd')
    const fine = format(endOfMonth(mese), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('prenotazioni')
      .select('*, utenti(id, nome, famiglia_id, famiglie(nome))')
      .eq('casa_id', casa.id)
      .gte('data_inizio', inizio)
      .lte('data_fine', fine)
    setPrenotazioni(data || [])
  }

  const giorniDelMese = eachDayOfInterval({
    start: startOfMonth(mese),
    end: endOfMonth(mese)
  })

  // Max giorni prenotabili per famiglia
  const getMaxGiorni = (famiglia: string) => {
    if (casa?.tipo === 'montagna') return 999
    const meseNum = mese.getMonth() + 1
    if (meseNum === 7) return famiglia === 'Simonetta' ? 16 : 15
    if (meseNum === 8) return famiglia === 'Simonetta' ? 15 : 16
    return 15
  }

  // Giorni già prenotati dalla famiglia nel mese
  const giorniUsatiPerFamiglia = (famiglia_id: string) => {
    let totale = 0
    prenotazioni
      .filter(p => p.utenti?.famiglia_id === famiglia_id)
      .forEach(p => {
        totale += eachDayOfInterval({
          start: parseISO(p.data_inizio),
          end: parseISO(p.data_fine)
        }).length
      })
    return totale
  }

  // Conta weekend (sabato+domenica) prenotati dalla famiglia
  const weekendUsatiPerFamiglia = (famiglia_id: string) => {
    const weekends = new Set<string>()
    prenotazioni
      .filter(p => p.utenti?.famiglia_id === famiglia_id)
      .forEach(p => {
        const giorni = eachDayOfInterval({
          start: parseISO(p.data_inizio),
          end: parseISO(p.data_fine)
        })
        // Cerca coppie sabato+domenica consecutive
        giorni.forEach(d => {
          if (isSaturday(d)) {
            const domenica = new Date(d)
            domenica.setDate(domenica.getDate() + 1)
            const domenicaStr = format(domenica, 'yyyy-MM-dd')
            // Controlla se la domenica è anche prenotata
            const domenicaPrenotata = giorni.some(
              g => format(g, 'yyyy-MM-dd') === domenicaStr
            ) || prenotazioni
              .filter(p2 => p2.utenti?.famiglia_id === famiglia_id)
              .some(p2 => {
                const g2 = eachDayOfInterval({
                  start: parseISO(p2.data_inizio),
                  end: parseISO(p2.data_fine)
                })
                return g2.some(g => format(g, 'yyyy-MM-dd') === domenicaStr)
              })
            if (domenicaPrenotata) {
              weekends.add(format(d, 'yyyy-ww'))
            }
          }
        })
      })
    return weekends.size
  }

  // Stato di un giorno nel calendario
  const getStatoGiorno = (giorno: Date) => {
    const giornoStr = format(giorno, 'yyyy-MM-dd')
    for (const p of prenotazioni) {
      const giorni = eachDayOfInterval({
        start: parseISO(p.data_inizio),
        end: parseISO(p.data_fine)
      })
      if (giorni.some(g => format(g, 'yyyy-MM-dd') === giornoStr)) {
        return {
          occupato: true,
          famiglia: p.utenti?.famiglie?.nome,
          membro: p.utenti?.nome
        }
      }
    }
    return { occupato: false, famiglia: null, membro: null }
  }
  
  const toggleGiorno = (giorno: Date) => {
    const giornoStr = format(giorno, 'yyyy-MM-dd')
    const stato = getStatoGiorno(giorno)
  
    // Admin clicca su giorno occupato → mostra popup
    if (stato.occupato && isAdmin) {
      setPopupGiorno({
        data: giornoStr,
        membro: stato.membro || '',
        famiglia: stato.famiglia || ''
      })
      return
    }
  
    if (stato.occupato) return
  
    setGiorniSelezionati(prev =>
      prev.includes(giornoStr)
        ? prev.filter(g => g !== giornoStr)
        : [...prev, giornoStr]
    )
  }

  const prenota = async () => {
    if (!utente || giorniSelezionati.length === 0) return
    setMessaggio('')

    const nomeFamiglia = utente.famiglie?.nome
    const isAdmin = utente.ruolo === 'admin'
    const maxGiorni = getMaxGiorni(nomeFamiglia)
    const giorniUsati = giorniUsatiPerFamiglia(utente.famiglia_id)

    // Controlla limite giorni (solo mare)
    if (casa?.tipo === 'mare') {
      if (giorniUsati + giorniSelezionati.length > maxGiorni) {
        setMessaggio('Giorni finiti! Cerca un\'altra casa!')
        return
      }

      // Controlla limite weekend (non agosto)
      const meseNum = mese.getMonth() + 1
      if (meseNum !== 8) {
        const weekendUsati = weekendUsatiPerFamiglia(utente.famiglia_id)
        const nuoviWeekend = new Set<string>()
        
        // Cerca sabato+domenica nei giorni selezionati
        giorniSelezionati.forEach(g => {
          const d = parseISO(g)
          if (isSaturday(d)) {
            const domenicaStr = format(
              new Date(d.getTime() + 86400000), 'yyyy-MM-dd'
            )
            if (giorniSelezionati.includes(domenicaStr)) {
              nuoviWeekend.add(format(d, 'yyyy-ww'))
            }
          }
        })

        if (weekendUsati + nuoviWeekend.size > 2) {
          setMessaggio('❌ Puoi prenotare massimo 2 weekend al mese')
          return
        }
      }
    }

    // Salva ogni giorno come riga separata
    const inserimenti = giorniSelezionati.map(g => ({
      utente_id: utente.id,
      famiglia_id: utente.famiglia_id,
      casa_id: casa.id,
      data_inizio: g,
      data_fine: g
    }))

    const { error } = await supabase
      .from('prenotazioni')
      .insert(inserimenti)

    if (error) {
      setMessaggio('❌ Errore: ' + error.message)
    } else {
      setMessaggio(
        `✅ ${giorniSelezionati.length} ${
          giorniSelezionati.length === 1 
            ? 'giorno prenotato' 
            : 'giorni prenotati'
        }!`
      )
      setGiorniSelezionati([])
      caricaPrenotazioni()
    }
  }

  // Cancella un gruppo di giorni consecutivi
  const cancellaGruppo = async (idsDaEliminare: string[]) => {
    await supabase
      .from('prenotazioni')
      .delete()
      .in('id', idsDaEliminare)
    caricaPrenotazioni()
    setMessaggio('✅ Prenotazione cancellata')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-lg">Caricamento...</p>
    </div>
  )

  if (!utente) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-500">Utente non trovato</p>
    </div>
  )

  const isAdmin = utente.ruolo === 'admin'
  const nomeFamiglia = utente.famiglie?.nome
  const maxGiorni = getMaxGiorni(nomeFamiglia)
  const giorniUsati = giorniUsatiPerFamiglia(utente.famiglia_id)
  const giorniRimanenti = casa?.tipo === 'montagna'
    ? '∞'
    : maxGiorni - giorniUsati

  // Prenotazioni mie raggruppate per giorni consecutivi
  const miePrenDate = prenotazioni
    .filter(p => p.utente_id === utente.id)
    .map(p => p.data_inizio)
    .sort()

  const gruppiPrenotazioni = raggruppaGiorni(miePrenDate)

  return (
    <div className="min-h-screen bg-gray-50">
  {/* POPUP ADMIN */}
{popupGiorno && (
  <div
    className="fixed inset-0 bg-black bg-opacity-50 
      flex items-center justify-center z-50 p-4"
    onClick={() => setPopupGiorno(null)}
  >
    <div
      className="bg-white rounded-2xl shadow-xl p-6 
        w-full max-w-xs"
      onClick={e => e.stopPropagation()}
    >
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">📅</div>
        <h3 className="font-extrabold text-gray-900 text-lg">
          Giorno prenotato
        </h3>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-sm text-gray-500 mb-1">Data</p>
        <p className="font-bold text-gray-900">
          {format(parseISO(popupGiorno.data), 
            'd MMMM yyyy', { locale: it })}
        </p>
      </div>
      <div className="bg-blue-50 rounded-xl p-4 mb-4">
        <p className="text-sm text-gray-500 mb-1">Prenotato da</p>
        <p className="font-bold text-blue-700 text-lg">
          {popupGiorno.membro}
        </p>
        <p className="text-sm text-gray-500">
          Famiglia {popupGiorno.famiglia}
        </p>
      </div>
      <button
        onClick={() => setPopupGiorno(null)}
        className="w-full bg-gray-900 text-white rounded-xl 
          py-3 font-bold hover:bg-gray-700 transition-colors"
      >
        Chiudi
      </button>
    </div>
  </div>
)}
      <div className="max-w-lg mx-auto p-4">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">
                🏠 Case Vacanze
              </h1>
              <p className="text-gray-500 text-sm">
                Ciao {utente.nome} — Famiglia {nomeFamiglia}
                {isAdmin && (
                  <span className="ml-2 bg-blue-100 text-blue-700
                    text-xs px-2 py-0.5 rounded-full font-semibold">
                    Admin
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onEsci}
              className="text-sm text-gray-400 hover:text-red-500
                font-medium transition-colors"
            >
              Esci
            </button>
          </div>
        </div>

        {/* SELEZIONE CASA */}
        <div className="flex gap-3 mb-4">
          {caseList.map(c => (
            <button
              key={c.id}
              onClick={() => {
                setCasa(c)
                setGiorniSelezionati([])
                setMessaggio('')
              }}
              className={`flex-1 py-3 rounded-xl font-bold text-sm
                transition-all ${
                casa?.id === c.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 shadow'
              }`}
            >
              {c.tipo === 'mare' ? '🌊' : '⛰️'} {c.nome}
            </button>
          ))}
        </div>

        {/* CALENDARIO */}
        <div className="bg-white rounded-2xl shadow p-4 mb-4">

          {/* NAVIGAZIONE MESE */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => {
                setMese(new Date(mese.getFullYear(), mese.getMonth() - 1))
                setGiorniSelezionati([])
                setMessaggio('')
              }}
              className="w-10 h-10 flex items-center justify-center
                hover:bg-gray-100 rounded-xl text-gray-700
                font-bold text-lg transition-colors"
            >
              ←
            </button>
            <h2 className="font-extrabold text-lg text-gray-900 capitalize">
              {format(mese, 'MMMM yyyy', { locale: it })}
            </h2>
            <button
              onClick={() => {
                setMese(new Date(mese.getFullYear(), mese.getMonth() + 1))
                setGiorniSelezionati([])
                setMessaggio('')
              }}
              className="w-10 h-10 flex items-center justify-center
                hover:bg-gray-100 rounded-xl text-gray-700
                font-bold text-lg transition-colors"
            >
              →
            </button>
          </div>

          {/* CONTATORE GIORNI - solo mare */}
          {casa?.tipo === 'mare' && (
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-gray-700">
                  Famiglia {nomeFamiglia}
                </span>
                <span className="text-gray-500">
                  {giorniUsati}/{maxGiorni} giorni usati
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    giorniUsati >= maxGiorni
                      ? 'bg-red-500'
                      : 'bg-blue-600'
                  }`}
                  style={{
                    width: `${Math.min(
                      (giorniUsati / maxGiorni) * 100, 100
                    )}%`
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Rimangono {giorniRimanenti} giorni disponibili
              </p>
            </div>
          )}

          {/* LEGENDA */}
          <div className="flex flex-wrap gap-3 text-xs mb-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500"/>
              <span className="text-gray-600">Famiglia Giorgio</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-400"/>
              <span className="text-gray-600">Famiglia Simonetta</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-400"/>
              <span className="text-gray-600">Selezionato</span>
            </span>
          </div>

          {/* INTESTAZIONE GIORNI SETTIMANA */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['L','M','M','G','V','S','D'].map((g, i) => (
              <div key={i}
                className="text-center text-xs font-bold
                  text-gray-400 py-1">
                {g}
              </div>
            ))}
          </div>

          {/* GRIGLIA GIORNI */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({
              length: (startOfMonth(mese).getDay() + 6) % 7
            }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {giorniDelMese.map(giorno => {
              const giornoStr = format(giorno, 'yyyy-MM-dd')
              const stato = getStatoGiorno(giorno)
              const selezionato = giorniSelezionati.includes(giornoStr)
              const isWeekend = isSaturday(giorno) || isSunday(giorno)

              const tooltip = stato.occupato
                ? isAdmin
                  ? `${stato.membro} (${stato.famiglia})`
                  : `Famiglia ${stato.famiglia}`
                : ''

              return (
                <button
                  key={giornoStr}
                  onClick={() => toggleGiorno(giorno)}
                  title={tooltip}
                  className={`
                    aspect-square rounded-xl text-sm font-semibold
                    flex items-center justify-center transition-all
                    ${stato.occupato && stato.famiglia === 'Giorgio'
                      ? 'bg-blue-500 text-white cursor-not-allowed'
                      : ''}
                    ${stato.occupato && stato.famiglia === 'Simonetta'
                      ? 'bg-orange-400 text-white cursor-not-allowed'
                      : ''}
                    ${!stato.occupato && !selezionato
                      ? isWeekend
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 ring-1 ring-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      : ''}
                    ${selezionato
                      ? 'bg-green-400 text-white'
                      : ''}
                  `}
                >
                  {format(giorno, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* BOTTONE PRENOTA */}
        {giorniSelezionati.length > 0 && (
          <button
            onClick={prenota}
            className="w-full bg-blue-600 text-white rounded-2xl
              py-4 font-extrabold text-lg shadow-lg mb-4
              hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Prenota {giorniSelezionati.length}{' '}
            {giorniSelezionati.length === 1 ? 'giorno' : 'giorni'}
          </button>
        )}

        {/* MESSAGGIO FEEDBACK */}
        {messaggio && (
          <div className="bg-white rounded-2xl shadow p-4 mb-4
            text-center font-medium text-gray-800">
            {messaggio}
          </div>
        )}

        {/* LE MIE PRENOTAZIONI */}
        <div className="bg-white rounded-2xl shadow p-4 mb-8">
          <h3 className="font-extrabold text-gray-900 mb-3">
            Le mie prenotazioni —{' '}
            {format(mese, 'MMMM', { locale: it })}
          </h3>

          {gruppiPrenotazioni.length === 0 ? (
            <p className="text-gray-400 text-sm">
              Nessuna prenotazione questo mese
            </p>
          ) : (
            gruppiPrenotazioni.map((gruppo, i) => {
              // Trova gli ID delle prenotazioni in questo gruppo
              const idsDaEliminare = prenotazioni
                .filter(p =>
                  p.utente_id === utente.id &&
                  p.data_inizio >= gruppo.inizio &&
                  p.data_inizio <= gruppo.fine
                )
                .map(p => p.id)

              const stessaData = gruppo.inizio === gruppo.fine

              return (
                <div
                  key={i}
                  className="flex justify-between items-center
                    py-3 border-b last:border-0"
                >
                  <span className="text-sm font-medium text-gray-700">
                    📅{' '}
                    {stessaData
                      ? format(parseISO(gruppo.inizio), 'd MMMM', { locale: it })
                      : `${format(parseISO(gruppo.inizio), 'd', { locale: it })} — ${format(parseISO(gruppo.fine), 'd MMMM', { locale: it })}`
                    }
                  </span>
                  <button
                    onClick={() => cancellaGruppo(idsDaEliminare)}
                    className="text-red-400 hover:text-red-600
                      text-sm font-semibold transition-colors"
                  >
                    Cancella
                  </button>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}