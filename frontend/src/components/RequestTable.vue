<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { PRIORITY_COLOR, STATUS_COLOR, dueLevelLabel, formatDate, progressText } from '../display'
import { moveItem } from '../order'
import { STATUSES, type RequestRow, type Status, type StatusChange } from '../types'
import ConfirmToDialog from './ConfirmToDialog.vue'

// dragDisabledReason＝ドラッグできない理由（ドラッグできるときは null）
const props = defineProps<{
  rows: RequestRow[]
  filtered: boolean
  dragDisabledReason: string | null
}>()
const emit = defineEmits<{
  'change-status': [change: StatusChange]
  open: [id: number]
  reorder: [rows: RequestRow[]]
}>()

// 表示する行。ドラッグの部品が、この配列を並べ替える。親から新しい一覧が届いたら、入れ替える
const list = ref<RequestRow[]>([...props.rows])
watch(
  () => props.rows,
  (rows) => {
    list.value = [...rows]
  },
)

// ドラッグ（行の並び替え）。取っ手（.drag-handle）だけでつかめる。
// 並びは、「ドラッグの前の一覧（props.rows）」と、動かした位置から、自分で計算して、親に伝える
// （保存は、親が行う。保存できなければ、親が一覧を取り直して、元の並びに戻る）
const tbody = ref<HTMLElement | null>(null)
const { option } = useDraggable(tbody, list, {
  handle: '.drag-handle',
  draggable: '.row',
  animation: 150,
  disabled: props.dragDisabledReason !== null,
  onUpdate: (event) => {
    const { oldDraggableIndex, newDraggableIndex } = event
    if (oldDraggableIndex === undefined || newDraggableIndex === undefined) return
    const moved = moveItem(props.rows, oldDraggableIndex, newDraggableIndex)
    if (moved !== props.rows) emit('reorder', moved)
  },
})
// ドラッグできる・できないが変わったら、部品に伝える
watch(
  () => props.dragDisabledReason,
  (reason) => option('disabled', reason !== null),
)

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
    <tbody ref="tbody">
      <tr
        v-for="row in list"
        :key="row.id"
        :class="{ archived: row.archived }"
        class="row"
        data-testid="row"
        @click="emit('open', row.id)"
      >
        <!-- ドラッグの取っ手。手動の並びのときだけ使える（使えないときは、理由を出す） -->
        <td
          class="handle-cell"
          :title="dragDisabledReason ?? 'ドラッグして、並びを変える'"
          @click.stop
        >
          <v-icon
            icon="mdi-drag"
            :class="dragDisabledReason === null ? 'drag-handle' : 'drag-handle-disabled'"
            :color="dragDisabledReason === null ? 'grey-darken-1' : 'grey-lighten-2'"
            data-testid="drag-handle"
          />
          <!-- 読み上げソフト向けの説明。ドラッグは、マウスで行う操作 -->
          <span class="visually-hidden">
            {{ dragDisabledReason ?? '並びを変える取っ手（マウスで、ドラッグして動かします）' }}
          </span>
        </td>
        <td>
          <v-chip :color="PRIORITY_COLOR[row.priority]" size="small" label>
            {{ row.priority }}
          </v-chip>
        </td>
        <td>
          <div class="font-weight-medium">
            <!-- Tab キーで止まり、Enter で詳細を開けるボタン。見た目は、ふつうの文字と同じ。
                 行のクリックでも開く（.stop は、行のクリックと二重に開かないため） -->
            <button
              type="button"
              class="title-button"
              aria-haspopup="dialog"
              data-testid="open-request"
              @click.stop="emit('open', row.id)"
            >
              {{ row.title }}
            </button>
            <v-chip v-if="row.archived" size="x-small" class="ml-1" label>アーカイブ</v-chip>
          </div>
          <div v-if="progressText(row)" class="text-caption text-medium-emphasis">
            {{ progressText(row) }}
          </div>
        </td>
        <td>{{ row.category.name }}</td>
        <td>{{ row.requester.name }}</td>
        <td class="status-cell" @click.stop>
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
          <!-- 色（赤・オレンジ）は、読み上げソフトに伝わらないので、文字でも伝える -->
          <span v-if="row.due_level" class="visually-hidden">
            （{{ dueLevelLabel(row.due_level) }}）
          </span>
        </td>
        <td>
          <template v-if="row.qms">
            <v-icon icon="mdi-check-circle" color="primary" />
            <span class="visually-hidden">QMS チェックあり</span>
          </template>
        </td>
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
/* タイトルのボタン：ふつうの文字と同じ見た目。Tab で止まったときだけ、枠を出す */
.title-button {
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.title-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 2px;
}
/* 画面には出さず、読み上げソフトだけに伝える文字 */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.drag-handle {
  cursor: grab;
}
.drag-handle-disabled {
  cursor: not-allowed;
}
.row {
  cursor: pointer;
}
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
