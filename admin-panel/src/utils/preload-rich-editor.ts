let richEditorPreloadPromise: Promise<unknown> | null = null

export function preloadRichEditor() {
  if (!richEditorPreloadPromise) {
    richEditorPreloadPromise = Promise.all([
      import('@vueup/vue-quill'),
      import('@vueup/vue-quill/dist/vue-quill.snow.css'),
    ])
  }

  return richEditorPreloadPromise
}
