import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
export function UnauthorizedPage() { return <main className="grid min-h-screen place-items-center bg-ink-950 p-6 text-center"><div className="max-w-md"><ShieldAlert className="mx-auto text-danger-500" size={42} /><h1 className="mt-5 text-2xl font-extrabold text-ink-900">Access restricted</h1><p className="mt-3 text-sm leading-6 text-ink-500">Your account does not have access to this part of the system.</p><Link className="mt-6 inline-block" to="/dashboard"><Button>Return to dashboard</Button></Link></div></main> }
