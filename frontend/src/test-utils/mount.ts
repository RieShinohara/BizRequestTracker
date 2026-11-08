/**
 * Vue の部品を、テストの中で描くための道具。Vuetify の設定を、本物の画面（main.ts）と同じ形で入れる。
 * jsdom（ブラウザの代わり）には、Vuetify が使うブラウザの機能が、一部ない。ここで補う。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// jsdom にない機能（ResizeObserver）を、何もしない代用品で補う
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// 同じく jsdom にない visualViewport（モーダルの位置の計算で、Vuetify が使う）。固定の大きさを返す代用品
if (!('visualViewport' in globalThis)) {
  Object.defineProperty(globalThis, 'visualViewport', {
    configurable: true,
    value: {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener() {},
      removeEventListener() {},
    },
  })
}

// 部品を描くたびに、新しい Vuetify を作る（テスト同士が、影響しあわないように）
function vuetify() {
  return createVuetify({ components, directives })
}

/**
 * 部品を、Vuetify つきで描く。モーダル（v-dialog）は、画面の外側（document.body）に描かれるので、
 * document.body につなぐ（attachTo）。使い終わったら、unmount() する。
 */
export function mountWithVuetify(
  component: Component,
  options: { props?: Record<string, unknown> } = {},
): VueWrapper {
  // 部品の props の型は、部品ごとに違う。テストの道具としては、決めずに受け取る（型の検査は、部品の側がする）
  return mount(component as never, {
    props: options.props as never,
    global: { plugins: [vuetify()] },
    attachTo: document.body,
  }) as unknown as VueWrapper
}

/** 画面の外側（モーダルの中）から、data-testid で要素を探す */
export function byTestId<E extends Element = HTMLElement>(id: string): E | null {
  return document.body.querySelector<E>(`[data-testid="${id}"]`)
}

/** 画面の外側から、data-testid に合う要素を、すべて探す */
export function allByTestId<E extends Element = HTMLElement>(id: string): E[] {
  return Array.from(document.body.querySelectorAll<E>(`[data-testid="${id}"]`))
}

/** 入力欄（data-testid を付けた v-text-field などの中の <input>）に、文字を入れる */
export async function typeInto(testId: string, value: string): Promise<void> {
  const input = document.body.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-testid="${testId}"] input, [data-testid="${testId}"] textarea`,
  )
  if (!input) throw new Error(`入力欄が見つかりません：${testId}`)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

/** ボタンなどを押して、画面の更新（と、通信の結果）を待つ */
export async function click(element: Element | null): Promise<void> {
  if (!element) throw new Error('押す要素が見つかりません')
  ;(element as HTMLElement).click()
  await flushPromises()
}

export { flushPromises }
