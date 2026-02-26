

dashboard-fisiologia-novorizontino-main.zip
zip

estude esse dashboard

10:32

Executou 3 comandos
Executou 3 comandos
Agora tenho uma visão completa do projeto. Aqui está o estudo detalhado:

🏟️ Central de Fisiologia — Grêmio Novorizontino
O que é esse projeto
Dashboard de monitoramento físico do Sub-20 do Novorizontino, construído em Next.js 16 com backend em Vercel Postgres (Neon) e dados de bem-estar vindos do Google Sheets via CSV público.

Arquitetura
Stack:

Next.js 16 (App Router) com React 19
Vercel Postgres (Neon) — armazena sessões GPS
Google Sheets — formulário de bem-estar respondido pelos atletas (CSV público)
Tailwind CSS v4 — estilização
Charts: Chart.js, Recharts, Plotly.js (múltiplas libs)
Auth: NextAuth com usuário/senha hard-coded (bigdatanovorizontino / gremio123)
jsPDF + autotable — geração de relatórios PDF
Banco de dados (2 tabelas):

gps_sessions — sessões do Catapult (JSON das linhas por atleta, data, nome, metadados)
name_aliases — mapeamento de nomes GPS ↔ Bem-Estar (para resolver divergências de nome entre fontes)
Módulos/Páginas
Página	O que faz
/fisiologia	Hub central — upload de CSVs, status das fontes, gerenciador de sessões, resolver nomes divergentes
/fisiologia/diario	Dashboard diário — prontidão, alertas, % Vmax e GPS da sessão mais recente
/fisiologia/bem-estar	Monitoring completo de wellness, dor, hidratação, sRPE
/fisiologia/semanal	Microciclo semanal — cargas, monotonia, strain, ACWR, GPS e bem-estar por dia
/fisiologia/individual	Perfil completo por atleta — radar de métricas, boneco anatômico de dor, histórico GPS e wellness
/fisiologia/exposicao	Última exposição a ≥90% Vmax, sprints e HSR — identifica atletas em risco de destreino
/fisiologia/exercicios	Biblioteca de exercícios com custo GPS esperado
/fisiologia/relatorios	Relatórios automáticos em PDF (pós-sessão, semanal, individual)
Fluxo de dados
Catapult CSV → Upload → parseGpsCSV() (server) → Vercel Postgres
Google Forms (atletas) → Google Sheets → CSV público → parseBemEstarCSV() (client)
O parser do GPS roda server-side (API Route) e já:

Extrai data da sessão nas primeiras 10 linhas
Calcula média/desvio-padrão das distâncias para detectar outliers (>média+3σ ou >15km)
Salva metadados: tipo (treino/jogo), turno, adversário, resultado
Métricas calculadas
Métrica	Fórmula
Vmax baseline	Maior velocidade histórica do atleta em todas as sessões
% Vmax	velocidade_sessão / Vmax_baseline × 100
Wellness Score	média(sono, 6-fadiga, 6-DOMS, 6-estresse, humor)
sRPE-Load	sRPE × duração_minutos
Monotonia	média_diária_load / desvio_padrão
Strain	carga_semanal × monotonia
ACWR	carga_semana_atual / média_3_semanas_anteriores
Funcionalidades notáveis
Name Aliases: sistema automático que detecta quando o mesmo atleta tem nomes diferentes no GPS e no formulário (ex: "Felipe Samogim" vs "Felipe Aguiar Samogim"). Sugere matches por token overlap e permite criar/gerenciar vínculos manualmente.

Boneco anatômico SVG: página individual tem um boneco humano desenhado em SVG puro com ~40 pontos clicáveis mapeando regiões de dor relatadas no formulário. Cor varia de amarelo → laranja → vermelho conforme frequência.

Radar por posição: compara o atleta vs média da equipe E vs média da posição dele, usando dois RadarCharts do Recharts.

Upload múltiplo com metadados: ao subir CSVs, um modal permite nomear cada sessão, classificar como treino/jogo, definir turno, adversário e resultado — tudo salvo no banco como JSONB.

