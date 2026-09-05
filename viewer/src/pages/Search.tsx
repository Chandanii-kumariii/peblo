import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { searchCatalog, getImageUrl } from '../api'
import ResilientImage from '../components/ResilientImage'

export default function Search() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [category, setCategory] = useState('')
  const [language, setLanguage] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, category, language],
    queryFn: () => searchCatalog({ q: query, category, language }),
    enabled: !!query || !!category || !!language,
    retry: 1
  })

  // State 1: No Query Yet
  if (!query && !category && !language) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h2 className="text-2xl font-bold text-gray-300 mb-2">What are you looking for?</h2>
        <p className="text-gray-500">Search for shows, categories, or specific episodes.</p>
      </div>
    )
  }

  // State 2: Error
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="bg-red-900/20 text-red-500 p-6 rounded-xl border border-red-900/50 text-center">
          <h2 className="text-xl font-bold mb-2">Oops, something went wrong.</h2>
          <p>We're having trouble connecting to the catalog. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">{query ? `Search Results for "${query}"` : 'Browse catalogue'}</h2>
      <div className="flex flex-wrap gap-3 mb-6">
        <select aria-label="Filter by category" value={category} onChange={event => setCategory(event.target.value)} className="bg-surface border border-white/20 rounded px-3 py-2 text-sm">
          <option value="">All categories</option>
          <option value="Animation">Animation</option><option value="Live Action">Live Action</option><option value="Documentary">Documentary</option><option value="Interactive">Interactive</option>
        </select>
        <select aria-label="Filter by language" value={language} onChange={event => setLanguage(event.target.value)} className="bg-surface border border-white/20 rounded px-3 py-2 text-sm">
          <option value="">All languages</option>
          <option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option><option value="fr">French</option>
        </select>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-20 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : data?.results.length === 0 ? (
        // State 3: No Results
        <div className="flex flex-col items-center justify-center py-20 text-center">
           <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-300 mb-2">We couldn't find anything matching "{query}"</h2>
          <p className="text-gray-500">Try searching for a different title or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {data?.results.map(show => (
            <Link key={show.id} to={`/show/${show.id}`} className="group">
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface mb-2 relative ring-1 ring-white/10 group-hover:ring-white/30 transition-all group-hover:scale-105 group-hover:shadow-xl">
                 <ResilientImage 
                    src={getImageUrl(show.matching_episodes[0]?.artwork.poster || null)} 
                    alt={show.title} 
                    containerClassName="w-full h-full"
                 />
              </div>
              <h3 className="font-semibold text-sm text-gray-200 group-hover:text-white line-clamp-1">{show.title}</h3>
              <p className="text-xs text-gray-500">{show.category}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
