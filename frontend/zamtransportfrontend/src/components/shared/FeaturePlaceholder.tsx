import { Construction } from 'lucide-react'
import { Card } from '@/components/ui/Card'
export function FeaturePlaceholder({ title }: { title: string }) {
  return <Card className="grid min-h-[420px] place-items-center p-6 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500"><Construction size={26} /></span><h1 className="mt-5 text-2xl font-extrabold text-ink-900">{title}</h1><p className="mt-2 max-w-sm text-sm leading-6 text-ink-500">This feature module is ready for its API hooks, forms, and table views in the next frontend phase.</p></div></Card>
}
