<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { apiErrorMessage, fetchTemplateItems, saveTemplateItems } from '../api'
import {
  addTemplateItem,
  isTemplateChanged,
  normalizeTemplate,
  removeTemplateItem,
  renameTemplateItem,
  validateTemplate,
} from '../templateEdit'

// category＝テンプレートを編集するカテゴリー（閉じているときは null）
const props = defineProps<{ category: { id: number; name: string } | null }>()
const emit = defineEmits<{ close: [] }>()

const original = ref<string[]>([]) // 開いたときの内容（変更の有無を調べるため）
const names = ref<string[]>([]) // 画面で直している内容
const newItem = ref('')
const loading = ref(false)
const loaded = ref(false) // 読み込めたか（読み込めなかったときは、編集させない）
const saving = ref(false)
const errorMessage = ref('')

// 保存していない変更があるか（足している途中の文字も含める）
const dirty = computed(
  () => isTemplateChanged(original.value, names.value) || !!newItem.value.trim(),
)

// 開くたびに、最新のテンプレートを取り直す。読み込み中に、閉じた（別のカテゴリーを開いた）ときは、結果を捨てる
let openCount = 0
watch(
  () => props.category?.id ?? null,
  async (id) => {
    const myCount = ++openCount
    original.value = []
    names.value = []
    newItem.value = ''
    errorMessage.value = ''
    loaded.value = false
    if (id === null) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const items = await fetchTemplateItems(id)
      if (myCount !== openCount) return
      original.value = items
      names.value = [...items]
      loaded.value = true
    } catch {
      if (myCount !== openCount) return
      errorMessage.value = '項目を読み込めませんでした。'
    } finally {
      if (myCount === openCount) loading.value = false
    }
  },
  { immediate: true },
)

function onAdd() {
  names.value = addTemplateItem(names.value, newItem.value)
  newItem.value = ''
}

// Enter で足す。ただし、日本語の変換を確定する Enter（isComposing）では、足さない
function onAddEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  onAdd()
}

async function save() {
  const category = props.category
  if (!category) return
  // 入力欄に書きかけの項目があれば、足してから保存する（書いたものが、消えないように）
  const next = addTemplateItem(names.value, newItem.value)
  const problem = validateTemplate(next)
  if (problem) {
    errorMessage.value = problem
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await saveTemplateItems(category.id, normalizeTemplate(next))
    emit('close')
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, '保存できませんでした。もう一度お試しください。')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- 保存していない変更があるときは、枠の外を押す・Esc では閉じない（編集中の内容が、うっかり消えないように） -->
  <v-dialog
    :model-value="category !== null"
    :aria-label="`テンプレートの編集：${category?.name ?? ''}`"
    max-width="560"
    scrollable
    :persistent="dirty"
    @update:model-value="(value: boolean) => !value && emit('close')"
  >
    <v-card :title="`テンプレートの編集：${category?.name ?? ''}`" data-testid="template-dialog">
      <v-progress-linear v-if="loading || saving" indeterminate />
      <v-card-text>
        <v-alert
          v-if="errorMessage"
          type="error"
          density="compact"
          class="mb-3"
          data-testid="template-error"
        >
          {{ errorMessage }}
        </v-alert>

        <template v-if="loaded">
          <div class="text-caption text-medium-emphasis mb-3">
            「保存」を押すと、この一覧が、そのままテンプレートになります。すでにある依頼のチェックリストは、変わりません（次に「テンプレートを入れる」を押したときから、新しい内容になります）。
          </div>
          <div
            v-if="names.length === 0"
            class="text-medium-emphasis text-body-2 mb-2"
            data-testid="template-empty"
          >
            項目がありません。下から足してください。
          </div>
          <div
            v-for="(name, index) in names"
            :key="index"
            class="d-flex align-center ga-2 mb-1"
            data-testid="template-row"
          >
            <v-text-field
              :model-value="name"
              :prefix="`${index + 1}.`"
              :aria-label="`${index + 1}番目の項目`"
              density="compact"
              hide-details
              data-testid="template-name"
              @update:model-value="names = renameTemplateItem(names, index, $event)"
            />
            <v-btn
              icon="mdi-close"
              size="small"
              variant="text"
              color="grey"
              :aria-label="`${index + 1}番目の項目を消す`"
              data-testid="template-remove"
              @click="names = removeTemplateItem(names, index)"
            />
          </div>

          <div class="d-flex align-center ga-2 mt-4">
            <v-text-field
              v-model="newItem"
              label="項目を足す"
              density="compact"
              hide-details
              data-testid="template-new"
              @keydown.enter="onAddEnter"
            />
            <v-btn variant="flat" prepend-icon="mdi-plus" data-testid="template-add" @click="onAdd">
              足す
            </v-btn>
          </div>
        </template>
      </v-card-text>
      <v-card-actions>
        <span v-if="dirty" class="text-caption text-medium-emphasis ml-2">
          保存していない変更があります
        </span>
        <v-spacer />
        <v-btn
          :color="dirty ? 'error' : undefined"
          data-testid="template-close"
          @click="emit('close')"
        >
          {{ dirty ? '変更を捨てて閉じる' : '閉じる' }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="!loaded"
          data-testid="template-save"
          @click="save"
        >
          保存
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
