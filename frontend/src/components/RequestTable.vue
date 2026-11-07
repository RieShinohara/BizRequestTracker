<script setup lang="ts">
import { PRIORITY_COLOR, STATUS_COLOR, formatDate, progressText } from '../display'
import type { RequestRow } from '../types'

defineProps<{ rows: RequestRow[] }>()
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
        <th style="width: 190px">ステータス</th>
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
        <td>
          <v-chip :color="STATUS_COLOR[row.status]" size="small">{{ row.status }}</v-chip>
          <span v-if="row.status === '確認待ち' && row.confirm_to" class="text-caption ml-2">
            → {{ row.confirm_to }}
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
        <td colspan="8" class="text-center text-medium-emphasis pa-6">依頼がありません</td>
      </tr>
    </tbody>
  </v-table>
</template>

<style scoped>
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
