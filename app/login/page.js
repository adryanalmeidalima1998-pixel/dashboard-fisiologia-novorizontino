'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setCarregando(true)
    setErro('')

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    if (result.error) {
      setErro('USUÁRIO OU SENHA INCORRETOS')
      setCarregando(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex items-center justify-center p-6 font-sans selection:bg-brand-yellow/30">
      <div className="w-full max-w-md">
        {/* LOGO E HEADER */}
        <div className="text-center mb-12">
          <div className="relative w-32 h-32 mx-auto mb-8 group">
            <div className="absolute inset-0 bg-brand-yellow/20 rounded-full blur-2xl group-hover:bg-brand-yellow/40 transition-all duration-500"></div>
            <div className="relative bg-slate-900 p-4 rounded-full border border-slate-800 shadow-2xl">
              <img 
                src="/club/escudonovorizontino.png" 
                alt="Novorizontino Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.src = "https://upload.wikimedia.org/wikipedia/pt/8/89/Gremio_Novorizontino_2010.png"
                }}
              />
            </div>
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none bg-gradient-to-r from-white via-white to-slate-500 bg-clip-text text-transparent">
            Performance <span className="text-brand-yellow">Hub</span>
          </h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-4 italic">Acesso Restrito à Comissão Técnica</p>
        </div>

        {/* FORMULÁRIO */}
        <div className="bg-slate-900/30 rounded-[2.5rem] p-10 border border-slate-800/50 backdrop-blur-sm shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Identificação</label>
              <input 
                type="text" 
                placeholder="USUÁRIO" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest focus:border-brand-yellow/50 outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-2">Chave de Acesso</label>
              <input 
                type="password" 
                placeholder="SENHA" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest focus:border-brand-yellow/50 outline-none transition-all"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">{erro}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={carregando}
              className="w-full bg-brand-yellow hover:bg-brand-yellow/80 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black italic uppercase text-[11px] tracking-widest py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(251,191,36,0.2)] active:scale-95"
            >
              {carregando ? 'AUTENTICANDO...' : 'ENTRAR NO SISTEMA'}
            </button>
          </form>
        </div>

        {/* FOOTER */}
        <p className="text-center text-slate-600 text-[8px] font-bold uppercase tracking-[0.3em] mt-12 italic">
          Grêmio Novorizontino • Gestão de Alta Performance
        </p>
      </div>
    </div>
  )
}
