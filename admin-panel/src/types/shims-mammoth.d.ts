declare module 'mammoth/mammoth.browser' {
  export interface MammothMessage {
    type: string
    message: string
  }

  export interface MammothResult<T> {
    value: T
    messages: MammothMessage[]
  }

  export interface MammothInput {
    arrayBuffer: ArrayBuffer
  }

  export function extractRawText(input: MammothInput): Promise<MammothResult<string>>
  export function convertToHtml(input: MammothInput): Promise<MammothResult<string>>
}
