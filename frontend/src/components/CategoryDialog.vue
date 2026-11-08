<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  apiErrorMessage,
  createCategory,
  deleteCategory,
  fetchCategories,
  renameCategory,
} from '../api'
import { deleteBlockedReason, validateCategoryName } from '../categoryManage'
import type { CategoryWithCount } from '../types'
import TemplateDialog from './TemplateDialog.vue'

// open＝開いているか。変更（追加・名前の変更・削除）に成功したら、changed を伝える（親が、一覧などを取り直す）
const props = defineProps<{ open: boolean }>()
// closed＝モーダルが、閉じ終わった（親が、Tab の位置を、開いたボタンへ戻すため）
const emit = defineEmits<{ close: []; changed: []; closed: [] }>()

const categories = ref<CategoryWithCount[]>([])
const loading = ref(false)
const working = ref(false)
const errorMessage = ref('')

const newName = ref('')
// 名前を直している最中のカテゴリー（なければ null）と、入力欄の文字
const editingId = ref<number | null>(null)
const editName = ref('')
// 削除の確認を出しているカテゴリー（なければ null）
const deleting = ref<CategoryWithCount | null>(null)
// テンプレートを編集しているカテゴリー（なければ null）
const templateTarget = ref<CategoryWithCount | null>(null)

async function load() {
  loading.value = true
  try {
    categories.value = await fetchCategories()
  } catch {
    errorMessage.value = 'カテゴリーを読み込めませんでした。'
  } finally {
    loading.value = false
  }
}

// 開くたびに、最新の一覧を取り直す（入力中の文字や、エラーも、まっさらにする）
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    errorMessage.value = ''
    newName.value = ''
    editingId.value = null
    deleting.value = null
    templateTarget.value = null
    load()
  },
  { immediate: true },
)

// 変更の共通の流れ：通信 → 成功したら、一覧を取り直して、親に伝える。失敗したら、理由を出す
async function run(action: () => Promise<unknown>, failure: string): Promise<boolean> {
  working.value = true
  errorMessage.value = ''
  try {
    await action()
    await load()
    emit('changed')
    return true
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, failure)
    return false
  } finally {
    working.value = false
  }
}

async function onAdd() {
  const problem = validateCategoryName(newName.value)
  if (problem) {
    errorMessage.value = problem
    return
  }
  const name = newName.value.trim()
  if (await run(() => createCategory(name), 'カテゴリーを追加できませんでした。')) {
    newName.value = ''
  }
}

// Enter で追加する。ただし、日本語の変換を確定する Enter（isComposing）では、追加しない
function onAddEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  onAdd()
}

function startEdit(category: CategoryWithCount) {
  editingId.value = category.id
  editName.value = category.name
  errorMessage.value = ''
}

async function onRename() {
  const id = editingId.value
  if (id === null) return
  const problem = validateCategoryName(editName.value)
  if (problem) {
    errorMessage.value = problem
    return
  }
  const name = editName.value.trim()
  if (await run(() => renameCategory(id, name), '名前を変更できませんでした。')) {
    editingId.value = null
  }
}

function onRenameEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  onRename()
}

async function onDelete() {
  const target = deleting.value
  if (!target) return
  await run(() => deleteCategory(target.id), 'カテゴリーを削除できませんでした。')
  deleting.value = null
}
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="560"
    scrollable
    @after-leave="emit('closed')"
    @update:model-value="(value: boolean) => !value && emit('close')"
  >
    <v-card title="カテゴリー管理" data-testid="category-dialog">
      <v-progress-linear v-if="loading || working" indeterminate />
      <v-card-text>
        <v-alert
          v-if="errorMessage"
          type="error"
          density="compact"
          class="mb-3"
          data-testid="category-error"
        >
          {{ errorMessage }}
        </v-alert>

        <v-list density="compact" class="pa-0" data-testid="category-list">
          <v-list-item v-for="category in categories" :key="category.id" class="px-0">
            <div v-if="editingId === category.id" class="d-flex align-center ga-2">
              <v-text-field
                v-model="editName"
                label="新しい名前"
                density="compact"
                hide-details
                autofocus
                data-testid="category-edit-name"
                @keydown.enter="onRenameEnter"
                @keydown.esc.stop="editingId = null"
              />
              <v-btn
                icon="mdi-check"
                size="small"
                variant="text"
                :disabled="working"
                aria-label="名前の変更を保存"
                data-testid="category-rename-save"
                @click="onRename"
              />
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                color="grey"
                aria-label="名前の変更をやめる"
                @click="editingId = null"
              />
            </div>
            <div v-else class="d-flex align-center">
              <span class="flex-grow-1" data-testid="category-name">{{ category.name }}</span>
              <v-chip size="x-small" label class="mr-2">依頼 {{ category.request_count }}件</v-chip>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-format-list-checks"
                :disabled="working"
                :aria-label="`${category.name}のテンプレートを編集`"
                data-testid="category-template"
                @click="templateTarget = category"
              >
                テンプレート
              </v-btn>
              <v-btn
                icon="mdi-pencil-outline"
                size="small"
                variant="text"
                :disabled="working"
                :aria-label="`${category.name}の名前を変更`"
                data-testid="category-rename"
                @click="startEdit(category)"
              />
              <!-- 使っている依頼があると、削除できない。押せないボタンには、理由を出す -->
              <span :title="deleteBlockedReason(category) ?? undefined">
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  color="error"
                  :disabled="working || deleteBlockedReason(category) !== null"
                  :aria-label="`${category.name}を削除`"
                  data-testid="category-delete"
                  @click="deleting = category"
                />
              </span>
            </div>
          </v-list-item>
        </v-list>
        <div
          v-if="!loading && categories.length === 0"
          class="text-medium-emphasis text-body-2 mb-2"
        >
          カテゴリーがありません。下から追加してください。
        </div>

        <div class="d-flex align-center ga-2 mt-4">
          <v-text-field
            v-model="newName"
            label="新しいカテゴリー名"
            density="compact"
            hide-details
            data-testid="category-new-name"
            @keydown.enter="onAddEnter"
          />
          <v-btn
            variant="flat"
            prepend-icon="mdi-plus"
            :disabled="working"
            data-testid="category-add"
            @click="onAdd"
          >
            追加
          </v-btn>
        </div>
        <div class="text-caption text-medium-emphasis mt-2">
          使っている依頼があるカテゴリーは、削除できません。
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="emit('close')">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- テンプレートの編集 -->
  <TemplateDialog :category="templateTarget" @close="templateTarget = null" />

  <!-- 削除の確認 -->
  <v-dialog :model-value="deleting !== null" max-width="420" @update:model-value="deleting = null">
    <v-card title="カテゴリーを削除しますか？">
      <v-card-text>
        「{{ deleting?.name }}」を削除します。このカテゴリーのテンプレートも一緒に消えます。
        <strong>元に戻せません。</strong>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn data-testid="category-delete-cancel" @click="deleting = null">やめる</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="working"
          data-testid="category-delete-confirm"
          @click="onDelete"
        >
          削除する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
