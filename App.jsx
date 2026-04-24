import { useState } from 'react'
import { useResumeStore } from './store/resumeStore'
import TopBar from './components/common/TopBar'
import Sidebar from './components/common/Sidebar'
import ProfilePanel from './components/panels/ProfilePanel'
import ContentPanel from './components/panels/ContentPanel'
import CustomizePanel from './components/panels/CustomizePanel'
import PdfPreview from './components/preview/PdfPreview'
import ImportReviewModal from './components/common/ImportReviewModal'

const PANELS = {
  profile: ProfilePanel,
  content: ContentPanel,
  customize: CustomizePanel,
}

function Divider() {
  return (
    <div className="relative w-px bg-white/5 flex-shrink-0">
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-around items-center">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i}
            className="bg-cyan-400/20"
            style={{ width: i % 4 === 0 ? 5 : 2, height: 1, marginLeft: i % 4 === 0 ? -2 : -0.5 }}/>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const activeTab = useResumeStore((s) => s.activeTab)
  const replace   = useResumeStore((s) => s.replaceResume)
  const save      = useResumeStore((s) => s.save)
  const Panel = PANELS[activeTab] || ContentPanel

  const [pendingImport, setPendingImport] = useState(null)

  return (
    <div className="h-screen flex flex-col bg-ink-900">
      <TopBar onImportParsed={(r) => setPendingImport(r)}/>
      <div className="flex-1 flex min-h-0">
        <Sidebar/>
        {/* <Divider/> */}
        {/* Editor pane — 50% of remaining width */}
        <div className="flex flex-col min-h-0 bg-ink-900" style={{ width: '50%', minWidth: 480 }}>
          <Panel/>
        </div>
        {/* <Divider/> */}
        {/* Preview pane — 50% of remaining width */}
        <div className="flex-1 flex flex-col min-h-0" style={{ minWidth: 480 }}>
          <PdfPreview/>
        </div>
      </div>

      {pendingImport && (
        <ImportReviewModal
          parsedResume={pendingImport}
          onClose={() => setPendingImport(null)}
          onConfirm={(r) => {
            replace(r)
            setPendingImport(null)
            setTimeout(() => save().catch(() => {}), 0)
          }}
        />
      )}
    </div>
  )
}