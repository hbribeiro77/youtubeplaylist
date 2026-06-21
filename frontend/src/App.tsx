import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlaylistApp } from './components/PlaylistView'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlaylistApp />
    </QueryClientProvider>
  )
}

export default App
