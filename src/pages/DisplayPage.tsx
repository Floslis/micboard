import { useParams } from 'react-router-dom'
import DisplayView from '../components/display/DisplayView'
import { BILD_CFG } from '../lib/bilder'

export default function DisplayPage() {
  const { displayId } = useParams<{ displayId: string }>()

  if (!displayId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-900">
        <p className="text-white/40">Kein Display angegeben.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      <DisplayView displayId={displayId} cfg={BILD_CFG} showClock />
    </div>
  )
}
