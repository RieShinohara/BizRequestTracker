<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  addRequest,
  confirmToSuggestions,
  deleteRequest,
  findOrCreateRequester,
  newChecklistId,
  requesterOf,
  state,
  templateChecklist,
  updateRequest,
} from '../store'
import { PRIORITIES, STATUSES, type Request } from '../types'

const props = defineProps<{ request: Request | null; isNew: boolean }>()
const emit = defineEmits<{ close: [] }>()

const draft = ref<Request | null>(null)
const requesterName = ref('')
const requesterExt = ref('')
const newItem = ref('')
const confirmDelete = ref(false)
const error = ref('')

watch(
  () => props.request,
  (r) => {
    error.value = ''
    newItem.value = ''
    if (!r) {
      draft.value = null
      return
    }
    draft.value = JSON.parse(JSON.stringify(r)) as Request
    const req = requesterOf(r.requesterId)
    requesterName.value = req?.name ?? ''
    requesterExt.value = req?.extension ?? ''
  },
  { immediate: true },
)

const requesterNames = computed(() => state.requesters.map((r) => r.name))

// 登録済みの人を選んだら、内線番号を入れる
function onRequesterChange(name: string | null) {
  requesterName.value = name ?? ''
  const found = state.requesters.find((r) => r.name === requesterName.value)
  requesterExt.value = found?.extension ?? ''
}

const categoryItems = computed(() => state.categories.map((c) => ({ title: c.name, value: c.id })))

function applyTemplate() {
  if (!draft.value) return
  draft.value.checklist.push(...templateChecklist(draft.value.categoryId))
}

function addItem() {
  const name = newItem.value.trim()
  if (!name || !draft.value) return
  draft.value.checklist.push({ id: newChecklistId(), name, done: false })
  newItem.value = ''
}

function removeItem(id: number) {
  if (!draft.value) return
  draft.value.checklist = draft.value.checklist.filter((c) => c.id !== id)
}

function save() {
  const d = draft.value
  if (!d) return
  if (!d.title.trim() || !requesterName.value.trim() || !d.dueOn) {
    error.value = 'タイトル、依頼者、期限日は必須です'
    return
  }
  const requester = findOrCreateRequester(requesterName.value, requesterExt.value)
  d.requesterId = requester.id
  d.title = d.title.trim()
  if (props.isNew) addRequest(d)
  else updateRequest(d)
  emit('close')
}

// アーカイブ・元に戻す は、その場で反映して閉じる
function setArchived(value: boolean) {
  if (!draft.value) return
  updateRequest({ ...draft.value, archived: value })
  emit('close')
}

function doDelete() {
  if (!draft.value) return
  deleteRequest(draft.value.id)
  confirmDelete.value = false
  emit('close')
}
</script>

<template>
  <v-dialog :model-value="request !== null" max-width="1000" scrollable @update:model-value="emit('close')">
    <v-card v-if="draft">
      <!-- 上の段：タイトル・ステータス・優先度 -->
      <v-card-item>
        <v-row dense align="center">
          <v-col cols="12" md="7">
            <v-text-field v-model="draft.title" label="タイトル（必須）" hide-details />
          </v-col>
          <v-col cols="6" md="3">
            <v-select v-model="draft.status" :items="[...STATUSES]" label="ステータス" hide-details />
          </v-col>
          <v-col cols="6" md="2">
            <v-select v-model="draft.priority" :items="[...PRIORITIES]" label="優先度" hide-details />
          </v-col>
        </v-row>
      </v-card-item>
      <v-divider />

      <v-card-text>
        <v-row>
          <!-- 左側：依頼の情報 -->
          <v-col cols="12" md="7">
            <v-textarea v-model="draft.description" label="詳細" rows="3" auto-grow />
            <v-row dense>
              <v-col cols="12" sm="7">
                <v-combobox
                  :model-value="requesterName"
                  :items="requesterNames"
                  label="依頼者（必須）"
                  hint="登録済みから選ぶか、新しい名前を入力"
                  persistent-hint
                  @update:model-value="onRequesterChange"
                />
              </v-col>
              <v-col cols="12" sm="5">
                <v-text-field v-model="requesterExt" label="内線番号" prepend-inner-icon="mdi-phone" />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-select v-model="draft.categoryId" :items="categoryItems" label="カテゴリー" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-combobox
                  v-model="draft.confirmTo"
                  :items="confirmToSuggestions()"
                  label="確認先"
                  :disabled="draft.status !== '確認待ち'"
                  :hint="draft.status !== '確認待ち' ? '確認待ちのときに入力します' : ''"
                  persistent-hint
                />
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field v-model="draft.receivedOn" type="date" label="受付日" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="draft.dueOn" type="date" label="期限日（必須）" />
              </v-col>
            </v-row>
            <v-checkbox v-model="draft.qms" label="QMS チェック" hide-details density="compact" />
          </v-col>

          <!-- 右側：チェックリスト -->
          <v-col cols="12" md="5">
            <div class="d-flex align-center mb-2">
              <div class="text-subtitle-1 font-weight-bold">チェックリスト</div>
              <v-spacer />
              <v-btn size="small" variant="tonal" prepend-icon="mdi-playlist-plus" @click="applyTemplate">
                テンプレートを入れる
              </v-btn>
            </div>
            <div v-if="draft.checklist.length === 0" class="text-medium-emphasis text-body-2 mb-2">
              項目がありません。テンプレートを入れるか、下から足してください。
            </div>
            <v-list density="compact" class="checklist pa-0">
              <v-list-item v-for="c in draft.checklist" :key="c.id" class="px-0">
                <div class="d-flex align-center">
                  <v-checkbox v-model="c.done" hide-details density="compact" />
                  <span :class="{ 'text-decoration-line-through text-medium-emphasis': c.done }">{{ c.name }}</span>
                  <v-spacer />
                  <v-btn icon="mdi-close" size="x-small" variant="text" color="grey" @click="removeItem(c.id)" />
                </div>
              </v-list-item>
            </v-list>
            <v-text-field
              v-model="newItem"
              label="項目を足す"
              density="compact"
              hide-details
              append-inner-icon="mdi-plus"
              class="mt-2"
              @keyup.enter="addItem"
              @click:append-inner="addItem"
            />
          </v-col>
        </v-row>
        <v-alert v-if="error" type="error" density="compact" class="mt-2">{{ error }}</v-alert>
      </v-card-text>

      <v-divider />
      <!-- 下の段：保存・アーカイブ -->
      <v-card-actions>
        <template v-if="!isNew">
          <v-btn v-if="!draft.archived" prepend-icon="mdi-archive-outline" @click="setArchived(true)">アーカイブ</v-btn>
          <template v-else>
            <v-btn prepend-icon="mdi-archive-arrow-up-outline" @click="setArchived(false)">元に戻す</v-btn>
            <v-btn color="error" prepend-icon="mdi-delete-outline" @click="confirmDelete = true">完全に削除</v-btn>
          </template>
        </template>
        <v-spacer />
        <v-btn @click="emit('close')">閉じる</v-btn>
        <v-btn color="primary" variant="flat" @click="save">保存</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmDelete" max-width="420">
    <v-card title="完全に削除しますか？">
      <v-card-text>
        「{{ draft?.title }}」を完全に削除します。チェックリストも一緒に消えます。<strong>元に戻せません。</strong>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="confirmDelete = false">やめる</v-btn>
        <v-btn color="error" variant="flat" @click="doDelete">削除する</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.checklist {
  max-height: 320px;
  overflow-y: auto;
}
</style>
