import { useEffect, useRef, useState } from 'react'
import ScratchStage, {
  type ScratchStageHandle,
  type StageStatus,
} from './ScratchStage'
import type { LoadedProject } from '../types/project'
import {
  extractProjectMetadata,
  type ProjectMetadata,
} from '../utils/projectParser'

type ProjectDetailModalProps = {
  project: LoadedProject
  onClose: () => void
}

const statusLabel: Record<StageStatus, string> = {
  loading: '読み込み中',
  ready: '待機中',
  running: '再生中',
  error: 'エラー',
}

function ProjectDetailModal({ project, onClose }: ProjectDetailModalProps) {
  const stageRef = useRef<ScratchStageHandle | null>(null)
  const [status, setStatus] = useState<StageStatus>('loading')
  const [metadata, setMetadata] = useState<ProjectMetadata | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const STAGE_DIMENSION = { width: 320, height: 240 }

  useEffect(() => {
    let cancelled = false
    setMetadataLoading(true)
    setMetadataError(null)
    extractProjectMetadata(project.data)
      .then((data) => {
        if (cancelled) return
        setMetadata(data)
      })
      .catch((error) => {
        if (cancelled) return
        setMetadataError(
          error instanceof Error
            ? error.message
            : 'プロジェクト情報の解析に失敗しました。',
        )
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [project])

  const handleClose = () => {
    stageRef.current?.stop?.()
    stageRef.current?.dispose?.()
    onClose()
  }

  useEffect(() => {
    return () => {
      stageRef.current?.dispose?.()
    }
  }, [])

  return (
    <div className="project-detail">
      <div className="project-detail__backdrop" onClick={handleClose} />
      <div className="project-detail__panel" role="dialog" aria-modal="true">
        <header className="project-detail__header">
          <div>
            <h2 className="project-detail__title">{project.name}</h2>
            <p className="project-detail__subtitle">
              ステータス: {statusLabel[status]}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="project-detail__close">
            閉じる
          </button>
        </header>
        <div className="project-detail__body">
          <section className="project-detail__stage">
            <ScratchStage
              ref={(instance) => {
                stageRef.current = instance
              }}
              project={project}
              width={STAGE_DIMENSION.width}
              height={STAGE_DIMENSION.height}
              onStatusChange={setStatus}
              isActive
            />
            <div className="project-detail__stage-controls">
              <button
                type="button"
                onClick={() => stageRef.current?.run()}
                disabled={status === 'loading' || status === 'error'}
              >
                再生
              </button>
              <button
                type="button"
                onClick={() => stageRef.current?.stop()}
                disabled={status === 'loading'}
              >
                停止
              </button>
            </div>
          </section>
          <section className="project-detail__information">
            <h3>ブロック概要</h3>
            {metadataLoading && <p>ブロック情報を読み込み中です...</p>}
            {metadataError && (
              <p className="project-detail__error">{metadataError}</p>
            )}
            {!metadataLoading && !metadataError && metadata && (
              <table className="project-detail__table">
                <thead>
                  <tr>
                    <th>名前</th>
                    <th>種類</th>
                    <th>ブロック</th>
                    <th>変数</th>
                    <th>リスト</th>
                    <th>メッセージ</th>
                    <th>コスチューム</th>
                    <th>サウンド</th>
                  </tr>
                </thead>
                <tbody>
                  {metadata.targets.map((target) => (
                    <tr key={target.name}>
                      <td>{target.name}</td>
                      <td>{target.isStage ? 'ステージ' : 'スプライト'}</td>
                      <td>{target.blocks}</td>
                      <td>{target.variables}</td>
                      <td>{target.lists}</td>
                      <td>{target.broadcasts}</td>
                      <td>{target.costumes}</td>
                      <td>{target.sounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="project-detail__note">
              ブロックの詳細表示は今後の拡張で追加予定です。
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default ProjectDetailModal