Pontos de atenção no código
A autenticação é básica e hard-coded — não adequada para produção real sem alteração
O DataContext.js é um provider global robusto com 600+ linhas gerenciando todo o estado da aplicação
O bem-estar é re-parsado no cliente a cada carregamento (sem cache persistente)
O schema.sql tem uma nota de migração para quem já tinha a versão anterior da tabela (sem session_name)
Quero adicionar foto em todos os atletas, pra ter em todas as páginas deles, coloquei as fotos em public/club

são elas:

gustavo_hobold.png
adrian.png
bernardo_lima.png
bruno_santana.png
caio_flávio.png
carlos_roberto.png
daniel_junior.png
dhiogo_batista.png
felipe_samogim.png
felipe_toscano.png
francisco.png
gabriel_correia.png
joão_ferraz.png
kawe_rodrigues.png
kayki_andrade.png
leonardo_gonçalves.png
matheus_geres.png
matias.png
maurício.png
nicolas_badu.png
pedro_henrique_martins.png
pedro_miguel.png
pedro_vazan.png
pedro_zenatti.png
plaza.png
rodrigo_campos.png
tiago_cardozo.png
victor_cretuchi.png

Mostrar mais
10:35
Vou analisar o código atual para entender como os nomes dos atletas são tratados e implementar o sistema de fotos de forma robusta.


Executou 2 comandos
Executou 2 comandos
Agora vou criar o sistema de fotos. A estratégia será:

Criar um utilitário getAthletePhoto que normaliza o nome → arquivo de foto
Criar um componente AthleteAvatar reutilizável
Adicionar ao DataContext exportado
Injetar nas páginas: diario, individual, semanal, bem-estar

Executou 2 comandos
Executou 2 comandos
Agora tenho tudo que preciso. Vou criar o utilitário de fotos e depois injetar em todas as páginas.


Create athlete photo utility module
Create athlete photo utility module
Agora vou adicionar as fotos na página Diário (cards de atleta):


Read full diario page
Read full diario page
Agora vou editar todas as páginas. Começando pela diário:


Editou 2 arquivos
Editou 2 arquivos
Agora a página individual — adiciona a foto no header do atleta e nos cards:


Add photo import to individual page
Add photo import to individual page
Agora localizo o card de info do atleta na página individual para adicionar a foto grande:


Add large athlete photo to the athlete info card
Add large athlete photo to the athlete info card
Agora a página semanal — adicionar fotos na tabela de atletas:


Add photo import to semanal page
Add photo import to semanal page
Agora adicionar avatar nas linhas da tabela de carga (tab carga):


Add avatar to carga table rows
Add avatar to carga table rows
Agora adicionar avatar na tabela GPS (tab GPS) da página semanal:


Add avatar to GPS table rows in semanal
Add avatar to GPS table rows in semanal
Agora adicionar avatar na tabela bem-estar (tab bem-estar) da página semanal:


Add avatar to bem-estar table rows in semanal
Add avatar to bem-estar table rows in semanal
Agora a página bem-estar — encontrar onde os atletas são listados:


Executou 2 comandos, editou 2 arquivos
Executou 2 comandos, editou 2 arquivos
Agora vamos encontrar os cards de post-atividade e dor na página bem-estar:


Executou 2 comandos, editou 2 arquivos
Executou 2 comandos, editou 2 arquivos
Agora a página de exposição e relatórios:


Executou 4 comandos, editou 3 arquivos
Executou 4 comandos, editou 3 arquivos
Agora a página de relatórios:


Executou 3 comandos, editou 3 arquivos
Executou 3 comandos, editou 3 arquivos
Agora vamos verificar se há outros lugares de atletas em relatórios (tabela individual, etc.):


Executou 2 comandos, editou um arquivo
Executou 2 comandos, editou um arquivo
Agora vamos ver o relatório individual (linha 389) e o header do atleta:


Editou 2 arquivos, executou um comando
Editou 2 arquivos, executou um comando
Agora vamos copiar todos os arquivos modificados para o output e verificar se está tudo ok:


