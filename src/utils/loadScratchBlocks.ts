type ScratchBlocksInstance = any

let scratchBlocksPromise: Promise<ScratchBlocksInstance> | null = null
let localeApplied = false

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-scratch-blocks="${src}"]`,
    )
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
      } else {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('script load error')))
      }
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.type = 'text/javascript'
    script.async = true
    script.dataset.scratchBlocks = src
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => {
      reject(new Error('Scratch Blocksスクリプトの読み込みに失敗しました。'))
    })
    document.body.appendChild(script)
  })

export const loadScratchBlocks = async (): Promise<ScratchBlocksInstance> => {
  if (!scratchBlocksPromise) {
    scratchBlocksPromise = (async () => {
      const verticalModule = await import('scratch-blocks/dist/web/vertical.js?url')
      const verticalUrl = verticalModule.default ?? verticalModule
      await loadScript(verticalUrl)

      const scratchMsgsModule = await import('scratch-blocks/msg/scratch_msgs.js?url')
      const scratchMsgsUrl = scratchMsgsModule.default ?? scratchMsgsModule
      await loadScript(scratchMsgsUrl)
      const globalObj = (window as any).ScratchBlocks || (window as any).Blockly
      if (!globalObj) {
        throw new Error('Scratch Blocksの初期化に失敗しました。')
      }
      if (!localeApplied) {
        const scratchMsgs = globalObj.ScratchMsgs ?? globalObj.Msg?.ScratchMsgs
        if (scratchMsgs?.setLocale) {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('Scratch locales:', Object.keys(scratchMsgs.locales || {}))
            // eslint-disable-next-line no-console
            console.debug('JA locale exists:', !!scratchMsgs.locales?.ja)
          }
          scratchMsgs.setLocale('ja')
          if (scratchMsgs.currentLocale_ !== 'ja') {
            scratchMsgs.setLocale('ja-Hira')
          }
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.debug('Scratch locale set to:', scratchMsgs.currentLocale_)
            // eslint-disable-next-line no-console
            console.debug('EVENT_WHENFLAGCLICKED locale value:', (
              scratchMsgs.locales?.[scratchMsgs.currentLocale_]?.EVENT_WHENFLAGCLICKED ??
              globalObj.Msg?.EVENT_WHENFLAGCLICKED
            ))
          }
          localeApplied = true
        } else {
          console.warn('Scratch Blocksのロケール設定に失敗しました。')
        }
      }
      return globalObj
    })().catch((error) => {
      scratchBlocksPromise = null
      throw error
    })
  }
  return scratchBlocksPromise
}
