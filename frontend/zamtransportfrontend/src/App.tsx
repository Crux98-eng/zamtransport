// App is intentionally small; page selection is handled by the router.
import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'

export default function App() { return <RouterProvider router={router} /> }