Verify all imports and basic syntax
Verify all imports and basic syntax
Todas as chaves estão balanceadas. Agora vamos criar o zip para entrega:


Executou um comando, leu um arquivo
Executou um comando, leu um arquivo
Implementado! Aqui está o resumo do que foi feito:

Novo arquivo criado: app/utils/athletePhotos.js

Mapeia os 28 nomes de arquivo para chaves normalizadas
Função getAthletePhoto(name) com 3 níveis de matching: exato → prefixo → tokens — para lidar com variações de nome entre GPS e formulário (ex: "FELIPE SAMOGIM" encontra felipe_samogim.png)
Componente AthleteAvatar reutilizável com suporte a tamanho, anel dourado e fallback automático com iniciais caso a imagem não carregue
Páginas atualizadas (6 no total):

Página	Onde aparece a foto
Diário	Card de cada atleta — foto de 40px ao lado do nome
Individual	Card principal do atleta — foto grande de 80px
Semanal	Linhas das 3 tabelas (Carga, GPS, Bem-Estar) — foto de 28px
Bem-Estar	Cards de pré-atividade, pós-atividade e dor — foto de 36px
Exposição	Badges de risco e tabela principal — foto de 28px
Relatórios	Top 5, atletas ≥90% Vmax, tabela completa, header individual — fotos de 24–64px
Dashboard fisiologia novorizontino com fotos
ZIP 
me mande apenas os arquivos que vou ter que alterar/criar

10:40

Executou um comando, leu um arquivo
Executou um comando, leu um arquivo
7 arquivos exatos que você precisa mexer:

Arquivo	O que fazer
athletePhotos.js	Criar em app/utils/athletePhotos.js (arquivo novo)
diario_page.js	Substituir app/fisiologia/diario/page.js
individual_page.js	Substituir app/fisiologia/individual/page.js
semanal_page.js	Substituir app/fisiologia/semanal/page.js
bemEstar_page.js	Substituir app/fisiologia/bem-estar/page.js
exposicao_page.js	Substituir app/fisiologia/exposicao/page.js
relatorios_page.js	Substituir app/fisiologia/relatorios/page.js
Lembrando que as fotos precisam estar em public/club/ como você já colocou.

Athletephotos
JS 
Diario page
JS 
Individual page
JS 
Semanal page
JS 
Bemestar page
JS 
Exposicao page
JS 
Relatorios page
JS 
1772113374809_image.png
10:43
O erro é por causa dos nomes de arquivo com caracteres especiais no PHOTO_MAP — o GitHub não aceita caminhos com ã, ç, é, etc. no código.

Preciso corrigir o athletePhotos.js para usar apenas os nomes de arquivo sem acentos nos caminhos, ou encodar as URLs.


Check uploads
Check uploads
O problema está nas strings com acentos dentro do PHOTO_MAP — ex: 'caio_flávio.png', 'joão_ferraz.png', etc. O GitHub interpreta mal esses caracteres no path do arquivo sendo commitado.

A solução é usar encodeURIComponent nos nomes das fotos, ou melhor ainda: renomear os arquivos para não ter acentos e ajustar o mapa. Mas como você já tem as fotos salvas com acentos, a forma mais simples é encodar a URL no código:


Editou um arquivo, visualizou um arquivo
Editou um arquivo, visualizou um arquivo
Na verdade o problema não é o encoding — é que o GitHub não consegue salvar o arquivo JS com caracteres especiais nas strings ao commitar pela interface web. A solução mais robusta é renomear as fotos para remover os acentos. Mas como você pode não querer fazer isso, vou usar outra abordagem: montar a URL com encodeURIComponent dinamicamente.


Executou 3 comandos, criou um arquivo
Executou 3 comandos, criou um arquivo
É o travessão — no comentário. Vou reescrever sem nenhum caractere especial:


Executou 2 comandos
Executou 2 comandos
100% ASCII. Agora copio para o output:


