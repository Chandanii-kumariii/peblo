import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ShowEditor from './pages/ShowEditor'
import PublishCenter from './pages/PublishCenter'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <header className="bg-white shadow-sm border-b p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <h1 className="text-xl font-bold text-blue-600">Peblo CMS</h1>
              <nav className="flex gap-4">
                <Link to="/" className="text-gray-600 hover:text-blue-600 font-medium">Dashboard</Link>
                <Link to="/publish" className="text-gray-600 hover:text-blue-600 font-medium">Publish Center</Link>
              </nav>
            </div>
          </header>
          
          <main className="flex-1 max-w-6xl mx-auto w-full p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/show/:id" element={<ShowEditor />} />
              <Route path="/publish" element={<PublishCenter />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
