import { useEffect, useRef, useState } from 'react'
import type { LoadedProject } from '../types/project'
import { loadScratchModules } from '../utils/scratchModules'
import { loadScratchBlocks } from '../utils/loadScratchBlocks'

type ViewerTab = {
  id: string
  name: string
  isStage: boolean
  xml: string
}

type CodeViewerModalProps = {
  project: LoadedProject
  onClose: () => void
}

const buildWorkspaceXml = (target: any, stageTarget: any): string => {
  const stageVariables = stageTarget?.variables ?? {}
  const localVariables = target.isStage ? {} : target.variables ?? {}
  const comments = target.comments ?? {}

  const globalVariableXml = Object.keys(stageVariables)
    .map((id) => stageVariables[id].toXML())
    .join('')
  const localVariableXml = Object.keys(localVariables)
    .map((id) => localVariables[id].toXML(true))
    .join('')
  const workspaceComments = Object.keys(comments)
    .map((id) => comments[id])
    .filter((comment) => comment && comment.blockId === null)
    .map((comment) => comment.toXML())
    .join('')
  const blocksXml =
    typeof target.blocks?.toXML === 'function'
      ? target.blocks.toXML(comments)
      : ''

  return `<xml xmlns="http://www.w3.org/1999/xhtml">
    <variables>
      ${globalVariableXml}
      ${localVariableXml}
    </variables>
    ${workspaceComments}
    ${blocksXml}
  </xml>`
}

