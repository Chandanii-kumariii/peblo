import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import type { ValidationReport } from '../types'
import { API_URL, getPublishRuns } from '../api'

function Spinner() {
  return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
}

export default function PublishCenter() {
  const queryClient = useQueryClient()
  const [publishStatus, setPublishStatus] = useState<{type: 'success' | 'error', message: string} | null>(null)
  
  const { data: report, isLoading, isError } = useQuery<ValidationReport>({
    queryKey: ['validation-report'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/admin/validation-report`, { headers: { 'x-user-role': 'editor' } })
      return res.data
    },
    refetchInterval: 5000 // Poll every 5 seconds so button unlocks when someone else fixes a show
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      setPublishStatus(null)
      const res = await axios.post(`${API_URL}/admin/catalog/publish`, null, {
        headers: { 'x-user-role': 'admin' }
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-report'] })
      setPublishStatus({ type: 'success', message: 'Catalog published successfully! Viewers can now see the updates.' })
    },
    onError: (err: any) => {
      if (err.response?.status === 403) {
        setPublishStatus({ type: 'error', message: 'Permission Denied: You must have an Admin role to publish the catalog.' })
      } else {
        setPublishStatus({ type: 'error', message: "Publish failed: " + (err.response?.data?.detail?.message || err.message) })
      }
    }
  })

  const { data: runs } = useQuery({ queryKey: ['publish-runs'], queryFn: getPublishRuns })

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
      <p>Checking catalog for errors...</p>
    </div>
  )

  if (isError) return (
    <div className="p-8 text-center text-red-600 font-medium bg-red-50 rounded-xl mt-8">
      Failed to connect to the server to run the validation report.
    </div>
  )

  const isBlocked = report && report.blocking_issues.length > 0

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Publish Center</h2>
          <p className="text-gray-500 mt-1">Review validation checks before updating the live catalog.</p>
        </div>
        <button 
          onClick={() => publishMutation.mutate()}
          disabled={isBlocked || publishMutation.isPending}
          className={`px-8 py-3 rounded-lg shadow-sm font-bold text-lg transition flex items-center justify-center min-w-[200px] ${
            isBlocked || publishMutation.isPending 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
          }`}
        >
          {publishMutation.isPending ? <Spinner /> : 'Publish Catalog'}
        </button>
      </div>

      {publishStatus && (
        <div className={`mb-8 p-4 rounded-xl border font-medium ${
          publishStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {publishStatus.message}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border p-8">
        <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">Pre-flight Validation</h3>
        {isBlocked ? (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 font-medium">
              We found some missing data. You must resolve these issues before you can publish.
            </div>
            
            <div className="space-y-4">
              {report.blocking_issues.map((issue, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-xl border border-gray-200 bg-white hover:shadow-md transition">
                  <div className="flex-none pt-1">
                    <span className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                      {issue.type}
                    </span>
                  </div>
                  <div>
                    <strong className="text-gray-900 block text-lg mb-1">
                      {issue.title} {issue.type === 'episode' && <span className="text-gray-500 font-normal text-sm ml-2">(Show: {issue.show_title})</span>}
                    </strong>
                    {issue.type === 'show' ? (
                      <p className="text-gray-600">{mapShowIssue(issue.issue)}</p>
                    ) : (
                      <ul className="list-disc ml-5 text-gray-600 space-y-1">
                        {issue.issues?.map((msg, j) => <li key={j}>{mapEpisodeIssue(msg)}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-green-800 bg-green-50 p-8 rounded-xl border border-green-200 flex flex-col items-center justify-center text-center">
            <div className="bg-green-100 p-3 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h4 className="font-bold text-2xl mb-2">All Checks Passed</h4>
            <p className="text-green-700">The catalog is complete and ready to be published to viewers.</p>
          </div>
        )}
      </div>
      <div className="mt-8 bg-white rounded-2xl shadow-sm border p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Publish history</h3>
        {!runs?.length ? <p className="text-gray-500">No publish runs yet.</p> : <div className="divide-y">{runs.slice(0, 10).map(run => <div key={run.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm"><span className={run.status === 'success' ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>{run.status.toUpperCase()}</span><span>{run.item_count} items</span><span className="text-gray-500">{run.run_time ? new Date(run.run_time).toLocaleString() : 'Unknown time'}</span>{run.error_message && <span className="basis-full text-red-600">{run.error_message}</span>}</div>)}</div>}
      </div>
    </div>
  )
}

// Helper functions to translate raw API errors into editor-friendly instructions
function mapShowIssue(issue?: string) {
  if (issue?.includes("missing a section")) {
    return "This show is missing a Section (e.g. Featured, Trending). Please edit the show and assign it to a section."
  }
  return issue || "Missing required data."
}

function mapEpisodeIssue(issue: string) {
  if (issue.includes("duration")) {
    return "Missing duration. Please edit this episode and enter the running time in seconds."
  }
  if (issue.includes("artwork sizes")) {
    return "Missing artwork. Please click 'Manage Assets' and ensure you have uploaded a Poster, Banner, and Thumbnail."
  }
  return issue
}
