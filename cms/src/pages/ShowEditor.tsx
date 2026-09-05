import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getShow, updateShow, getSeasons, createSeason, getEpisodes, createEpisode, uploadArtwork } from '../api'
import type { Show, Season, Episode } from '../types'

function Spinner() {
  return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
}

export default function ShowEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [showError, setShowError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [seasonError, setSeasonError] = useState('')
  const [isAddingSeason, setIsAddingSeason] = useState(false)
  const [newSeasonNum, setNewSeasonNum] = useState('')

  const { data: show, isLoading: isShowLoading, isError: isShowError } = useQuery<Show>({
    queryKey: ['show', id],
    queryFn: () => getShow(id!),
    enabled: !!id
  })

  const { data: seasons, isLoading: isSeasonsLoading } = useQuery<Season[]>({
    queryKey: ['seasons', id],
    queryFn: () => getSeasons(id!),
    enabled: !!id
  })

  const updateShowMut = useMutation({
    mutationFn: (data: Partial<Show>) => updateShow(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show', id] })
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    },
    onError: () => setShowError("Failed to save show metadata. Please try again.")
  })

  const createSeasonMut = useMutation({
    mutationFn: (data: Omit<Season, 'id'>) => createSeason(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons', id] })
      setIsAddingSeason(false)
      setNewSeasonNum('')
    },
    onError: () => setSeasonError("Failed to create season.")
  })

  if (isShowLoading || isSeasonsLoading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
  
  if (isShowError || !show) return (
    <div className="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200 mt-8 max-w-2xl mx-auto">
      <h2 className="font-bold text-lg mb-2">Show Not Found</h2>
      <p>We couldn't load this show. It may have been deleted, or there is a network issue.</p>
      <button onClick={() => navigate('/')} className="mt-4 underline font-medium">Return to Dashboard</button>
    </div>
  )

  const handleUpdateShow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setShowError('')
    const formData = new FormData(e.currentTarget)
    updateShowMut.mutate({
      title: formData.get('title') as string,
      section: (formData.get('section') as string) || null,
      category: formData.get('category') as string,
      status: formData.get('status') as 'draft' | 'published'
    })
  }

  const handleAddSeason = (e: React.FormEvent) => {
    e.preventDefault()
    setSeasonError('')
    const num = parseInt(newSeasonNum)
    if (isNaN(num) || num < 0) {
      setSeasonError("Season number must be 0 or greater.")
      return
    }
    createSeasonMut.mutate({ show_id: id!, season_number: num })
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Edit Show: {show.title}</h2>
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 font-medium">
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Metadata</h3>
        {showError && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{showError}</div>}
        <form onSubmit={handleUpdateShow} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input name="title" defaultValue={show.title} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input name="category" defaultValue={show.category} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <input name="section" defaultValue={show.section || ''} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g. Featured" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" defaultValue={show.status} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={updateShowMut.isPending} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center min-w-[140px] transition">
              {updateShowMut.isPending ? <Spinner /> : 'Save Changes'}
            </button>
            {showSuccess && <span className="text-green-600 font-medium text-sm">Saved!</span>}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-800">Seasons & Episodes</h3>
          {!isAddingSeason && (
            <button onClick={() => {
                const nextNum = seasons ? (seasons.length > 0 ? Math.max(...seasons.map(s => s.season_number)) + 1 : 1) : 1
                setNewSeasonNum(nextNum.toString())
                setIsAddingSeason(true)
            }} className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition">
              + Add Season
            </button>
          )}
        </div>
        
        {isAddingSeason && (
          <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
            <form onSubmit={handleAddSeason} className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Season Number (0 for Trailers)</label>
                <input 
                  type="number" 
                  value={newSeasonNum}
                  onChange={(e) => setNewSeasonNum(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                  min="0"
                  required
                />
              </div>
              <button type="submit" disabled={createSeasonMut.isPending} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
                 {createSeasonMut.isPending ? 'Adding...' : 'Add'}
              </button>
              <button type="button" onClick={() => { setIsAddingSeason(false); setSeasonError(''); }} className="text-gray-500 px-4 py-2 hover:text-gray-800 font-medium">Cancel</button>
            </form>
            {seasonError && <p className="text-red-600 text-sm mt-2">{seasonError}</p>}
          </div>
        )}

        <div className="space-y-6">
          {seasons?.sort((a, b) => a.season_number - b.season_number).map((season) => (
            <SeasonView key={season.id} season={season} />
          ))}
          {seasons?.length === 0 && !isAddingSeason && (
            <div className="text-center p-8 border-2 border-dashed rounded-lg bg-gray-50">
              <p className="text-gray-500 mb-2">No seasons yet.</p>
              <button onClick={() => { setIsAddingSeason(true); setNewSeasonNum('1'); }} className="text-blue-600 font-medium hover:underline">Click here to add Season 1</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SeasonView({ season }: { season: Season }) {
  const queryClient = useQueryClient()
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null)
  const [isAddingEpisode, setIsAddingEpisode] = useState(false)

  const { data: episodes, isLoading } = useQuery<Episode[]>({
    queryKey: ['episodes', season.id],
    queryFn: () => getEpisodes(season.id)
  })

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
        <h4 className="font-bold text-gray-800">
          Season {season.season_number} {season.season_number === 0 && <span className="text-sm font-normal text-gray-500 ml-2">(Trailers)</span>}
        </h4>
        <button onClick={() => setIsAddingEpisode(true)} className="text-sm text-blue-600 font-medium hover:underline">
          + Add Episode
        </button>
      </div>
      <div className="divide-y">
        {isLoading && <div className="p-4 text-center text-sm text-gray-500">Loading episodes...</div>}
        {episodes?.map(ep => (
          <div key={ep.id} className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-gray-50 transition gap-4">
            <div>
              <p className="font-bold text-gray-900">{ep.title}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">Group: {ep.content_group}</span>
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">Lang: {ep.language}</span>
                <span className="text-xs text-gray-500">{ep.duration ? `${ep.duration}s` : 'No duration set'}</span>
              </div>
            </div>
            <button onClick={() => setEditingEpisode(ep)} className="text-sm bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg hover:bg-gray-50 font-medium whitespace-nowrap shadow-sm">
              Manage Assets
            </button>
          </div>
        ))}
        {episodes?.length === 0 && <div className="p-4 text-sm text-gray-500 text-center">No episodes in this season.</div>}
      </div>

      {(isAddingEpisode || editingEpisode) && (
        <EpisodeModal 
          seasonId={season.id} 
          episode={editingEpisode}
          onClose={() => {
            setIsAddingEpisode(false)
            setEditingEpisode(null)
            queryClient.invalidateQueries({ queryKey: ['episodes', season.id] })
          }} 
        />
      )}
    </div>
  )
}

function EpisodeModal({ seasonId, episode, onClose }: { seasonId: string, episode: Episode | null, onClose: () => void }) {
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [previews, setPreviews] = useState<Partial<Record<'poster'|'banner'|'thumbnail', string>>>({})
  
  const createMut = useMutation({
    mutationFn: (data: Omit<Episode, 'id'>) => createEpisode(data),
    onSuccess: () => {
      onClose()
    },
    onError: () => setErrorMsg("Failed to create episode. Please check your inputs and try again.")
  })

  const uploadArtMut = useMutation({
    mutationFn: ({ type, file }: { type: 'poster'|'banner'|'thumbnail', file: File }) => uploadArtwork(episode!.id, type, file),
    onSuccess: () => {
      setSuccessMsg("Artwork uploaded successfully!")
      setTimeout(() => setSuccessMsg(''), 3000)
    },
    onError: () => setErrorMsg("Failed to upload artwork to the server.")
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMsg('')
    if (episode) return 
    
    const formData = new FormData(e.currentTarget)
    const durStr = formData.get('duration') as string
    createMut.mutate({
      season_id: seasonId,
      title: formData.get('title') as string,
      content_group: formData.get('content_group') as string,
      language: formData.get('language') as string,
      duration: durStr ? parseInt(durStr) : null
    })
  }

  const validateImageClientSide = (file: File, type: 'poster'|'banner'|'thumbnail'): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Size check (max 200kb)
      if (file.size > 200 * 1024) {
        return reject(`File is too large (${Math.round(file.size/1024)}KB). Maximum allowed is 200KB.`)
      }

      const img = new Image()
      img.onload = () => {
        const w = img.width
        const h = img.height
        let minW=0, minH=0, targetRatio=1
        let ratioName = ""
        
        if (type === 'poster') {
            minW = 600; minH = 900; targetRatio = 2/3; ratioName = "2:3 (vertical)"
        } else if (type === 'banner') {
            minW = 1280; minH = 720; targetRatio = 16/9; ratioName = "16:9 (widescreen)"
        } else {
            minW = 640; minH = 360; targetRatio = 16/9; ratioName = "16:9 (widescreen)"
        }

        if (w < minW || h < minH) {
            return reject(`Image is too small (${w}x${h}px). It must be at least ${minW}x${minH}px.`)
        }

        const actualRatio = w / h
        if (Math.abs(actualRatio - targetRatio) > 0.05) {
            return reject(`Image shape is incorrect. It must be ${ratioName}.`)
        }

        resolve()
      }
      img.onerror = () => reject("Invalid image file. Please upload a valid JPG or PNG.")
      img.src = URL.createObjectURL(file)
    })
  }

  const handleFileUpload = async (type: 'poster'|'banner'|'thumbnail', e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    setSuccessMsg('')
    const file = e.target.files?.[0]
    if (file && episode) {
      try {
        await validateImageClientSide(file, type)
        setPreviews(current => ({ ...current, [type]: URL.createObjectURL(file) }))
        uploadArtMut.mutate({ type, file })
      } catch (err: any) {
        // Reset file input so they can try again
        e.target.value = ''
        setErrorMsg(err)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-900">{episode ? `Manage Assets: ${episode.title}` : 'New Episode'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-full w-8 h-8 flex items-center justify-center transition">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {errorMsg && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">{errorMsg}</div>}
          {successMsg && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-medium">{successMsg}</div>}
          
          {!episode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input name="title" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Group</label>
                <input name="content_group" placeholder="e.g. s1_ep1_base" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <p className="text-xs text-gray-500 mt-1">Episodes with the same group are treated as language variants.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language Code</label>
                <input name="language" placeholder="e.g. en, es, jp" required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (seconds)</label>
                <input name="duration" type="number" min="1" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center min-w-[120px] justify-center transition">
                  {createMut.isPending ? <Spinner /> : 'Save Episode'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                Please upload the required artwork for this episode. 
              </div>
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-bold text-gray-900 mb-1">Poster</label>
                  <p className="text-xs text-gray-600 mb-3">Shape: 2:3 (vertical). Minimum size: 600x900px. Max: 200KB.</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload('poster', e)} disabled={uploadArtMut.isPending} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50" />
                  {previews.poster && <img src={previews.poster} alt="Poster preview" className="mt-3 h-36 w-24 rounded object-cover border" />}
                </div>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-bold text-gray-900 mb-1">Banner</label>
                  <p className="text-xs text-gray-600 mb-3">Shape: 16:9 (widescreen). Minimum size: 1280x720px. Max: 200KB.</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload('banner', e)} disabled={uploadArtMut.isPending} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50" />
                  {previews.banner && <img src={previews.banner} alt="Banner preview" className="mt-3 h-28 w-full rounded object-cover border" />}
                </div>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="block text-sm font-bold text-gray-900 mb-1">Thumbnail</label>
                  <p className="text-xs text-gray-600 mb-3">Shape: 16:9 (widescreen). Minimum size: 640x360px. Max: 200KB.</p>
                  <input type="file" accept="image/*" onChange={(e) => handleFileUpload('thumbnail', e)} disabled={uploadArtMut.isPending} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50" />
                  {previews.thumbnail && <img src={previews.thumbnail} alt="Thumbnail preview" className="mt-3 h-28 w-full rounded object-cover border" />}
                </div>
              </div>
              {uploadArtMut.isPending && (
                <div className="flex items-center justify-center gap-2 text-blue-600 font-medium py-2">
                  <Spinner /> Uploading...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
