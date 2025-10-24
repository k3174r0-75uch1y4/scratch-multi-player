import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import './App.css'
import ScratchProjectCard, {
  type ScratchProjectCardHandle,
} from './components/ScratchProjectCard'
import ProjectDetailModal from './components/ProjectDetailModal'
import CodeViewerModal from './components/CodeViewerModal'
import type { LoadedProject } from './types/project'

const DEFAULT_MAX_PROJECTS = 15

function App() {
  const [projects, setProjects] = useState<LoadedProject[]>([])
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null)
  const [activeCodeId, setActiveCodeId] = useState<string | null>(null)
  const [allowUnlimited, setAllowUnlimited] = useState(false)
  const [activeInteractiveId, setActiveInteractiveId] = useState<string | null>(null)
  const controllersRef = useRef(new Map<string, ScratchProjectCardHandle>())

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target
    if (!files || files.length === 0) return

    if (!allowUnlimited) {
      const nextCount = projects.length + files.length
      if (nextCount > DEFAULT_MAX_PROJECTS) {
        window.alert(
          '通常のブラウザ設定では一度に15個まで読み込めます。読み込むファイル数を減らして再度選択してください。',
        )
        event.target.value = ''
        return
      }
    }

    const nextProjects = await Promise.all(
      Array.from(files).map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        return {
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          name: file.name,
          data: arrayBuffer,
          size: file.size,
          lastModified: file.lastModified,
        } satisfies LoadedProject
      }),
    )

    setProjects((prev) => {
      const merged = [...prev, ...nextProjects]
      if (!activeInteractiveId && merged.length > 0) {
        setActiveInteractiveId(nextProjects[0]?.id ?? merged[0].id)
      }
      return merged
    })
    event.target.value = ''
  }

  const registerController = (
    projectId: string,
    controller: ScratchProjectCardHandle | null,
  ) => {
    if (controller) {
      controllersRef.current.set(projectId, controller)
    } else {
      controllersRef.current.delete(projectId)
    }
  }

  const handleRunAll = () => {
    controllersRef.current.forEach((controller) => controller?.run())
  }

  const handleStopAll = () => {
    controllersRef.current.forEach((controller) => controller?.stop())
  }

  const handleClear = () => {
    controllersRef.current.clear()
    setProjects([])
    setActiveDetailId(null)
    setActiveCodeId(null)
    setActiveInteractiveId(null)
  }

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeDetailId) ?? null,
    [activeDetailId, projects],
  )

  const activeCodeProject = useMemo(
    () => projects.find((project) => project.id === activeCodeId) ?? null,
    [activeCodeId, projects],
  )

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Scratch課題一括確認ツール</h1>
          <p className="app__description">
            複数の.sb3ファイルを読み込み、ステージを一覧で確認できます。
          </p>
        </div>
        <div className="app__controls">
          <label className="file-input-button">
            <span>ファイルを選択</span>
            <input
              type="file"
              multiple
              accept=".sb3"
              onChange={handleFileChange}
            />
          </label>
          <button
            type="button"
            onClick={handleRunAll}
            disabled={projects.length === 0}
          >
            一括再生
          </button>
          <button
            type="button"
            onClick={handleStopAll}
            disabled={projects.length === 0}
          >
            一括停止
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={projects.length === 0}
          >
            一覧をクリア
          </button>
        </div>
      </header>
      <main className="app__list">
        {projects.length === 0 ? (
          <div className="app__empty">
            <p>.sb3ファイルを選択すると一覧に読み込まれます。</p>
            <div className="app__limit app__limit--empty">
              <p className="app__limit-intro">
                <strong>通常のブラウザ設定では最大15個の.sb3ファイルしか読み込まれません。</strong>
                <br />
                ※ブラウザ設定を変更して起動する場合ターミナルから{' '}
                <code>
                  open -a /Applications/Google Chrome.app --args --max-active-webgl-contexts=40
                </code>{' '}
                を実行してください。
              </p>
              <label className="app__limit-toggle">
                <input
                  type="checkbox"
                  checked={allowUnlimited}
                  onChange={(event) => setAllowUnlimited(event.target.checked)}
                />
                <span>制限を解除(ブラウザ設定を変更済みの場合)</span>
              </label>
            </div>
          </div>
        ) : (
          <>
            {projects.map((project) => (
              <ScratchProjectCard
                key={project.id}
                project={project}
                isActive={activeInteractiveId === project.id}
                onActivate={() => setActiveInteractiveId(project.id)}
                onOpenDetail={() => setActiveDetailId(project.id)}
                onOpenCode={() => setActiveCodeId(project.id)}
                suspended={activeDetailId !== null}
                registerController={(controller) =>
                  registerController(project.id, controller)
                }
              />
            ))}
            <div className="app__limit app__limit--list" aria-live="polite">
              <p className="app__limit-intro">
                <strong>通常のブラウザ設定では最大15個の.sb3ファイルしか読み込まれません。</strong>
                <br />
                ※ブラウザ設定を変更して起動する場合ターミナルから{' '}
                <code>
                  open -a /Applications/Google Chrome.app --args --max-active-webgl-contexts=45
                </code>{' '}
                を実行してください。
              </p>
              <label className="app__limit-toggle">
                <input
                  type="checkbox"
                  checked={allowUnlimited}
                  onChange={(event) => setAllowUnlimited(event.target.checked)}
                />
                <span>制限を解除(ブラウザ設定を変更済みの場合)</span>
              </label>
            </div>
          </>
        )}
      </main>
      {activeProject && (
        <ProjectDetailModal
          project={activeProject}
          onClose={() => setActiveDetailId(null)}
        />
      )}
      {activeCodeProject && (
        <CodeViewerModal
          project={activeCodeProject}
          onClose={() => setActiveCodeId(null)}
        />
      )}
    </div>
  )
}

export default App
