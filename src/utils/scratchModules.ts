type Constructor<T = any> = new (...args: any[]) => T

type ScratchModules = {
  VirtualMachine: Constructor
  ScratchRender: Constructor
  ScratchStorage: Constructor
  ScratchAudio: Constructor
  svgModule: {
    SVGRenderer?: Constructor
    BitmapAdapter?: Constructor
  }
}

let cachedPromise: Promise<ScratchModules> | null = null

const pickConstructor = (mod: any, fallbackKey?: string): Constructor => {
  if (!mod) {
    throw new Error('依存モジュールの取得に失敗しました。')
  }

  if (typeof mod === 'function') {
    return mod
  }

  if (typeof mod === 'object') {
    if (fallbackKey && typeof mod[fallbackKey] === 'function') {
      return mod[fallbackKey] as Constructor
    }
    if (typeof mod.default === 'function') {
      return mod.default as Constructor
    }
    const candidate = Object.values(mod).find(
      (value) => typeof value === 'function',
    )
    if (candidate) {
      return candidate as Constructor
    }
  }

  throw new Error('依存モジュールの形式が想定と異なります。')
}

export const loadScratchModules = async (): Promise<ScratchModules> => {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const [
        vmModule,
        renderModule,
        storageModule,
        audioModule,
        svgModule,
      ] = await Promise.all([
        import('scratch-vm'),
        import('scratch-render'),
        import('scratch-storage'),
        import('scratch-audio'),
        import('scratch-svg-renderer'),
      ])

      const resolvedSvg =
        ((svgModule as any)?.default ?? svgModule ?? {}) as ScratchModules['svgModule']

      return {
        VirtualMachine: pickConstructor(vmModule),
        ScratchRender: pickConstructor(renderModule),
        ScratchStorage: pickConstructor(storageModule, 'ScratchStorage'),
        ScratchAudio: pickConstructor(audioModule),
        svgModule: resolvedSvg,
      }
    })().catch((error) => {
      cachedPromise = null
      throw error
    })
  }

  return cachedPromise
}

