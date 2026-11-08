<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  fetchCategories,
  fetchRequests,
  fetchSummary,
  saveOrder,
  statusChangeToPatch,
  updateRequest,
} from './api'
import { hasCategory } from './categoryManage'
import CategoryDialog from './components/CategoryDialog.vue'
import RequestDialog from './components/RequestDialog.vue'
import RequestFilters from './components/RequestFilters.vue'
import RequestTable from './components/RequestTable.vue'
import SummaryChips from './components/SummaryChips.vue'
import { hasActiveFilter } from './display'
import { dragDisabledReason, orderIds } from './order'
import type { Category, RequestQuery, RequestRow, StatusChange, Summary } from './types'

const rows = ref<RequestRow[]>([])
const summary = ref<Summary | null>(null)
const categories = ref<Category[]>([])
const query = ref<RequestQuery>({
  q: '',
  qms: false,
  categoryId: null,
  status: null,
  sort: null, // 最初に開いたときは、手動の並び
  includeArchived: false,
})
const loading = ref(true)
// null＝エラーなし。文字が入っていれば、画面に出す
const errorMessage = ref<string | null>(null)

// 条件を素早く何度も変えたとき、遅れて届いた古い応答で、画面を上書きしないための番号
let latestRequestNumber = 0

async function loadRows() {
  const requestNumber = ++latestRequestNumber
  loading.value = true
  errorMessage.value = null
  try {
    const result = await fetchRequests(query.value)
    if (requestNumber !== latestRequestNumber) return // もっと新しい取得が始まっている
    rows.value = result
  } catch {
    if (requestNumber !== latestRequestNumber) return
    errorMessage.value = 'データを読み込めませんでした。API を起動していますか？'
  } finally {
    if (requestNumber === latestRequestNumber) loading.value = false
  }
}

// 件数（全体）と、絞り込みの選択肢は、条件に影響されない。開いたときに取る
async function loadFixedData() {
  try {
    const [counts, categoryList] = await Promise.all([fetchSummary(), fetchCategories()])
    summary.value = counts
    categories.value = categoryList
  } catch {
    errorMessage.value = 'データを読み込めませんでした。API を起動していますか？'
  }
}

async function reload() {
  await Promise.all([loadFixedData(), loadRows()])
}

onMounted(reload)

// 画面の下に、一時的に出すお知らせ（保存に失敗したときなど）
const notice = ref('')
const noticeOpen = ref(false)

// 一覧からのステータス変更。保存できてもできなくても、一覧と件数を取り直して、
// 画面を API の実際の状態に合わせる（別の画面で変わっていた場合も、ずれたままにしない）
async function changeStatus(change: StatusChange) {
  try {
    await updateRequest(change.id, statusChangeToPatch(change))
  } catch {
    notice.value = 'ステータスを変更できませんでした。もう一度お試しください。'
    noticeOpen.value = true
  }
  await reload()
}

// ドラッグで並びを変えたとき。画面には先に反映して、保存する。
// 保存できてもできなくても、一覧を取り直して、画面を API の実際の並びに合わせる
// （失敗したときは、元の並びに戻る。別の画面で依頼が増減していた場合の 409 も、同じ）
const reordering = ref(false)
const dragReason = computed(() =>
  reordering.value ? '並びを保存しています…' : dragDisabledReason(query.value),
)

async function onReorder(moved: RequestRow[]) {
  reordering.value = true
  rows.value = moved
  try {
    await saveOrder(orderIds(moved))
  } catch {
    notice.value = '並びを保存できませんでした。一覧を取り直しました。もう一度お試しください。'
    noticeOpen.value = true
  }
  try {
    await loadRows()
  } finally {
    reordering.value = false
  }
}

// 詳細モーダルの状態：開いている依頼の番号（閉じているときは null）、新しい依頼を作っているか
const openRequestId = ref<number | null>(null)

// モーダルを開いたときに、Tab の位置にあったボタンを覚えておき、モーダルが閉じ終わったら、そこへ戻す。
// 戻さないと、キーボードで操作している人は、閉じるたびに、ページの先頭からやり直しになる
let opener: HTMLElement | null = null
let openerByKeyboard = false // 開いたとき、そのボタンは、キーボード（Tab）で止まっていたか
function rememberOpener() {
  const active = document.activeElement
  opener = active instanceof HTMLElement && active !== document.body ? active : null
  openerByKeyboard = opener?.matches(':focus-visible') ?? false
}
function restoreFocus() {
  const target = opener
  const byKeyboard = openerByKeyboard
  opener = null
  if (!target?.isConnected) return
  // focusVisible は、枠を出す・出さないの指定（対応していないブラウザでは、無視される）。
  // Tab で止まっていたときだけ、枠を出す（マウスで開いたときは、出さない）
  target.focus({ focusVisible: byKeyboard } as Parameters<HTMLElement['focus']>[0])
  // 閉じるボタンを、マウスで押したときは、ブラウザが枠を出さない。Tab で来ていた人には、枠が見えたほうが
  // 親切なので、キーボードで止まっていたときだけ、枠の見た目（.restored-focus）を、一時的に付ける
  if (byKeyboard) {
    target.classList.add('restored-focus')
    target.addEventListener('blur', () => target.classList.remove('restored-focus'), { once: true })
  }
}

