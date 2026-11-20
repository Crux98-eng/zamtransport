import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
// import heroImage from '@/assets/transport-hero.jpg'
import logo from '@/assets/logo.png'
import bg from '@/assets/landingbg.png'
const navigation = ['Platform', 'Solutions', 'About']

export function LandingPage() {
  const location = useLocation()
  const redirectState = location.state as { from?: string; message?: string } | null
  const loginState = redirectState?.from?.startsWith('/') ? redirectState : undefined

  return <main className="min-h-screen overflow-hidden bg-ink-950 text-ink-900">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_at_75%_-20%,rgba(255,90,43,.32),transparent_56%),radial-gradient(ellipse_at_0%_20%,rgba(131,45,25,.25),transparent_46%)]" />
    <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
      <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
        <span className="grid h-9 w-9 place-items-center rounded-xl  text-white ">
          <img src={logo} alt='logo'  />
          </span>ZamTransport</Link>
      <nav className="hidden items-center gap-8 text-sm font-medium text-ink-500 md:flex">
        {navigation.map((item) => <a key={item} href="#platform" className="transition hover:text-ink-900">{item}</a>)}
      </nav>
      <Link to="/login" state={loginState} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:border-brand-400/50 hover:bg-white/10">Sign in <ArrowRight size={16} />

      </Link>
    </header>
    <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pb-28 lg:pt-24">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/20 bg-brand-500/10 px-3 py-1.5 text-xs font-bold tracking-wide text-brand-400">
          <Sparkles size={14} />
          TRANSPORT OPERATIONS, SIMPLIFIED
        </div>
        <h1 className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Every journey, <span className="text-brand-500">in perfect view.</span>
        </h1>
        <p className="mt-6 max-w-lg text-base leading-7 text-ink-500 sm:text-lg">A modern command centre for Zambia’s transport teams. Dispatch vehicles, coordinate drivers, and keep every route moving with confidence.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" state={loginState} className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(255,90,43,.24)] transition hover:bg-brand-400">Open operations centre <ArrowRight size={17} />
          </Link>
          <a href="#platform" className="inline-flex h-12 items-center rounded-lg border border-ink-100 bg-white/[.03] px-5 text-sm font-bold text-ink-700 transition hover:bg-white/[.07]">Explore the platform</a>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-500">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-400" />Live fleet visibility</span>
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-brand-400" />Smarter dispatch</span>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-[590px]">
        <div className="absolute -inset-5 rounded-[2rem] bg-brand-500/20 blur-3xl" />
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-ink-50 p-2 shadow-[0_32px_80px_rgba(0,0,0,.48)]">
          <div className="relative h-[390px] overflow-hidden rounded-[1.1rem] bg-ink-950 sm:h-[450px]">
            <img src={bg} alt="Bus travelling along a highway" className="h-full w-full object-fit object-center opacity-75" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,13,15,.86),rgba(13,13,15,.18)_70%),linear-gradient(0deg,rgba(13,13,15,.88),transparent_54%)]" />
            <div className="absolute left-5 top-5 rounded-xl border border-white/10 bg-ink-950/85 px-3 py-2 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-ink-500">Network status</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-white">
                <span className="h-2 w-2 rounded-full bg-success-500 shadow-[0_0_12px_#76d89b]" />All systems live</p>
            </div>
           
          </div>
        </div>
      </div>
    </section>
  
  </main>
}