function CodeViewerModal({ project, onClose }: CodeViewerModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const workspaceApiRef = useRef<{
    scratchBlocks: any
    workspace: any
  } | null>(null)
  const runtimeRef = useRef<{ vm: any | null; renderer: any | null }>({
    vm: null,
    renderer: null,
  })
  const [tabs, setTabs] = useState<ViewerTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const initialize = async () => {
      if (!containerRef.current) return
      setStatus('loading')
      setErrorMessage(null)

      try {
        const [modules, ScratchBlocks] = await Promise.all([
          loadScratchModules(),
          loadScratchBlocks(),
        ])
        if (disposed) return

        const base = import.meta.env.BASE_URL ?? '/'
        const normalizedBase = base.endsWith('/') ? base : `${base}/`
        const mediaPath = `${normalizedBase}scratch-blocks-media/`

        try {
          ScratchBlocks.ScratchMsgs?.setLocale?.('ja')
          if (ScratchBlocks.ScratchMsgs?.currentLocale_ !== 'ja') {
            ScratchBlocks.ScratchMsgs?.setLocale?.('ja-Hira')
          }
        } catch (error) {
          console.warn('Scratch Blocksのロケール設定に失敗しました。', error)
        }

        const workspace = ScratchBlocks.inject(containerRef.current, {
          media: mediaPath,
          readOnly: true,
          scrollbars: true,
          trashcan: false,
          comments: false,
          zoom: {
            controls: true,
            wheel: true,
            startScale: 0.9,
            maxScale: 1.5,
            minScale: 0.4,
          },
        })
        workspaceApiRef.current = { scratchBlocks: ScratchBlocks, workspace }

        const {
          VirtualMachine,
          ScratchRender,
          ScratchStorage,
          ScratchAudio,
          svgModule,
        } = modules

        const vm = new VirtualMachine()
        const storage = new ScratchStorage()
        vm.attachStorage(storage)
        vm.attachAudioEngine(new ScratchAudio())

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const renderer = new ScratchRender(canvas)
        vm.attachRenderer(renderer)

        if (svgModule && typeof svgModule === 'object') {
          if (svgModule.SVGRenderer) {
            vm.attachV2SVGAdapter(new svgModule.SVGRenderer())
          }
          if (svgModule.BitmapAdapter) {
            vm.attachV2BitmapAdapter(new svgModule.BitmapAdapter())
          }
        }

        runtimeRef.current = { vm, renderer }

        await vm.loadProject(project.data)
        if (disposed) return

        const runtime = vm.runtime
        const runtimeStageTarget = runtime.getTargetForStage()
        const targetList = runtime.targets.filter(
          (target: any) =>
            (target.isStage || target.isOriginal) && typeof target.getName === 'function',
        )

        const sprites = targetList
          .filter((target: any) => !target.isStage)
          .sort((a: any, b: any) => a.getName().localeCompare(b.getName(), 'ja'))
        const stageFromList = targetList.find((target: any) => target.isStage) ?? runtimeStageTarget

        const orderedTargets = [...sprites, ...(stageFromList ? [stageFromList] : [])]

        const tabData: ViewerTab[] = orderedTargets.map((target: any) => ({
          id: target.id,
          name: target.getName(),
          isStage: Boolean(target.isStage),
          xml: buildWorkspaceXml(target, runtimeStageTarget),
        }))

        setTabs(tabData)
        const defaultActiveId =
          sprites[0]?.id ?? stageFromList?.id ?? tabData[0]?.id ?? null
        setActiveTabId(defaultActiveId)
        setStatus('ready')
      } catch (error) {
        if (disposed) return
        console.error(error)
        setErrorMessage('ブロックビューアーの初期化に失敗しました。')
        setStatus('error')
      }
    }

    initialize()

    return () => {
      disposed = true
      const api = workspaceApiRef.current
      if (api) {
        api.workspace.dispose()
        workspaceApiRef.current = null
      }

      const { vm, renderer } = runtimeRef.current
      renderer?.dispose?.()
      vm?.dispose?.()
      runtimeRef.current = { vm: null, renderer: null }
    }
  }, [project])

  useEffect(() => {
    const api = workspaceApiRef.current
    if (!api) return
    const { scratchBlocks, workspace } = api
    const tab = tabs.find((item) => item.id === activeTabId)
    if (!tab) {
      workspace.clear()
      scratchBlocks.svgResize(workspace)
      return
    }
    try {
      const dom = scratchBlocks.Xml.textToDom(tab.xml)
      workspace.clear()
      scratchBlocks.Xml.domToWorkspace(dom, workspace)
      scratchBlocks.svgResize(workspace)
      if (workspace.getTopBlocks(false).length > 0) {
        workspace.zoomToFit()
      } else {
        workspace.scrollCenter()
      }
    } catch (error) {
      console.error(error)
      setErrorMessage('ブロックの読み込みに失敗しました。')
      setStatus('error')
    }
  }, [activeTabId, tabs])

  return (
    <div className="code-modal">
      <div className="code-modal__backdrop" onClick={onClose} />
      <div className="code-modal__panel" role="dialog" aria-modal="true">
        <header className="code-modal__header">
          <div>
            <h2 className="code-modal__title">{project.name}</h2>
            <p className="code-modal__subtitle">
              表示状態: {status === 'loading' ? '読み込み中' : status === 'error' ? 'エラー' : '表示中'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="code-modal__close">
            閉じる
          </button>
        </header>
        <div className="code-modal__body">
          <div className="code-modal__tabs" role="tablist" aria-label="スプライト選択">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTabId}
                className={`code-modal__tab${
                  tab.id === activeTabId ? ' code-modal__tab--active' : ''
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.isStage ? '背景' : 'スプライト'}: {tab.name}
              </button>
            ))}
          </div>
          <div className="code-modal__workspace">
            {status === 'loading' && (
              <p className="code-modal__status">ブロックを読み込み中です...</p>
            )}
            {status === 'error' && (
              <p className="code-modal__status code-modal__status--error">
                {errorMessage ?? 'ブロックの表示に失敗しました。'}
              </p>
            )}
            {status === 'ready' && tabs.length === 0 && (
              <p className="code-modal__status">コードブロックは見つかりませんでした。</p>
            )}
            <div ref={containerRef} className="code-modal__workspace-canvas" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CodeViewerModal
