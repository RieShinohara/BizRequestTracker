<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { fetchRequests, fetchSummary } from './api'
import RequestTable from './components/RequestTable.vue'
import SummaryChips from './components/SummaryChips.vue'
import type { RequestRow, Summary } from './types'

const rows = ref<RequestRow[]>([])
const summary = ref<Summary | null>(null)
const showArchived = ref(false)
const loading = ref(true)
// null＝エラーなし。文字が入っていれば、画面に出す
const errorMessage = ref<string | null>(null)

async function load() {
  loading.value = true
  errorMessage.value = null
  try {
    // 一覧と件数は、同時に取る（待ち時間が短くなる）
    const [requests, counts] = await Promise.all([
      fetchRequests({ includeArchived: showArchived.value }),
      fetchSummary(),
    ])
    rows.value = requests
    summary.value = counts
  } catch {
    errorMessage.value = 'データを読み込めませんでした。API を起動していますか？'
  } finally {
    loading.value = false
  }
}

onMounted(load)
// 「アーカイブも表示」を切り替えたら、取り直す
watch(showArchived, load)
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
          <v-card-text class="d-flex align-center ga-4">
            <v-switch
              v-model="showArchived"
              label="アーカイブも表示"
              hide-details
              density="compact"
            />
            <v-spacer />
            <span class="text-caption text-medium-emphasis">
              期限日の色：<span class="text-red-darken-2 font-weight-bold">赤＝期限切れ</span> /
              <span class="text-orange-darken-3 font-weight-bold">オレンジ＝3営業日以内</span>
            </span>
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
              <v-btn variant="text" @click="load">もう一度読み込む</v-btn>
            </template>
          </v-alert>
          <v-progress-linear v-if="loading" indeterminate />
          <RequestTable v-if="!errorMessage" :rows="rows" />
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>
