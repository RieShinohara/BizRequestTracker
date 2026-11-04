<script setup lang="ts">
import { computed, ref } from 'vue'
import RequestDialog from './components/RequestDialog.vue'
import RequestTable from './components/RequestTable.vue'
import { newRequestDraft, state } from './store'
import { STATUSES, type Request, type Status } from './types'

// 「急ぎ」の件数（アーカイブ中と、完了は数えない：これからやる急ぎの数）
const urgentCount = computed(
  () => state.requests.filter((r) => !r.archived && r.status !== '完了' && r.priority === '急ぎ').length,
)

const statusColor: Record<Status, string> = {
  未着手: 'grey',
  作業中: 'blue',
  確認待ち: '#A8329E',
  完了: 'green',
  ペンディング: 'brown',
}

// ステータス別の件数（アーカイブ中は数えない）
const statusCounts = computed(() =>
  STATUSES.map((s) => ({
    status: s,
    count: state.requests.filter((r) => !r.archived && r.status === s).length,
  })),
)

const showArchived = ref(false)
const editing = ref<Request | null>(null)
const isNew = ref(false)

function openExisting(r: Request) {
  isNew.value = false
  editing.value = r
}

function openNew() {
  isNew.value = true
  editing.value = newRequestDraft()
}
</script>

<template>
  <v-app>
    <v-app-bar flat border>
      <v-app-bar-title style="flex: 0 0 auto" class="mr-6">業務依頼管理</v-app-bar-title>
      <div class="d-flex ga-2">
        <v-chip v-for="c in statusCounts" :key="c.status" :color="statusColor[c.status]" size="small" variant="tonal">
          {{ c.status }}
          <span class="font-weight-bold ml-1">{{ c.count }}</span>
        </v-chip>
      </div>
      <v-divider vertical class="mx-4" />
      <v-chip color="red" size="small" label :variant="urgentCount > 0 ? 'flat' : 'tonal'" prepend-icon="mdi-fire">
        急ぎ
        <span class="font-weight-bold ml-1">{{ urgentCount }}</span>
      </v-chip>
      <v-spacer />
      <v-chip size="small" color="orange" label class="mr-4">プロトタイプ（仮データ・保存されません）</v-chip>
    </v-app-bar>
    <v-main class="bg-grey-lighten-4">
      <v-container fluid class="pa-6">
        <v-card>
          <v-card-text class="d-flex align-center ga-4">
            <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="openNew">新しい依頼</v-btn>
            <v-switch v-model="showArchived" label="アーカイブも表示" hide-details density="compact" color="primary" />
            <v-spacer />
            <span class="text-caption text-medium-emphasis">
              期限日の色：<span class="text-red-darken-2 font-weight-bold">赤＝期限切れ</span> /
              <span class="text-orange-darken-3 font-weight-bold">オレンジ＝3営業日以内</span>
            </span>
          </v-card-text>
          <RequestTable :show-archived="showArchived" @open="openExisting" />
        </v-card>
      </v-container>
    </v-main>
    <RequestDialog :request="editing" :is-new="isNew" @close="editing = null" />
  </v-app>
</template>
