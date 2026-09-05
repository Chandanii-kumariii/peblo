import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { getCatalog, getImageUrl } from '../api'
import type { CatalogShow } from '../types'
import ResilientImage from '../components/ResilientImage'

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>()
  
  const { data: catalog, isLoading } = useQuery({
    queryKey: ['catalog'],
    queryFn: getCatalog
  })

  const [activeSeason, setActiveSeason] = useState<number | null>(null)

  if (isLoading) return <div className="py-20 text-center text-gray-500">Loading...</div>
  
  // Find show
  let show: CatalogShow | null = null
  if (catalog) {
    for (const sectionShows of Object.values(catalog.sections)) {
      const found = sectionShows.find(s => s.id === id)
      if (found) {
        show = found
        break
      }
    }
  }

  if (!show) return <div className="py-20 text-center text-red-500">Show not found.</div>

  // Initialize active season to the first non-zero season, or 0 if only trailers exist
  if (activeSeason === null && show.seasons.length > 0) {
    const defaultSeason = show.seasons.find(s => s.season_number > 0) || show.seasons[0]
    setActiveSeason(defaultSeason.season_number)
  }

  // Find a banner from the first episode we can find
  let bannerPath = null
  for (const s of show.seasons) {
    for (const e of s.episodes) {
      if (e.artwork.banner) {
        bannerPath = e.artwork.banner
        break
      }
    }
    if (bannerPath) break
  }

  const currentSeasonData = show.seasons.find(s => s.season_number === activeSeason)

  return (
    <div className="-mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero Banner */}
      <div className="relative w-full aspect-video md:aspect-[21/9] bg-surface">
        <ResilientImage 
          src={getImageUrl(bannerPath)} 
          alt={show.title}
          className="opacity-60"
          containerClassName="w-full h-full absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-8 md:p-16 max-w-3xl">
          <p className="text-primary font-bold tracking-widest text-sm mb-2 uppercase">{show.category}</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">{show.title}</h1>
          <div className="flex gap-4">
            <button className="bg-white text-black px-8 py-3 rounded font-bold hover:bg-gray-200 transition flex items-center gap-2">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Play
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Season Selector */}
        <div className="flex items-center gap-6 mb-8 border-b border-white/10 pb-4">
          <h3 className="text-xl font-medium text-gray-300">Episodes</h3>
          <select 
            className="bg-surface text-white border border-white/20 rounded-md px-4 py-2 font-medium focus:outline-none focus:border-white transition cursor-pointer"
            value={activeSeason ?? ''}
            onChange={(e) => setActiveSeason(Number(e.target.value))}
          >
            {show.seasons.map(s => (
              <option key={s.id} value={s.season_number}>
                {s.season_number === 0 ? "Trailers & Extras" : `Season ${s.season_number}`}
              </option>
            ))}
          </select>
        </div>

        {/* Episode List */}
        <div className="space-y-4">
          {currentSeasonData?.episodes.map(ep => (
            <div key={ep.id} className="group flex flex-col sm:flex-row gap-4 p-4 rounded-xl hover:bg-surface/50 border border-transparent hover:border-white/5 transition-all cursor-pointer">
              <div className="w-full sm:w-64 aspect-video rounded-lg overflow-hidden bg-surface relative flex-none ring-1 ring-white/10 group-hover:ring-white/20 transition-all">
                <ResilientImage 
                  src={getImageUrl(ep.artwork.thumbnail)} 
                  alt={ep.title}
                  containerClassName="w-full h-full"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                  <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center py-2">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xl font-bold text-gray-100 group-hover:text-white transition">{ep.title}</h4>
                  {ep.duration && (
                    <span className="text-sm font-medium text-gray-500">{Math.floor(ep.duration / 60)}m {ep.duration % 60}s</span>
                  )}
                </div>
                <div className="mt-auto pt-4 flex items-center">
                  <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-sm text-gray-300">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <span className="font-semibold text-white tracking-wide">Available Audio:</span> 
                    {ep.languages.map(lang => (
                      <span key={lang} className="bg-primary/20 text-primary-light px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest border border-primary/30">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {currentSeasonData?.episodes.length === 0 && (
            <p className="text-gray-500">No episodes available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
