<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  fetchCategories,
  fetchRequests,
  fetchSummary,
  statusChangeToPatch,
  updateRequest,
} from './api'
import RequestFilters from './components/RequestFilters.vue'
import RequestTable from './components/RequestTable.vue'
import SummaryChips from './components/SummaryChips.vue'
import { hasActiveFilter } from './display'
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
              <v-switch
                :model-value="query.includeArchived"
                label="アーカイブも表示"
                hide-details
                density="compact"
                @update:model-value="query = { ...query, includeArchived: !!$event }"
              />
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
            @change-status="changeStatus"
          />
        </v-card>
      </v-container>
    </v-main>
    <v-snackbar v-model="noticeOpen" color="error" :timeout="5000" data-testid="notice">
      {{ notice }}
    </v-snackbar>
  </v-app>
</template>
