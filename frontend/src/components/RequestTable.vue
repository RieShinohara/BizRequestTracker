<script setup lang="ts">
import { ref } from 'vue'
import { PRIORITY_COLOR, STATUS_COLOR, formatDate, progressText } from '../display'
import { STATUSES, type RequestRow, type Status, type StatusChange } from '../types'
import ConfirmToDialog from './ConfirmToDialog.vue'

defineProps<{ rows: RequestRow[]; filtered: boolean }>()
const emit = defineEmits<{ 'change-status': [change: StatusChange] }>()

// 「確認待ち」を選んだ依頼。確認先を入力してもらう間だけ入る
const confirming = ref<RequestRow | null>(null)

function chooseStatus(row: RequestRow, status: Status) {
  // 同じステータスは、何も送らない。ただし「確認待ち」だけは、確認先を変えられるように開く
  if (status === row.status && status !== '確認待ち') return
  if (status === '確認待ち') {
    confirming.value = row
    return
  }
  emit('change-status', { id: row.id, status })
}

function finishConfirm(confirmTo: string) {
  const row = confirming.value
  confirming.value = null
  if (row) emit('change-status', { id: row.id, status: '確認待ち', confirmTo })
}
</script>

<template>
  <v-table hover>
    <thead>
      <tr>
        <th style="width: 40px"></th>
        <th style="width: 80px">優先度</th>
        <th>タイトル</th>
        <th style="width: 150px">カテゴリー</th>
        <th style="width: 130px">依頼者</th>
        <th style="width: 290px">ステータス</th>
        <th style="width: 130px">期限日</th>
        <th style="width: 60px">QMS</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.id" :class="{ archived: row.archived }">
        <!-- ドラッグの取っ手：動くようになるのは、手動の並びの Issue から -->
        <td><v-icon icon="mdi-drag" color="grey-lighten-1" /></td>
        <td>
          <v-chip :color="PRIORITY_COLOR[row.priority]" size="small" label>
            {{ row.priority }}
          </v-chip>
        </td>
        <td>
          <div class="font-weight-medium">
            {{ row.title }}
            <v-chip v-if="row.archived" size="x-small" class="ml-1" label>アーカイブ</v-chip>
          </div>
          <div v-if="progressText(row)" class="text-caption text-medium-emphasis">
            {{ progressText(row) }}
          </div>
        </td>
        <td>{{ row.category.name }}</td>
        <td>{{ row.requester.name }}</td>
        <td class="status-cell">
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-chip
                v-bind="menuProps"
                :color="STATUS_COLOR[row.status]"
                size="small"
                append-icon="mdi-menu-down"
                style="cursor: pointer"
                data-testid="status-chip"
              >
                {{ row.status }}
              </v-chip>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="status in STATUSES"
                :key="status"
                :title="status"
                :active="status === row.status"
                @click="chooseStatus(row, status)"
              />
            </v-list>
          </v-menu>
          <!-- 確認待ちのとき、確認先を押すと、確認先だけを変えられる。未入力なら「確認先を入力」 -->
          <span
            v-if="row.status === '確認待ち'"
            class="text-caption ml-2 confirm-link"
            :class="{ 'text-medium-emphasis': !row.confirm_to }"
            role="button"
            tabindex="0"
            data-testid="confirm-link"
            @click="confirming = row"
            @keydown.enter="confirming = row"
          >
            → {{ row.confirm_to || '確認先を入力' }}
          </span>
        </td>
        <td
          :class="{
            'due-overdue': row.due_level === 'overdue',
            'due-soon': row.due_level === 'soon',
          }"
        >
          {{ formatDate(row.due_on) }}
        </td>
        <td><v-icon v-if="row.qms" icon="mdi-check-circle" color="primary" /></td>
      </tr>
      <tr v-if="rows.length === 0">
        <td colspan="8" class="text-center text-medium-emphasis pa-6">
          {{ filtered ? '条件に合う依頼がありません' : '依頼がありません' }}
        </td>
      </tr>
    </tbody>
  </v-table>

  <ConfirmToDialog
    :open="confirming !== null"
    :initial="confirming?.confirm_to ?? null"
    :changing-only="confirming?.status === '確認待ち'"
    @submit="finishConfirm"
    @cancel="confirming = null"
  />
</template>

<style scoped>
.status-cell {
  white-space: nowrap;
}
.confirm-link {
  cursor: pointer;
  text-decoration: underline dotted;
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
