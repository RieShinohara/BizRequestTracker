<script setup lang="ts">
import { computed, ref } from 'vue'
import { dueLevel, formatDate } from '../dates'
import { categoryName, confirmToSuggestions, requesterOf, state, updateRequest } from '../store'
import { STATUSES, type Priority, type Request, type Status } from '../types'

const props = defineProps<{ showArchived: boolean }>()
const emit = defineEmits<{ open: [request: Request] }>()

const priorityColor: Record<Priority, string> = {
  急ぎ: 'red',
  高: 'orange',
  中: 'blue',
  低: 'grey',
}

const statusColor: Record<Status, string> = {
  未着手: 'grey',
  作業中: 'blue',
  確認待ち: '#A8329E',
  完了: 'green',
  ペンディング: 'brown',
}

const rows = computed(() =>
  state.requests.filter((r) => props.showArchived || !r.archived),
)

function progress(r: Request) {
  if (r.checklist.length === 0) return ''
  const done = r.checklist.filter((c) => c.done).length
  return `${done}/${r.checklist.length} 完了`
}

function dueClass(r: Request) {
  const level = dueLevel(r)
  return level === 'overdue' ? 'due-overdue' : level === 'soon' ? 'due-soon' : ''
}

// 一覧からのステータス変更。「確認待ち」にしたときは、確認先の入力欄を出す
const confirmTarget = ref<Request | null>(null)
const confirmText = ref('')

function changeStatus(r: Request, status: Status) {
  if (status === '確認待ち') {
    confirmTarget.value = r
    confirmText.value = r.confirmTo
    return
  }
  updateRequest({ ...r, status })
}

function finishConfirm() {
  const r = confirmTarget.value
  if (r) updateRequest({ ...r, status: '確認待ち', confirmTo: (confirmText.value ?? '').trim() })
  confirmTarget.value = null
}
</script>

<template>
  <v-table hover class="request-table">
    <thead>
      <tr>
        <th style="width: 40px"></th>
        <th style="width: 80px">優先度</th>
        <th>タイトル</th>
        <th style="width: 150px">カテゴリー</th>
        <th style="width: 130px">依頼者</th>
        <th style="width: 190px">ステータス</th>
        <th style="width: 130px">期限日</th>
        <th style="width: 60px">QMS</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="r in rows"
        :key="r.id"
        :class="{ archived: r.archived }"
        class="row"
        @click="emit('open', r)"
      >
        <td><v-icon icon="mdi-drag" color="grey-lighten-1" title="手動の並びのときにドラッグできます（プロトタイプでは動きません）" /></td>
        <td><v-chip :color="priorityColor[r.priority]" size="small" label>{{ r.priority }}</v-chip></td>
        <td>
          <div class="font-weight-medium">
            {{ r.title }}
            <v-chip v-if="r.archived" size="x-small" class="ml-1" label>アーカイブ</v-chip>
          </div>
          <div v-if="progress(r)" class="text-caption text-medium-emphasis">{{ progress(r) }}</div>
        </td>
        <td>{{ categoryName(r.categoryId) }}</td>
        <td>{{ requesterOf(r.requesterId)?.name }}</td>
        <td @click.stop>
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-chip v-bind="menuProps" :color="statusColor[r.status]" size="small" append-icon="mdi-menu-down" style="cursor: pointer">
                {{ r.status }}
              </v-chip>
            </template>
            <v-list density="compact">
              <v-list-item v-for="s in STATUSES" :key="s" :title="s" @click="changeStatus(r, s)" />
            </v-list>
          </v-menu>
          <span v-if="r.status === '確認待ち' && r.confirmTo" class="text-caption ml-2">→ {{ r.confirmTo }}</span>
        </td>
        <td :class="dueClass(r)">{{ formatDate(r.dueOn) }}</td>
        <td><v-icon v-if="r.qms" icon="mdi-check-circle" color="primary" /></td>
      </tr>
      <tr v-if="rows.length === 0">
        <td colspan="8" class="text-center text-medium-emphasis pa-6">依頼がありません</td>
      </tr>
    </tbody>
  </v-table>

  <v-dialog :model-value="confirmTarget !== null" max-width="420" @update:model-value="confirmTarget = null">
    <v-card title="確認先を入力">
      <v-card-text>
        <v-combobox v-model="confirmText" :items="confirmToSuggestions()" label="確認先（空でもかまいません）" autofocus />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="finishConfirm">確認待ちにする</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.row {
  cursor: pointer;
}
.archived {
  opacity: 0.55;
}
.due-overdue {
  color: #d32f2f;
  font-weight: bold;
}
.due-soon {
  color: #ef6c00;
  font-weight: bold;
}
</style>
