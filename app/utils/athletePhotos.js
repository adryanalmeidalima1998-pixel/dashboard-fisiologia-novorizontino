// Mapeia nome normalizado para arquivo em /public/club/
// Usa escape unicode para nomes com acentos - zero caracteres especiais no codigo fonte.

const PHOTO_MAP = {
  'gustavo_hobold':         'gustavo_hobold.png',
  'adrian':                 'adrian.png',
  'bernardo_lima':          'bernardo_lima.png',
  'bruno_santana':          'bruno_santana.png',
  'caio_flavio':            'caio_fl\u00e1vio.png',
  'carlos_roberto':         'carlos_roberto.png',
  'daniel_junior':          'daniel_junior.png',
  'dhiogo_batista':         'dhiogo_batista.png',
  'felipe_samogim':         'felipe_samogim.png',
  'felipe_toscano':         'felipe_toscano.png',
  'francisco':              'francisco.png',
  'gabriel_correia':        'gabriel_correia.png',
  'joao_ferraz':            'jo\u00e3o_ferraz.png',
  'joao_pedro':             'jo\u00e3o_pedro.png',
  'kawe_rodrigues':         'kawe_rodrigues.png',
  'kayki_andrade':          'kayki_andrade.png',
  'leonardo_goncalves':     'leonardo_gon\u00e7alves.png',
  'matheus_geres':          'matheus_geres.png',
  'mateus_geres':           'matheus_geres.png',
  'matias':                 'matias.png',
  'mauricio':               'mauri\u00edcio.png',
  'nicolas_badu':           'nicolas_badu.png',
  'pedro_henrique_martins': 'pedro_henrique_martins.png',
  'pedro_miguel':           'pedro_miguel.png',
  'pedro_vazan':            'pedro_vazan.png',
  'pedro_zenatti':          'pedro_zenatti.png',
  'plaza':                  'plaza.png',
  'rodrigo_campos':         'rodrigo_campos.png',
  'tiago_cardozo':          'tiago_cardozo.png',
  'victor_cretuchi':        'victor_cretuchi.png',
}

function normalizeKey(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

export function getAthletePhoto(playerName) {
  if (!playerName) return null
  const key = normalizeKey(playerName)

  if (PHOTO_MAP[key]) return '/club/' + encodeURIComponent(PHOTO_MAP[key])

  for (const [mapKey, file] of Object.entries(PHOTO_MAP)) {
    if (key.startsWith(mapKey) || mapKey.startsWith(key)) {
      return '/club/' + encodeURIComponent(file)
    }
  }

  const keyTokens = key.split('_').filter(Boolean)
  for (const [mapKey, file] of Object.entries(PHOTO_MAP)) {
    const mapTokens = mapKey.split('_').filter(Boolean)
    const shorter = keyTokens.length <= mapTokens.length ? keyTokens : mapTokens
    const longer  = keyTokens.length <= mapTokens.length ? mapTokens : keyTokens
    if (shorter.length >= 1 && shorter.every(t => longer.includes(t))) {
      return '/club/' + encodeURIComponent(file)
    }
  }

  return null
}

export function AthleteAvatar({ name, size = 'w-10 h-10', className = '', ring = false }) {
  const photo = getAthletePhoto(name)

  const initials = name
    ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?'

  const ringClass = ring ? 'ring-2 ring-amber-400 ring-offset-1' : ''

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${size} rounded-full object-cover object-top flex-shrink-0 ${ringClass} ${className}`}
        onError={(e) => {
          e.target.style.display = 'none'
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
        }}
      />
    )
  }

  return (
    <div className={`${size} rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 ${ringClass} ${className}`}>
      <span className="text-slate-500 font-black text-xs leading-none">{initials}</span>
    </div>
  )
}
