import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { LoadedProject } from '../types/project'
import { loadScratchModules } from '../utils/scratchModules'

export type StageStatus = 'loading' | 'ready' | 'running' | 'error'

export type ScratchStageHandle = {
  run: () => void
  stop: () => void
  getStatus: () => StageStatus
  getVm: () => any | null
  dispose: () => void
}

type ScratchStageProps = {
  project: LoadedProject
  width?: number
  height?: number
  autoRun?: boolean
  onStatusChange?: (status: StageStatus) => void
  className?: string
  isActive?: boolean
}

const ScratchStage = forwardRef<ScratchStageHandle, ScratchStageProps>(
  (
    {
      project,
      width = 240,
      height = 180,
      autoRun = false,
      onStatusChange,
      className,
      isActive = false,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const vmRef = useRef<any | null>(null)
    const rendererRef = useRef<any | null>(null)
    const audioEngineRef = useRef<any | null>(null)
    const disposeRef = useRef<() => void>(() => {})
    const [status, setStatus] = useState<StageStatus>('loading')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const isActiveRef = useRef(isActive)

    const updateStatus = (next: StageStatus) => {
      setStatus(next)
      onStatusChange?.(next)
    }

    useEffect(() => {
      let isCancelled = false
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = width
      canvas.height = height

      const disposeCurrent = () => {
        const currentVm = vmRef.current
        if (currentVm) {
          currentVm.stopAll?.()
          currentVm.removeAllListeners?.()
          vmRef.current = null
        }
        rendererRef.current?.dispose?.()
        rendererRef.current = null
        audioEngineRef.current = null
        disposeRef.current = () => {}
      }

      disposeCurrent()
      updateStatus('loading')
      setErrorMessage(null)

      let cleanupListeners: (() => void) | null = null
      disposeRef.current = () => {
        cleanupListeners?.()
        cleanupListeners = null
        disposeCurrent()
      }

      loadScratchModules()
        .then(
          ({
            VirtualMachine,
            ScratchRender,
            ScratchStorage,
            ScratchAudio,
            svgModule,
          }) => {
            if (isCancelled) return

            const vm = new VirtualMachine()
            const renderer = new ScratchRender(canvas)
            renderer.resize(width, height)
            rendererRef.current = renderer
            vm.attachRenderer(renderer)

            const storage = new ScratchStorage()
            vm.attachStorage(storage)

            const audioEngine = new ScratchAudio()
            vm.attachAudioEngine(audioEngine)
            audioEngineRef.current = audioEngine
            if (audioEngine?.inputNode?.gain) {
              const contextTime = audioEngine.audioContext?.currentTime ?? 0
              const gainParam = audioEngine.inputNode.gain
              if (typeof gainParam.setValueAtTime === 'function') {
                gainParam.setValueAtTime(isActiveRef.current ? 1 : 0, contextTime)
              } else {
                gainParam.value = isActiveRef.current ? 1 : 0
              }
              if (!isActiveRef.current) {
                gainParam.setValueAtTime?.(0, contextTime)
              }
            }

            if (svgModule && typeof svgModule === 'object') {
              if (svgModule.SVGRenderer) {
                vm.attachV2SVGAdapter(new svgModule.SVGRenderer())
              }
              if (svgModule.BitmapAdapter) {
                vm.attachV2BitmapAdapter(new svgModule.BitmapAdapter())
              }
            }

            const handleRunStart = () => updateStatus('running')
            const handleRunStop = () => updateStatus('ready')
            const runtime = vm.runtime
            const handleProjectLoaded = () => updateStatus('ready')

            vm.on('PROJECT_RUN_START', handleRunStart)
            vm.on('PROJECT_RUN_STOP', handleRunStop)
            runtime.on('PROJECT_LOADED', handleProjectLoaded)
            runtime.on('RUNTIME_DISPOSED', handleRunStop)

            const disposeFn = () => {
              vm.stopAll?.()
              vm.removeListener?.('PROJECT_RUN_START', handleRunStart)
              vm.removeListener?.('PROJECT_RUN_STOP', handleRunStop)
              runtime.removeListener?.('PROJECT_LOADED', handleProjectLoaded)
              runtime.removeListener?.('RUNTIME_DISPOSED', handleRunStop)
              rendererRef.current?.dispose?.()
              rendererRef.current = null
              vmRef.current = null
              audioEngineRef.current = null
            }

            cleanupListeners = disposeFn
            disposeRef.current = disposeFn

            vmRef.current = vm
            vm.start()

            return vm
              .loadProject(project.data)
              .then(() => {
                if (isCancelled) return
                updateStatus(autoRun ? 'running' : 'ready')
                if (autoRun) vm.greenFlag()
              })
              .catch((error: unknown) => {
                if (isCancelled) return
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : '読み込みでエラーが発生しました。',
                )
                updateStatus('error')
              })
          },
        )
        .catch((error: unknown) => {
          if (isCancelled) return
          setErrorMessage(
            error instanceof Error ? error.message : 'モジュールの読み込みに失敗しました。',
          )
          updateStatus('error')
        })
      return () => {
        isCancelled = true
        disposeRef.current?.()
      }
    }, [project, autoRun, height, width])

    useEffect(() => {
      isActiveRef.current = isActive
      const audioEngine = audioEngineRef.current
      if (audioEngine?.inputNode?.gain) {
        const gainParam = audioEngine.inputNode.gain
        const contextTime = audioEngine.audioContext?.currentTime ?? 0
        if (typeof gainParam.setValueAtTime === 'function') {
          gainParam.setValueAtTime(isActive ? 1 : 0, contextTime)
        } else {
          gainParam.value = isActive ? 1 : 0
        }
        if (isActive) {
          audioEngine.audioContext?.resume?.()
        }
      }

      const vm = vmRef.current
      const keyboard: any = vm?.runtime?.ioDevices?.keyboard
      if (!keyboard) return

      const releaseAllKeys = () => {
        if (keyboard && Array.isArray(keyboard._keysPressed)) {
          const pressed = [...keyboard._keysPressed]
          pressed.forEach((key: string) => {
            keyboard.postData?.({ key, isDown: false })
          })
        }
      }

      if (!isActive) {
        releaseAllKeys()
        return undefined
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        keyboard.postData?.({ key: event.key, isDown: true })
      }
      const handleKeyUp = (event: KeyboardEvent) => {
        keyboard.postData?.({ key: event.key, isDown: false })
      }

      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
        releaseAllKeys()
      }
    }, [isActive, status])

    useImperativeHandle(
      ref,
      () => ({
        run: () => {
          if (!vmRef.current || status === 'loading') return
          vmRef.current.greenFlag?.()
        },
        stop: () => {
          if (!vmRef.current) return
          vmRef.current.stopAll?.()
          updateStatus('ready')
        },
        getStatus: () => status,
        getVm: () => vmRef.current,
        dispose: () => disposeRef.current?.(),
      }),
      [status],
    )

    const wrapperClass = ['scratch-stage', className].filter(Boolean).join(' ')

    return (
      <div className={wrapperClass}>
        <canvas ref={canvasRef} className="scratch-stage__canvas" />
        {status === 'loading' && <p className="scratch-stage__status">読み込み中...</p>}
        {status === 'error' && (
          <p className="scratch-stage__status scratch-stage__status--error">
            {errorMessage ?? 'エラーが発生しました。'}
          </p>
        )}
      </div>
    )
  },
)

export default ScratchStage