function openDetail(id: number) {
  rememberOpener()
  openRequestId.value = id
}
function startCreating() {
  rememberOpener()
  creating.value = true
}
function startManagingCategories() {
  rememberOpener()
  managingCategories.value = true
}
const creating = ref(false)

function closeDialog() {
  openRequestId.value = null
  creating.value = false
}

// 保存できたら、モーダルを閉じて、一覧と件数を取り直す（内線番号など、他の依頼の表示も変わるため）。
// 新しい依頼のときは、検索・絞り込み・並び替えを外す（手動の並びの一番上に入るので、見えるようにする）
async function onSaved() {
  const wasNew = creating.value
  closeDialog()
  if (wasNew) {
    query.value = { ...query.value, q: '', qms: false, categoryId: null, status: null, sort: null }
  }
  await reload()
}

// カテゴリー管理のモーダル。カテゴリーが変わったら、選択肢（件数つきの一覧）と、一覧の依頼（カテゴリー名）を取り直す。
// 削除したカテゴリーで絞り込んだままだと、何も出なくなるので、その絞り込みは外す
const managingCategories = ref(false)

async function onCategoriesChanged() {
  await reload()
  if (query.value.categoryId !== null && !hasCategory(categories.value, query.value.categoryId)) {
    query.value = { ...query.value, categoryId: null }
  }
}

// 条件が変わったら、取り直す。検索の文字は、入力が止まってから（打つたびに API を呼ばない）
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (now, before) => {
  clearTimeout(searchTimer)
  const delay = now.q !== before.q ? 300 : 0
  searchTimer = setTimeout(loadRows, delay)
})
onUnmounted(() => clearTimeout(searchTimer))
</script>

<template>
  <v-app>
    <v-app-bar flat border>
      <v-app-bar-title style="flex: 0 0 auto" class="mr-6">業務依頼管理</v-app-bar-title>
      <SummaryChips v-if="summary" :summary="summary" />
    </v-app-bar>
    <v-main class="bg-grey-lighten-4">
      <v-container fluid class="pa-6">
        <v-card>
          <v-card-text>
            <RequestFilters v-model="query" :categories="categories" />
            <div class="d-flex align-center mt-2">
              <v-btn
                color="primary"
                variant="flat"
                prepend-icon="mdi-plus"
                class="mr-4"
                data-testid="new-request"
                @click="startCreating"
              >
                新しい依頼
              </v-btn>
              <v-switch
                :model-value="query.includeArchived"
                label="アーカイブも表示"
                hide-details
                density="compact"
                @update:model-value="query = { ...query, includeArchived: !!$event }"
              />
              <v-btn
                variant="text"
                prepend-icon="mdi-tag-multiple-outline"
                class="ml-2"
                data-testid="manage-categories"
                @click="startManagingCategories"
              >
                カテゴリー管理
              </v-btn>
              <v-spacer />
              <span class="text-caption text-medium-emphasis">
                期限日の色：<span class="text-red-darken-2 font-weight-bold">赤＝期限切れ</span> /
                <span class="text-orange-darken-3 font-weight-bold">オレンジ＝3営業日以内</span>
              </span>
            </div>
          </v-card-text>
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            class="mx-4 mb-4"
            data-testid="error"
          >
            {{ errorMessage }}
            <template #append>
              <v-btn variant="text" @click="reload">もう一度読み込む</v-btn>
            </template>
          </v-alert>
          <v-progress-linear v-if="loading" indeterminate />
          <RequestTable
            v-if="!errorMessage"
            :rows="rows"
            :filtered="hasActiveFilter(query)"
            :drag-disabled-reason="dragReason"
            @change-status="changeStatus"
            @open="openDetail"
            @reorder="onReorder"
          />
        </v-card>
      </v-container>
    </v-main>
    <RequestDialog
      :request-id="openRequestId"
      :is-new="creating"
      :categories="categories"
      @close="closeDialog"
      @closed="restoreFocus"
      @saved="onSaved"
    />
    <CategoryDialog
      :open="managingCategories"
      @close="managingCategories = false"
      @closed="restoreFocus"
      @changed="onCategoriesChanged"
    />
    <v-snackbar v-model="noticeOpen" color="error" :timeout="5000" data-testid="notice">
      {{ notice }}
    </v-snackbar>
  </v-app>
</template>
