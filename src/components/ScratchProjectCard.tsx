import { useEffect, useRef, useState, type MouseEventHandler } from 'react'
import ScratchStage, {
  type ScratchStageHandle,
  type StageStatus,
} from './ScratchStage'
import type { LoadedProject } from '../types/project'

export type ScratchProjectCardHandle = {
  run: () => void
  stop: () => void
}

type ScratchProjectCardProps = {
  project: LoadedProject
  onOpenDetail: () => void
  onOpenCode: () => void
  isActive: boolean
  onActivate: () => void
  suspended?: boolean
  registerController: (controller: ScratchProjectCardHandle | null) => void
}

const statusLabelMap: Record<StageStatus, string> = {
  loading: '読み込み中',
  ready: '待機中',
  running: '再生中',
  error: 'エラー',
}

function ScratchProjectCard({
  project,
  onOpenDetail,
  onOpenCode,
  isActive,
  onActivate,
  registerController,
  suspended = false,
}: ScratchProjectCardProps) {
  const stageRef = useRef<ScratchStageHandle | null>(null)
  const [status, setStatus] = useState<StageStatus>('loading')

  useEffect(() => {
    // 親コンポーネントへ再生制御用のハンドラを提供する
    registerController({
      run: () => stageRef.current?.run(),
      stop: () => stageRef.current?.stop(),
    })
    return () => {
      registerController(null)
    }
  }, [registerController])

  const cardClass = ['project-card', isActive ? 'project-card--active' : '']
    .filter(Boolean)
    .join(' ')

  const handleActivate = () => {
    onActivate()
  }

  const wrapAction =
    (action: () => void): MouseEventHandler<HTMLButtonElement> =>
    (event) => {
      event.stopPropagation()
      onActivate()
      action()
    }

  return (
    <section className={cardClass} onClick={handleActivate}>
      <div className="project-card__header">
        <h2 className="project-card__title">{project.name}</h2>
      </div>
      {!suspended ? (
        <ScratchStage
          ref={(instance) => {
            stageRef.current = instance
          }}
          project={project}
          isActive={isActive}
          onStatusChange={setStatus}
        />
      ) : (
        <div className="project-card__stage-placeholder">
          プレビューは一時停止中です。詳細表示を閉じると再開します。
        </div>
      )}
      <div className="project-card__controls">
        <button
          type="button"
          onClick={wrapAction(() => stageRef.current?.run())}
          disabled={suspended || status === 'loading' || status === 'error'}
        >
          個別再生
        </button>
        <button
          type="button"
          onClick={wrapAction(() => stageRef.current?.stop())}
          disabled={suspended || status === 'loading'}
        >
          停止
        </button>
        <button
          type="button"
          onClick={wrapAction(onOpenCode)}
          disabled={status === 'loading'}
        >
          コード確認
        </button>
        <button type="button" onClick={wrapAction(onOpenDetail)}>
          詳細表示
        </button>
      </div>
      <div className="project-card__footer">
        <p className="project-card__status">ステータス: {statusLabelMap[status]}</p>
        <dl className="project-card__meta">
          <div>
            <dt>サイズ</dt>
            <dd>{(project.size / 1024).toFixed(1)} KB</dd>
          </div>
          <div>
            <dt>更新日時</dt>
            <dd>{new Date(project.lastModified).toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

export default ScratchProjectCard
