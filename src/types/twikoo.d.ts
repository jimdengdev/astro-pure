// twikoo 官方包未提供类型声明，这里补充最小可用签名
declare module 'twikoo' {
  export interface TwikooInitOptions {
    envId: string
    el: string | HTMLElement
    region?: string
    path?: string
    lang?: string
    [key: string]: unknown
  }

  export function init(options: TwikooInitOptions): void
}
