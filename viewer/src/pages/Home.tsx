import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getCatalog, getImageUrl } from '../api'
import ResilientImage from '../components/ResilientImage'

export default function Home() {
  const { data: catalog, isLoading, error } = useQuery({
    queryKey: ['catalog'],
    queryFn: getCatalog
  })

  if (isLoading) return <div className="py-20 text-center text-gray-500">Loading catalog...</div>
  if (error) return <div className="py-20 text-center text-primary font-medium">Failed to load catalog. Is the backend running and catalog published?</div>
  if (!catalog) return null

  const featuredShow = Object.values(catalog.sections).flat()[0]
  const featuredBanner = featuredShow?.seasons.flatMap(season => season.episodes).find(episode => episode.artwork.banner)?.artwork.banner ?? null

  return (
    <div className="space-y-12">
      {featuredShow && (
        <Link to={`/show/${featuredShow.id}`} className="block relative overflow-hidden rounded-2xl min-h-72 md:min-h-96 bg-surface group">
          <ResilientImage src={getImageUrl(featuredBanner)} alt={featuredShow.title} containerClassName="absolute inset-0 w-full h-full" className="opacity-60 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
          <div className="relative z-10 max-w-xl p-8 md:p-14 flex min-h-72 md:min-h-96 flex-col justify-end">
            <p className="text-primary font-bold tracking-widest uppercase text-sm">Featured</p>
            <h1 className="text-4xl md:text-6xl font-black mt-2">{featuredShow.title}</h1>
            <p className="mt-3 text-gray-200">{featuredShow.category}</p>
            <span className="mt-6 inline-flex w-fit rounded bg-white px-5 py-2 font-bold text-black">View show</span>
          </div>
        </Link>
      )}
      {Object.entries(catalog.sections).map(([sectionName, shows]) => (
        <div key={sectionName}>
          <h2 className="text-xl font-bold mb-4 px-2">{sectionName}</h2>
          <div className="flex overflow-x-auto gap-4 pb-4 px-2 snap-x scrollbar-hide">
            {shows.map(show => {
              // Find first poster to use for the show card
              let posterPath = null
              for (const season of show.seasons) {
                for (const ep of season.episodes) {
                  if (ep.artwork.poster) {
                    posterPath = ep.artwork.poster
                    break
                  }
                }
                if (posterPath) break
              }

              return (
                <Link 
                  key={show.id} 
                  to={`/show/${show.id}`}
                  className="flex-none w-48 snap-start group"
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface mb-2 relative ring-1 ring-white/10 group-hover:ring-white/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl">
                    <ResilientImage 
                      src={getImageUrl(posterPath)} 
                      alt={show.title}
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-white font-bold text-sm line-clamp-2">{show.title}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
            {shows.length === 0 && <p className="text-gray-500 text-sm py-4">No shows in this section.</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