Executou um comando, leu um arquivo
Executou um comando, leu um arquivo
Só esse arquivo precisava mudar. O problema era que o arquivo anterior tinha caracteres especiais literais (ã, ç, é, á) nas strings — o GitHub bloqueia isso ao commitar pela interface web.

O que foi corrigido: os nomes de arquivo com acentos agora estão escritos como escape unicode (joão_ferraz.png → 'jo\u00e3o_ferraz.png'), e a URL é montada com encodeURIComponent(). O resultado final em runtime é idêntico — o browser carrega a imagem corretamente. O arquivo agora é 100% ASCII e o GitHub aceita sem problemas.

Athletephotos
JS 
1772113514815_image.png
continua dando essa mensagem

10:45
O problema não é o conteúdo do arquivo — é o path app / / utils. O GitHub está reclamando do caminho em si. Olha na breadcrumb da imagem: app / / utils — tem uma barra dupla, o que indica que a pasta utils não existe ainda no repositório.

O GitHub não consegue criar arquivo em pasta nova pela interface web quando a pasta não existe.

A solução é criar o arquivo em uma pasta que já existe, ou criar via outro método. O caminho mais simples:

Opção 1 — Criar a pasta utils pelo terminal (se tiver acesso):

bash
# No seu projeto local
touch app/utils/.gitkeep
git add app/utils/.gitkeep
git commit -m "create utils folder"
git push
Depois disso o GitHub aceita criar o arquivo na pasta.

Opção 2 — Colocar o arquivo em uma pasta que já existe, como app/context/:

Quer que eu gere o arquivo com o path app/context/athletePhotos.js? Aí você só precisaria atualizar os imports nas 6 páginas de:

js
import { AthleteAvatar } from '../../utils/athletePhotos'
para:

js
import { AthleteAvatar } from '../../context/athletePhotos'
Opção 3 — Criar a pasta pelo GitHub mesmo: ao criar um novo arquivo, escreve app/utils/athletePhotos.js no campo de nome (com a barra incluída) — o GitHub cria a pasta automaticamente se você usar o botão "Add file" → "Create new file" na raiz, não pelo editor inline.

Qual dessas prefere?






Claude é uma IA e pode cometer erros. Por favor, verifique as respostas.
Bemestar page · JS
Copiar

'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import { useData } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

const DOR_LABELS = {
  '1': 'Anterior Coxa D', '2': 'Anterior Coxa E', '3': 'Adutor Coxa D', '4': 'Adutor Coxa E',
  '5': 'Tibial Ant. D', '6': 'Tibial Ant. E', '7': 'Post. Coxa D', '8': 'Post. Coxa E',
  '9': 'Panturrilha D', '10': 'Panturrilha E', '11': 'Glúteo E', '12': 'Glúteo D',
  '13': 'Flex. Quadril D', '14': 'Flex. Quadril E', '15': 'Peitoral D', '16': 'Peitoral E',
  '17': 'Dorso E', '18': 'Dorso D', '19': 'Bíceps D', '20': 'Bíceps E',
  '21': 'Tríceps E', '22': 'Tríceps D',
  'A': 'Abdome', 'B': 'Joelho Ant. D', 'C': 'Joelho Ant. E', 'D': 'Tornozelo D', 'E': 'Tornozelo E',
  'F': 'Lombar', 'G': 'Joelho Post. E', 'H': 'Joelho Post. D', 'I': 'Tendão Calc. E', 'J': 'Tendão Calc. D',
  'L': 'Deltoide D', 'M': 'Deltoide E', 'N': 'Punho D', 'O': 'Punho E',
  'P': 'Cervical', 'Q': 'Cotovelo E', 'R': 'Cotovelo D',
}

