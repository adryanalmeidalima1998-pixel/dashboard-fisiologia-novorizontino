const PHOTO_MAP = {
  'adrian_da_silva_ferreira':          'adrian.png',
  'adrian':                            'adrian.png',
  'bernardo_lima':                     'bernardo_lima.png',
  'bruno_santana_vitorio':             'bruno_santana.png',
  'bruno_santana':                     'bruno_santana.png',
  'caio_flavio_martins_guimaraes':     'caio_flavio.png',
  'caio_flavio':                       'caio_flavio.png',
  'carlos_roberto_pereira':            'carlos_roberto.png',
  'carlos_roberto':                    'carlos_roberto.png',
  'daniel_da_silva_santos_junior':     'daniel_junior.png',
  'daniel_junior':                     'daniel_junior.png',
  'dhiogo_batista_barros':             'dhiogo_batista.png',
  'dhiogo_batista':                    'dhiogo_batista.png',
  'felipe_aguiar_samogim':             'felipe_samogim.png',
  'felipe_samogim':                    'felipe_samogim.png',
  'felipe_marques_toscano':            'felipe_toscano.png',
  'felipe_toscano':                    'felipe_toscano.png',
  'francisco_reidiney_duarte':         'francisco.png',
  'francisco':                         'francisco.png',
  'gabriel_correia_da_silva':          'gabriel_correia.png',
  'gabriel_correia':                   'gabriel_correia.png',
  'gustavo_mattei_hobold':             'gustavo_hobold.png',
  'gustavo_hobold':                    'gustavo_hobold.png',
  'joao_pedro_bezerra_vieira':         'joao_pedro.png',
  'joao_pedro_bezerra':                'joao_pedro.png',
  'joao_pedro_vieira':                 'joao_pedro.png',
  'joao_pedro':                        'joao_pedro.png',
  'joao_pedro_vieira_ferraz':          'joao_ferraz.png',
  'joao_ferraz':                       'joao_ferraz.png',
  'kawe_rodrigues_silva':              'kawe_rodrigues.png',
  'kawe_rodrigues':                    'kawe_rodrigues.png',
  'kayke_pereira_da_silva':            'kayki_andrade.png',
  'kayke_pereira':                     'kayki_andrade.png',
  'kayki_andrade':                     'kayki_andrade.png',
  'leonardo_goncalves_da_silva':       'leonardo_goncalves.png',
  'leonardo_goncalves':                'leonardo_goncalves.png',
  'mateus_geres_vinha_santos':         'matheus_geres.png',
  'matheus_geres_vinha_santos':        'matheus_geres.png',
  'mateus_geres':                      'matheus_geres.png',
  'matheus_geres':                     'matheus_geres.png',
  'matias_luderia_coronel':            'matias.png',
  'matias':                            'matias.png',
  'mauricio_alves_rocha':              'mauricio.png',
  'mauricio_alves':                    'mauricio.png',
  'mauricio':                          'mauricio.png',
  'nicolas_badu_reis':                 'nicolas_badu.png',
  'nicolas_badu':                      'nicolas_badu.png',
  'pedro_henrique_samanes_zenatti':    'pedro_zenatti.png',
  'pedro_henrique_samanes':            'pedro_zenatti.png',
  'pedro_zenatti':                     'pedro_zenatti.png',
  'pedro_henrique_vazan_reis':         'pedro_vazan.png',
  'pedro_henrique_vazan':              'pedro_vazan.png',
  'pedro_vazan':                       'pedro_vazan.png',
  'pedro_henrique_martins':            'pedro_henrique_martins.png',
  'pedro_miguel':                      'pedro_miguel.png',
  'plaza':                             'plaza.png',
  'rodrigo_campos_dos_santos':         'rodrigo_campos.png',
  'rodrigo_campos':                    'rodrigo_campos.png',
  'tiago_cardozo_fernandes':           'tiago_cardozo.png',
  'tiago_cardozo':                     'tiago_cardozo.png',
  'victor_henrique_cretuchi':          'victor_cretuchi.png',
  'victor_cretuchi':                   'victor_cretuchi.png',
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

  if (PHOTO_MAP[key]) return '/club/' + PHOTO_MAP[key]

  const tokens = key.split('_')
  for (let i = tokens.length - 1; i >= 2; i--) {
    const partial = tokens.slice(0, i).join('_')
    if (PHOTO_MAP[partial]) return '/club/' + PHOTO_MAP[partial]
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
