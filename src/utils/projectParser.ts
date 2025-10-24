import JSZip from 'jszip'

type TargetSummary = {
  name: string
  isStage: boolean
  blocks: number
  variables: number
  lists: number
  broadcasts: number
  costumes: number
  sounds: number
}

export type ProjectJson = {
  targets?: Array<Record<string, unknown>>
  meta?: { semver?: string }
}

export type ProjectMetadata = {
  targets: TargetSummary[]
  metaVersion?: string
}

export const loadProjectJson = async (data: ArrayBuffer): Promise<ProjectJson> => {
  const zip = await JSZip.loadAsync(data)
  const projectFile = zip.file('project.json')
  if (!projectFile) {
    throw new Error('project.jsonが見つかりませんでした。')
  }
  const projectRaw = await projectFile.async('string')
  return JSON.parse(projectRaw) as ProjectJson
}

export const extractProjectMetadata = async (
  data: ArrayBuffer,
): Promise<ProjectMetadata> => {
  const projectJson = await loadProjectJson(data)

  const targets = (projectJson.targets ?? []).map((target) => {
    const blocks = target.blocks as Record<string, unknown> | undefined
    const variables = target.variables as Record<string, unknown> | undefined
    const lists = target.lists as Record<string, unknown> | undefined
    const broadcasts = target.broadcasts as Record<string, unknown> | undefined
    const costumes = target.costumes as Array<unknown> | undefined
    const sounds = target.sounds as Array<unknown> | undefined

    return {
      name: (target.name as string) ?? '不明なターゲット',
      isStage: Boolean(target.isStage),
      blocks: blocks ? Object.keys(blocks).length : 0,
      variables: variables ? Object.keys(variables).length : 0,
      lists: lists ? Object.keys(lists).length : 0,
      broadcasts: broadcasts ? Object.keys(broadcasts).length : 0,
      costumes: costumes?.length ?? 0,
      sounds: sounds?.length ?? 0,
    } satisfies TargetSummary
  })

  return {
    targets,
    metaVersion: projectJson.meta?.semver,
  }
}