function scoreColor(score) {
  if (!score) return 'bg-slate-100 text-slate-400'
  if (score >= 3.5) return 'bg-green-100 text-green-700'
  if (score >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function scoreBg(score) {
  if (!score) return 'bg-slate-50'
  if (score >= 3.5) return 'bg-green-50'
  if (score >= 2.5) return 'bg-amber-50'
  return 'bg-red-50'
}

function urinaColor(val) {
  if (!val) return 'bg-slate-100 text-slate-400'
  if (val <= 2) return 'bg-green-100 text-green-700'
  if (val <= 3) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function MetricBar({ value, max = 5, invert = false, label }) {
  if (!value) return <span className="text-slate-300 font-black">—</span>
  const pct = invert ? ((max + 1 - value) / max) * 100 : (value / max) * 100
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-black text-slate-600">{value}</span>
    </div>
  )
}

export default function BemEstarPage() {
  const router = useRouter()
  const { bemEstarData, isLoadingBemEstar, fetchBemEstar, playerPositions } = useData()
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedAtleta, setSelectedAtleta] = useState('Todos')
  const [filterPosition, setFilterPosition] = useState('')
  const [activeTab, setActiveTab] = useState('pre') // 'pre' | 'post' | 'dor'
  const [lastUpdated, setLastUpdated] = useState(null)

  const availablePositions = useMemo(() => {
    const set = new Set(Object.values(playerPositions).filter(Boolean))
    return Array.from(set).sort()
  }, [playerPositions])

  // Sempre rebusca ao entrar na página para pegar respostas novas
  useEffect(() => {
    fetchBemEstar()
  }, [])

  // Auto-refresh a cada 30 segundos: atletas respondem e o dash atualiza sozinho
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBemEstar()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Datas disponíveis
  const dates = useMemo(() => {
    const d = [...new Set(bemEstarData.map(r => r.date))].sort().reverse()
    return d
  }, [bemEstarData])

  // Atletas disponíveis
  const atletas = useMemo(() => {
    return ['Todos', ...[...new Set(bemEstarData.map(r => r.playerName))].sort()]
  }, [bemEstarData])

  // Data selecionada padrão = mais recente
  const currentDate = selectedDate || dates[0] || ''

  // Filtrar por data e atleta
  const filtered = useMemo(() => {
    return bemEstarData.filter(r => {
      if (r.date !== currentDate) return false
      if (selectedAtleta !== 'Todos' && r.playerName !== selectedAtleta) return false
      if (filterPosition && playerPositions[r.playerName] !== filterPosition) return false
      return true
    })
  }, [bemEstarData, currentDate, selectedAtleta, filterPosition, playerPositions])

  const preData = filtered.filter(r => r.type === 'pre')
  const postData = filtered.filter(r => r.type === 'post')

  // Estatísticas do dia
  const stats = useMemo(() => {
    const scores = preData.map(r => r.wellnessScore).filter(Boolean)
    const alertas = preData.filter(r => r.wellnessScore < 2.5 || r.temDor || r.corUrina >= 4)
    const comDor = preData.filter(r => r.temDor)
    const media = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const srpes = postData.map(r => r.srpe).filter(Boolean)
    const mediaSrpe = srpes.length > 0 ? srpes.reduce((a, b) => a + b, 0) / srpes.length : null
    // Total = atletas únicos que responderam qualquer formulário no dia
    const nomesUnicos = new Set([...preData.map(r => r.playerName), ...postData.map(r => r.playerName)])
    return { total: nomesUnicos.size, preTotal: preData.length, postTotal: postData.length, alertas: alertas.length, comDor: comDor.length, media, mediaSrpe }
  }, [preData, postData])

  // Atletas com dor (para aba dor)
  const atletasComDor = useMemo(() => {
    return preData.filter(r => r.temDor && r.dorLocalizada)
  }, [preData])

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Bem-Estar & sRPE</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Monitoramento de Prontidão</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            <div className="flex flex-col items-end gap-0.5">
              <button onClick={async () => { await fetchBemEstar(); setLastUpdated(new Date()) }} disabled={isLoadingBemEstar} className="bg-amber-500 text-black px-3 py-1 rounded-md text-xs font-black hover:bg-amber-400 transition-colors disabled:opacity-50">
                {isLoadingBemEstar ? '⟳ Carregando...' : '↻ Atualizar'}
              </button>
              {lastUpdated && <span className="text-[9px] text-slate-400 font-medium">atualizado {lastUpdated.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
            </div>
          </div>
        </header>

        {/* FILTROS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data:</span>
            <select
              value={currentDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
            >
              {dates.map(d => (
                <option key={d} value={d}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Atleta:</span>
            <select
              value={selectedAtleta}
              onChange={e => setSelectedAtleta(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
            >
              {atletas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {availablePositions.length > 0 && selectedAtleta === 'Todos' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Posição:</span>
              <select
                value={filterPosition}
                onChange={e => setFilterPosition(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todas</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* RESUMO */}
        {(preData.length > 0 || postData.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Responderam</p>
              <p className="text-2xl font-black text-black">{stats.total}</p>
              <p className="text-[10px] text-slate-500">{stats.preTotal} pré · {stats.postTotal} pós</p>
            </div>
            <div className={`border rounded-xl p-3 ${stats.alertas > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Alertas</p>
              <p className={`text-2xl font-black ${stats.alertas > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.alertas}</p>
              <p className="text-[10px] text-slate-500">score {'<'} 2.5 / dor / desidrat.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Média Wellness</p>
              <p className={`text-2xl font-black ${!stats.media ? 'text-slate-400' : stats.media >= 3.5 ? 'text-green-600' : stats.media >= 2.5 ? 'text-amber-600' : 'text-red-600'}`}>
                {stats.media ? stats.media.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-slate-500">escala 1–5</p>
            </div>
            <div className={`border rounded-xl p-3 ${stats.comDor > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Com Dor</p>
              <p className={`text-2xl font-black ${stats.comDor > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{stats.comDor}</p>
              <p className="text-[10px] text-slate-500">dor localizada</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Média sRPE</p>
              <p className="text-2xl font-black text-black">{stats.mediaSrpe ? stats.mediaSrpe.toFixed(1) : '—'}</p>
              <p className="text-[10px] text-slate-500">percepção esforço</p>
            </div>
          </div>
        )}

        {/* ABAS */}
        <div className="flex gap-2 border-b border-slate-200">
          {[
            { id: 'pre', label: `Pré-Atividade (${preData.length})` },
            { id: 'post', label: `Pós-Atividade / sRPE (${postData.length})` },
            { id: 'dor', label: `Dor Localizada (${atletasComDor.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all -mb-px ${activeTab === tab.id ? 'border-amber-500 text-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO - PRÉ */}
        {activeTab === 'pre' && (
          <div>
            {preData.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-black uppercase text-sm">Sem registros pré-atividade nesta data</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {preData.sort((a, b) => (a.wellnessScore || 5) - (b.wellnessScore || 5)).map((r, i) => {
                  const hasAlert = (r.wellnessScore && r.wellnessScore < 2.5) || r.temDor || (r.corUrina >= 4)
                  return (
                    <div key={i} className={`border-2 rounded-xl p-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <AthleteAvatar name={r.playerName} size="w-9 h-9" ring={!hasAlert} className={hasAlert ? 'ring-2 ring-red-400 ring-offset-1' : ''} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tighter text-black leading-tight truncate">{r.playerName}</p>
                          <div className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-black ${scoreColor(r.wellnessScore)}`}>
                            {r.wellnessScore ? r.wellnessScore.toFixed(1) : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Barras de métricas */}
                      <div className="grid grid-cols-5 gap-1 mb-3">
                        <MetricBar label="Sono" value={r.sono} max={5} />
                        <MetricBar label="Fadiga" value={r.fadiga} max={5} invert />
                        <MetricBar label="DOMS" value={r.doms} max={5} invert />
                        <MetricBar label="Stress" value={r.estresse} max={5} invert />
                        <MetricBar label="Humor" value={r.humor} max={5} />
                      </div>

                      {/* Hidratação */}
                      {r.corUrina && (
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mb-2 ${urinaColor(r.corUrina)}`}>
                          💧 Urina {r.corUrina}/8
                        </div>
                      )}

                      {/* Dor */}
                      {r.temDor && r.dorLocalizada && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 mt-1">
                          <p className="text-[9px] font-black text-red-600 uppercase mb-0.5">🩹 Dor</p>
                          <p className="text-[10px] text-red-700 font-medium">{r.dorLocalizada}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO - PÓS */}
        {activeTab === 'post' && (
          <div>
            {postData.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-black uppercase text-sm">Sem registros pós-atividade nesta data</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {postData.sort((a, b) => (b.srpe || 0) - (a.srpe || 0)).map((r, i) => (
                  <div key={i} className="border-2 border-slate-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center gap-2.5 mb-3">
                      <AthleteAvatar name={r.playerName} size="w-9 h-9" ring />
                      <p className="text-xs font-black uppercase tracking-tighter text-black leading-tight truncate">{r.playerName}</p>
                    </div>

                    {/* sRPE */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">sRPE</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${!r.srpe ? 'text-slate-300' : r.srpe >= 8 ? 'text-red-600' : r.srpe >= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                          {r.srpe ?? '—'}
                        </span>
                        {r.srpe && (
                          <span className="text-[9px] text-slate-400 font-black">
                            {r.srpe <= 2 ? 'Muito Fraco' : r.srpe <= 4 ? 'Moderado' : r.srpe <= 6 ? 'Forte' : r.srpe <= 8 ? 'Muito Forte' : 'Máximo'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Carga (UA) */}
                    {r.srpeLoad && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Carga (UA)</span>
                        <span className="text-sm font-black text-black">{r.srpeLoad.toFixed(0)}</span>
                      </div>
                    )}

                    {/* Duração */}
                    {r.duracaoSessao && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Duração</span>
                        <span className="text-sm font-black text-black">{r.duracaoSessao} min</span>
                      </div>
                    )}

                    {/* Barra visual sRPE */}
                    {r.srpe && (
                      <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${r.srpe >= 8 ? 'bg-red-500' : r.srpe >= 5 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${(r.srpe / 10) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO - DOR */}
        {activeTab === 'dor' && (
          <div>
            {atletasComDor.length === 0 ? (
              <div className="text-center py-16 text-green-600 font-black uppercase text-sm">✓ Nenhum atleta com dor localizada nesta data</div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Mapa de frequência de dor */}
                <div className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-orange-700 mb-3">Regiões mais afetadas</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const freq = {}
                      atletasComDor.forEach(r => {
                        r.dorLocalizada.split(',').forEach(d => {
                          const key = d.trim()
                          if (key) freq[key] = (freq[key] || 0) + 1
                        })
                      })
                      return Object.entries(freq)
                        .sort((a, b) => b[1] - a[1])
                        .map(([key, count]) => (
                          <div key={key} className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-2 py-1">
                            <span className="text-xs font-black text-orange-800">{DOR_LABELS[key] || key}</span>
                            <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 rounded-full">{count}</span>
                          </div>
                        ))
                    })()}
                  </div>
                </div>

                {/* Lista por atleta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {atletasComDor.map((r, i) => (
                    <div key={i} className="border-2 border-red-200 bg-red-50 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-2">
                        <AthleteAvatar name={r.playerName} size="w-9 h-9" className="ring-2 ring-red-400 ring-offset-1" />
                        <p className="text-xs font-black uppercase tracking-tighter text-red-800 truncate">{r.playerName}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.dorLocalizada.split(',').map(d => d.trim()).filter(Boolean).map((d, j) => (
                          <span key={j} className="bg-white border border-red-200 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-lg">
                            {DOR_LABELS[d] || d}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-bold">Wellness:</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${scoreColor(r.wellnessScore)}`}>
                          {r.wellnessScore ? r.wellnessScore.toFixed(1) : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado vazio */}
        {bemEstarData.length === 0 && !isLoadingBemEstar && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sem dados de bem-estar</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Clique em "Atualizar" para carregar do Google Sheets</p>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Dados via Google Sheets · Wellness = média(sono, 6-fadiga, 6-doms, 6-estresse, humor) · Auto-refresh 30s
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
