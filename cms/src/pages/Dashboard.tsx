import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import type { Show } from '../types'
import { useState } from 'react'
import { API_URL } from '../api'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: shows, isLoading } = useQuery<Show[]>({
    queryKey: ['shows'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/admin/shows`, { headers: { 'x-user-role': 'editor' } })
      return res.data
    }
  })

  const createMut = useMutation({
    mutationFn: async (title: string) => {
      const res = await axios.post(`${API_URL}/admin/shows`, {
        id: `show-${Date.now()}`,
        title,
        section: '',
        category: 'Uncategorized',
        status: 'draft'
      }, { headers: { 'x-user-role': 'editor' } })
      return res.data
    },
    onSuccess: (newShow) => {
      queryClient.invalidateQueries({ queryKey: ['shows'] })
      navigate(`/show/${newShow.id}`)
    },
    onError: () => {
      setErrorMsg("Failed to create show. Please check your connection and try again.")
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (newTitle.trim()) {
      createMut.mutate(newTitle.trim())
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )

  const matchingShows = (shows ?? []).filter(show => {
    const queryMatches = !query || show.title.toLowerCase().includes(query.toLowerCase())
    const statusMatches = !statusFilter || show.status === statusFilter
    const sectionMatches = !sectionFilter || show.section === sectionFilter
    const languageMatches = !languageFilter || show.seasons?.some(season => season.episodes?.some(episode => episode.language === languageFilter))
    return queryMatches && statusMatches && sectionMatches && languageMatches
  })
  const totalPages = Math.max(1, Math.ceil(matchingShows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedShows = matchingShows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const updateFilter = (update: () => void) => { update(); setPage(1) }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Shows</h2>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition font-medium"
          >
            + New Show
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Show Title</label>
              <input 
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Stranger Things" 
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              />
            </div>
            <button 
              type="submit" 
              disabled={createMut.isPending || !newTitle.trim()} 
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 transition"
            >
              {createMut.isPending ? 'Creating...' : 'Create'}
            </button>
            <button 
              type="button" 
              onClick={() => { setIsCreating(false); setErrorMsg(''); setNewTitle(''); }}
              className="text-gray-500 px-4 py-2 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
          </form>
          {errorMsg && <p className="text-red-600 text-sm mt-2">{errorMsg}</p>}
        </div>
      )}

      <div className="mb-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4">
        <input value={query} onChange={event => updateFilter(() => setQuery(event.target.value))} placeholder="Search shows" className="border rounded-lg p-2" />
        <select value={sectionFilter} onChange={event => updateFilter(() => setSectionFilter(event.target.value))} className="border rounded-lg p-2"><option value="">All sections</option><option>Featured</option><option>Trending</option><option>New Releases</option><option>Kids</option><option>Educational</option></select>
        <select value={statusFilter} onChange={event => updateFilter(() => setStatusFilter(event.target.value))} className="border rounded-lg p-2"><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option></select>
        <select value={languageFilter} onChange={event => updateFilter(() => setLanguageFilter(event.target.value))} className="border rounded-lg p-2"><option value="">All languages</option><option value="en">English</option><option value="hi">Hindi</option><option value="es">Spanish</option><option value="fr">French</option></select>
      </div>

      
      <div className="bg-white rounded-xl shadow-sm border divide-y overflow-hidden">
        {pagedShows.map((show) => (
          <div key={show.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition">
            <div className="flex items-center gap-4">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                show.status === 'published' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {show.status.toUpperCase()}
              </span>
              <div>
                <h3 className="font-semibold text-gray-900">{show.title}</h3>
                <p className="text-sm text-gray-500">
                  {show.section ? show.section : 'No section'} &bull; {show.category}
                </p>
              </div>
            </div>
            <Link 
              to={`/show/${show.id}`} 
              className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2 hover:bg-blue-50 rounded-lg transition"
            >
              Edit
            </Link>
          </div>
        ))}
        {matchingShows.length === 0 && <div className="p-8 text-center text-gray-500">No shows match these filters.</div>}
      </div>
      {matchingShows.length > pageSize && <div className="mt-4 flex items-center justify-end gap-3 text-sm"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button><span>Page {currentPage} of {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div>}
    </div>
  )
}
