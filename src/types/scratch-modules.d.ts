declare module 'scratch-vm' {
  const VirtualMachine: any
  export default VirtualMachine
}

declare module 'scratch-storage' {
  const ScratchStorage: any
  export default ScratchStorage
}

declare module 'scratch-render' {
  const ScratchRender: any
  export default ScratchRender
}

declare module 'scratch-svg-renderer' {
  const ScratchSVGRenderer: any
  export default ScratchSVGRenderer
}

declare module 'scratch-audio' {
  const ScratchAudio: any
  export default ScratchAudio
}

declare module 'scratch-blocks' {
  const ScratchBlocks: any
  export default ScratchBlocks
}

declare module 'scratch-l10n/locales/blocks-msgs.js' {
  const locales: Record<string, Record<string, string>>
  export default locales
}
