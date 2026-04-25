import { useState } from 'react'
import { useResumeStore } from './store/resumeStore'
import TopBar from './components/common/TopBar'
import ProfilePanel from './components/panels/ProfilePanel'
import ContentPanel from './components/panels/ContentPanel'
import CustomizePanel from './components/panels/CustomizePanel'
import AIPanel from './components/panels/AIPanel'
import PdfPreview from './components/preview/PdfPreview'
import ImportReviewModal from './components/common/ImportReviewModal'

const PANELS = {
  profile:   ProfilePanel,
  content:   ContentPanel,
  customize: CustomizePanel,
  ai:        AIPanel,
}

function Divider() {
  return <div className="w-px bg-gray-200 flex-shrink-0"/>
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
        <div className="flex flex-col min-h-0 bg-ink-900" style={{ width: '50%', minWidth: 480 }}>
          <Panel/>
        </div>
        <Divider/>
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
