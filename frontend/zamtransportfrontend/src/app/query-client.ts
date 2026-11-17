import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (attempt, error) => {
      const status = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
      return status !== 401 && status !== 403 && status !== 422 && status !== 500 && attempt < 2
    }, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
