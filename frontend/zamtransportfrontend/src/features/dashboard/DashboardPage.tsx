import { Activity, ArrowUpRight, Bus, Clock3, MapPin, MoreHorizontal, Navigation, Route, TriangleAlert, Users, Wrench } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

function Metric({ label, value, note, icon: Icon, tone = 'brand' }: { label: string; value: string; note: string; icon: typeof Bus; tone?: 'brand' | 'warning' | 'danger' | 'success' }) {
  const tones = { brand: 'bg-brand-50 text-brand-400', warning: 'bg-warning-50 text-warning-400', danger: 'bg-danger-50 text-danger-500', success: 'bg-success-50 text-success-500' }
  return <Card className="relative overflow-hidden p-5"><div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-brand-500/5 blur-2xl" /><div className="relative flex items-start justify-between"><div><p className="text-sm font-semibold text-ink-500">{label}</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon size={20} /></span></div><p className="relative mt-3 flex items-center gap-1.5 text-sm text-ink-500"><ArrowUpRight size={15} className="text-success-500" />{note}</p></Card>
}

export function DashboardPage() {
  const { data: overviewData } = useQuery({
    queryKey: ['dashboardOverview'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/overview')
      return response.data.data
    },
  })
  const { data: operationsData } = useQuery({
    queryKey: ['dashboardOperations'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/operations')
      return response.data.data
    },
  })
  const { data: fleetData } = useQuery({
    queryKey: ['fleetAnalytics'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/fleet')
      return response.data.data
    },
  })

  const vehicleStatistics = overviewData?.vehicleStatistics
  const tripStatistics = overviewData?.tripStatistics
  const fleetAvailability = fleetData?.vehicleAvailability
  const fleet = [
    { name: 'In service', value: fleetAvailability?.active ?? 0, color: '#76d89b' },
    { name: 'Maintenance', value: fleetAvailability?.underMaintenance ?? 0, color: '#f5ad28' },
    { name: 'Available', value: fleetAvailability?.available ?? 0, color: '#ff5a2b' },
  ]
  const trips: { code: string; driver: string; route: string; status: string; tone: 'success' | 'danger' | 'info'; eta: string }[] = []
  const alerts = operationsData ? [
    { title: 'Maintenance due', detail: `${operationsData.vehiclesUnderMaintenance ?? 0} vehicles under maintenance`, icon: Wrench, tone: 'warning' as const },
    { title: 'Trips delayed', detail: `${operationsData.tripsDelayed ?? 0} trips delayed`, icon: TriangleAlert, tone: 'danger' as const },
    { title: 'Vehicles moving', detail: `${operationsData.vehiclesCurrentlyMoving ?? 0} vehicles currently moving`, icon: Users, tone: 'info' as const },
  ] : []

  return <div className="space-y-6 bg-[radial-gradient(ellipse_at_75%_0%,rgba(255,90,43,.12),transparent_48%)]"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-brand-400">OPERATIONS CENTRE</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">Transport dashboard</h1><p className="mt-1 text-sm text-ink-500">A live view of your Zambia fleet and services.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-400"><span className="h-2 w-2 rounded-full bg-success-500 shadow-[0_0_12px_#76d89b]" />Preview data</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active vehicles" value={String(vehicleStatistics?.active ?? 0)} note="82% fleet utilisation" icon={Bus} /><Metric label="Ongoing trips" value={String(tripStatistics?.ongoing ?? 0)} note="3 due within the hour" icon={Navigation} tone="warning" /><Metric label="Available vehicles" value={String(vehicleStatistics?.available ?? 0)} note="Ready for assignment" icon={Route} tone="success" /><Metric label="Attention needed" value={String(vehicleStatistics?.underMaintenance ?? 0)} note="Scheduled maintenance" icon={Wrench} tone="danger" /></div><div className="grid gap-6 xl:grid-cols-12"><Card className="overflow-hidden xl:col-span-5"><div className="flex items-center justify-between border-b border-ink-100 px-5 py-4"><div><h2 className="text-lg font-bold text-ink-900">Vehicle overview</h2><p className="mt-1 text-sm text-ink-500">Current fleet distribution</p></div><button className="text-ink-500 hover:text-brand-400" aria-label="More vehicle overview options"><MoreHorizontal /></button></div><div className="grid min-h-[285px] items-center gap-2 p-5 sm:grid-cols-2"><div className="relative min-h-[210px] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_72%_26%,rgba(255,90,43,.25),transparent_20%),linear-gradient(135deg,#272126,#111113)]"><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(30deg,transparent_48%,#9b5846_49%,#9b5846_51%,transparent_52%),linear-gradient(145deg,transparent_49%,#79616a_50%,#79616a_51%,transparent_52%)] [background-size:80px_65px]"></div>{[[28, 28], [57, 40], [37, 65], [72, 68]].map(([left, top], index) => <span key={index} style={{ left: `${left}%`, top: `${top}%` }} className="absolute grid h-8 w-8 place-items-center rounded-full bg-success-600 text-ink-950 shadow-lg ring-4 ring-ink-50"><MapPin size={16} /></span>)}<span className="absolute bottom-3 left-3 rounded-md bg-ink-950/90 px-2 py-1 text-xs font-semibold text-ink-700">Lusaka region</span></div><div className="h-[225px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={fleet} dataKey="value" nameKey="name" innerRadius={57} outerRadius={84} paddingAngle={2} stroke="none">{fleet.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ background: '#1c1c1f', border: '1px solid #2b2b30', borderRadius: '8px' }} itemStyle={{ color: '#f7f7f8' }} formatter={(value) => [`${value} vehicles`, 'Fleet']} /></PieChart></ResponsiveContainer></div></div><div className="grid grid-cols-3 border-t border-ink-100"><div className="p-4 text-center"><p className="text-xl font-extrabold text-success-500">{vehicleStatistics?.active ?? 0}</p><p className="mt-1 text-xs text-ink-500">In service</p></div><div className="border-x border-ink-100 p-4 text-center"><p className="text-xl font-extrabold text-warning-400">{vehicleStatistics?.underMaintenance ?? 0}</p><p className="mt-1 text-xs text-ink-500">Maintenance</p></div><div className="p-4 text-center"><p className="text-xl font-extrabold text-brand-400">{vehicleStatistics?.available ?? 0}</p><p className="mt-1 text-xs text-ink-500">Available</p></div></div></Card><Card className="xl:col-span-4"><div className="flex items-center justify-between border-b border-ink-100 px-5 py-4"><div><h2 className="text-lg font-bold text-ink-900">Ongoing trips</h2><p className="mt-1 text-sm text-ink-500">Updated moments ago</p></div><Activity size={19} className="text-brand-400" /></div><div className="overflow-x-auto scrollbar-thin"><table className="w-full min-w-[400px] text-left text-sm"><thead className="bg-ink-950 text-xs font-semibold uppercase tracking-wide text-ink-500"><tr><th className="px-5 py-3">Trip</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">ETA</th></tr></thead><tbody>{trips.map((trip) => <tr key={trip.code} className="border-t border-ink-100"><td className="px-5 py-4"><p className="font-bold text-ink-900">{trip.code}</p><p className="mt-1 text-xs text-ink-500">{trip.route}</p></td><td className="px-3 py-4 text-ink-700">{trip.driver}</td><td className="px-3 py-4"><Badge tone={trip.tone}>{trip.status}</Badge></td><td className="px-5 py-4 text-right font-semibold text-ink-700">{trip.eta}</td></tr>)}</tbody></table></div><button className="w-full border-t border-ink-100 py-3.5 text-sm font-bold text-brand-400 hover:bg-brand-50">View all trips</button></Card><div className="space-y-6 xl:col-span-3"><Card className="p-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-ink-900">On-time rate</h2><p className="mt-1 text-sm text-ink-500">Last 30 days</p></div><Clock3 size={19} className="text-brand-400" /></div><div className="mt-6 flex items-end justify-between"><span className="text-5xl font-extrabold tracking-tight text-ink-900">84<span className="text-2xl">%</span></span><div className="h-16 w-16 rounded-full border-[9px] border-success-500 border-l-brand-500 border-b-brand-500" /></div><p className="mt-4 text-sm text-success-500">+4.8% from previous period</p></Card><Card><div className="flex items-center justify-between border-b border-ink-100 px-5 py-4"><h2 className="text-lg font-bold text-ink-900">Alerts</h2><button className="text-sm font-bold text-brand-400">View all</button></div>{alerts.map(({ title, detail, icon: Icon, tone }) => <div key={title} className="flex gap-3 border-b border-ink-100 px-5 py-3.5 last:border-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-400"><Icon size={18} /></span><div className="min-w-0"><p className="font-bold text-sm text-ink-900">{title}</p><p className="mt-0.5 truncate text-xs text-ink-500">{detail}</p></div><Badge tone={tone} className="ml-auto h-fit">Open</Badge></div>)}</Card></div></div></div>
}
