// Mapa direto: nome normalizado completo -> arquivo de foto
// Nao depende de logica de matching - cada atleta mapeado explicitamente.
// Normalizar = remover acentos, lowercase, espacos -> underscores.

const PHOTO_MAP = {
  // Adrian da Silva Ferreira
  'adrian_da_silva_ferreira':          'adrian.png',
  // Bruno Santana Vitorio
  'bruno_santana_vitorio':             'bruno_santana.png',
  // Caio Flavio Martins Guimaraes
  'caio_flavio_martins_guimaraes':     'caio_flavio.png',
  // Carlos Roberto Pereira ...
  'carlos_roberto_pereira':            'carlos_roberto.png',
  'carlos_roberto':                    'carlos_roberto.png',
  // Daniel da Silva Santos Junior
  'daniel_da_silva_santos_junior':     'daniel_junior.png',
  'daniel_junior':                     'daniel_junior.png',
  // Dhiogo Batista Barros
  'dhiogo_batista_barros':             'dhiogo_batista.png',
  'dhiogo_batista':                    'dhiogo_batista.png',
  // Felipe Aguiar Samogim
  'felipe_aguiar_samogim':             'felipe_samogim.png',
  'felipe_samogim':                    'felipe_samogim.png',
  // Felipe Marques Toscano
  'felipe_marques_toscano':            'felipe_toscano.png',
  'felipe_toscano':                    'felipe_toscano.png',
  // Francisco Reidiney Duarte
  'francisco_reidiney_duarte':         'francisco.png',
  'francisco':                         'francisco.png',
  // Gabriel Correia da Silva
  'gabriel_correia_da_silva':          'gabriel_correia.png',
  'gabriel_correia':                   'gabriel_correia.png',
  // Gustavo Mattei Hobold
  'gustavo_mattei_hobold':             'gustavo_hobold.png',
  'gustavo_hobold':                    'gustavo_hobold.png',
  // Joao Pedro Bezerra Vieira
  'joao_pedro_bezerra_vieira':         'joao_pedro.png',
  'joao_pedro_bezerra':                'joao_pedro.png',
  'joao_pedro':                        'joao_pedro.png',
  // Joao Pedro Vieira Ferraz
  'joao_pedro_vieira_ferraz':          'joao_ferraz.png',
  'joao_ferraz':                       'joao_ferraz.png',
  // Kawe Rodrigues Silva ...
  'kawe_rodrigues_silva':              'kawe_rodrigues.png',
  'kawe_rodrigues':                    'kawe_rodrigues.png',
  // Kayke Pereira da Silva (Kayki Andrade no arquivo)
  'kayke_pereira_da_silva':            'kayki_andrade.png',
  'kayki_andrade':                     'kayki_andrade.png',
  'kayke_pereira':                     'kayki_andrade.png',
  // Leonardo Goncalves da Silva
  'leonardo_goncalves_da_silva':       'leonardo_goncalves.png',
  'leonardo_goncalves':                'leonardo_goncalves.png',
  // Mateus Geres Vinha Santos
  'mateus_geres_vinha_santos':         'matheus_geres.png',
  'matheus_geres_vinha_santos':        'matheus_geres.png',
  'mateus_geres':                      'matheus_geres.png',
  'matheus_geres':                     'matheus_geres.png',
  // Matias Luderia Coronel
  'matias_luderia_coronel':            'matias.png',
  'matias':                            'matias.png',
  // Mauricio Alves Rocha
  'mauricio_alves_rocha':              'mauricio.png',
  'mauricio_alves':                    'mauricio.png',
  'mauricio':                          'mauricio.png',
  // Nicolas Badu Reis
  'nicolas_badu_reis':                 'nicolas_badu.png',
  'nicolas_badu':                      'nicolas_badu.png',
  // Pedro Henrique Samanes Zenatti
  'pedro_henrique_samanes_zenatti':    'pedro_zenatti.png',
  'pedro_henrique_samanes':            'pedro_zenatti.png',
  'pedro_zenatti':                     'pedro_zenatti.png',
  // Pedro Henrique Vazan Reis / Pedro Vazan
  'pedro_henrique_vazan_reis':         'pedro_vazan.png',
  'pedro_vazan':                       'pedro_vazan.png',
  // Pedro Henrique Martins
  'pedro_henrique_martins':            'pedro_henrique_martins.png',
  // Pedro Miguel
  'pedro_miguel':                      'pedro_miguel.png',
  // Plaza
  'plaza':                             'plaza.png',
  // Rodrigo Campos dos Santos
  'rodrigo_campos_dos_santos':         'rodrigo_campos.png',
  'rodrigo_campos':                    'rodrigo_campos.png',
  // Tiago Cardozo
  'tiago_cardozo':                     'tiago_cardozo.png',
  // Victor Cretuchi
  'victor_cretuchi':                   'victor_cretuchi.png',
  // Adrian (nome curto GPS)
  'adrian':                            'adrian.png',
  // Bruno Santana
  'bruno_santana':                     'bruno_santana.png',
  // Caio Flavio
  'caio_flavio':                       'caio_flavio.png',
  // Bernardo Lima
  'bernardo_lima':                     'bernardo_lima.png',
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

  // Match exato (cobre a grande maioria dos casos)
  if (PHOTO_MAP[key]) return '/club/' + PHOTO_MAP[key]

  // Fallback: tenta truncar progressivamente (remove ultimo token ate achar)
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
