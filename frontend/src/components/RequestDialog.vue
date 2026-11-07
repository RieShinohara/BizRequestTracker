<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  createRequest,
  fetchConfirmTargets,
  fetchRequest,
  fetchRequesters,
  updateRequest,
} from '../api'
import {
  detailToForm,
  emptyForm,
  formToPatch,
  resolveRequesterId,
  todayIso,
  validateForm,
  type RequestForm,
} from '../requestForm'
import { PRIORITIES, STATUSES, type Category, type RequestDetail, type Requester } from '../types'

// requestId＝直す依頼の番号、isNew＝新しい依頼を作る（どちらでもなければ、閉じている）
const props = defineProps<{ requestId: number | null; isNew: boolean; categories: Category[] }>()
const isOpen = computed(() => props.isNew || props.requestId !== null)
const emit = defineEmits<{ close: []; saved: [] }>()

const detail = ref<RequestDetail | null>(null)
const form = ref<RequestForm | null>(null)
const requesters = ref<Requester[]>([])
const confirmTargets = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

// 表示するチェックリスト（新しい依頼は、まだない）
const checklistItems = computed(() => detail.value?.checklist_items ?? [])
const requesterNames = computed(() => requesters.value.map((requester) => requester.name))
const categoryItems = computed(() =>
  props.categories.map((category) => ({ title: category.name, value: category.id })),
)

// 開くたびに、最新の内容を取り直す（一覧の情報は、古いかもしれないため）。
// 新しい依頼のときは、依頼者の一覧と確認先の候補だけを取って、空の入力欄を出す。
// 読み込み中に、閉じた（または別の依頼を開いた）ときは、結果を捨てる（番号で見分ける）
let openCount = 0
watch(
  () => [props.requestId, props.isNew] as const,
  async ([id, isNew]) => {
    const myCount = ++openCount
    detail.value = null
    form.value = null
    errorMessage.value = ''
    if (id === null && !isNew) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const [loaded, requesterList, targets] = await Promise.all([
        id !== null ? fetchRequest(id) : Promise.resolve(null),
        fetchRequesters(),
        fetchConfirmTargets().catch(() => [] as string[]), // 候補が取れなくても、入力はできる
      ])
      if (myCount !== openCount) return
      detail.value = loaded
      form.value = loaded
        ? detailToForm(loaded)
        : emptyForm(props.categories[0]?.id ?? null, todayIso())
      requesters.value = requesterList
      confirmTargets.value = targets
    } catch {
      if (myCount !== openCount) return
      errorMessage.value = '依頼を読み込めませんでした。'
    } finally {
      if (myCount === openCount) loading.value = false
    }
  },
  { immediate: true },
)

// 登録済みの依頼者を選んだら、その人の内線番号を入れる（新しい名前なら、空にする）
function onRequesterChange(name: string | null) {
  if (!form.value) return
  const text = name ?? ''
  form.value.requesterName = text
  form.value.requesterExtension =
    requesters.value.find((requester) => requester.name === text)?.extension ?? ''
}

async function save() {
  const current = form.value
  const id = props.requestId
  if (!current || (id === null && !props.isNew)) return
  const problem = validateForm(current)
  if (problem) {
    errorMessage.value = problem
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const requesterId = await resolveRequesterId(current, requesters.value)
    const body = formToPatch(current, requesterId)
    if (id === null) await createRequest(body)
    else await updateRequest(id, body)
    emit('saved')
  } catch {
    errorMessage.value = '保存できませんでした。入力を確かめて、もう一度お試しください。'
    // 新しい依頼者を登録したあとで失敗したとき、やり直すと「同じ名前」で止まらないよう、一覧を取り直す
    fetchRequesters()
      .then((list) => (requesters.value = list))
      .catch(() => {})
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="isOpen"
    max-width="1000"
    scrollable
    @update:model-value="(value: boolean) => !value && emit('close')"
  >
    <v-card>
      <v-progress-linear v-if="loading" indeterminate />
      <v-alert
        v-if="errorMessage && !form"
        type="error"
        variant="tonal"
        class="ma-4"
        data-testid="dialog-load-error"
      >
        {{ errorMessage }}
      </v-alert>

      <template v-if="form">
        <v-card-title v-if="isNew" class="pt-4">新しい依頼</v-card-title>
        <!-- 上の段：タイトル・ステータス・優先度 -->
        <v-card-item>
          <v-row dense align="center">
            <v-col cols="12" md="7">
              <v-text-field
                v-model="form.title"
                label="タイトル（必須）"
                hide-details
                data-testid="title"
              />
            </v-col>
            <v-col cols="6" md="3">
              <v-select
                v-model="form.status"
                :items="[...STATUSES]"
                label="ステータス"
                hide-details
              />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="form.priority"
                :items="[...PRIORITIES]"
                label="優先度"
                hide-details
              />
            </v-col>
          </v-row>
        </v-card-item>
        <v-divider />

        <v-card-text>
          <v-row>
            <!-- 左側：依頼の情報 -->
            <v-col cols="12" md="7">
              <v-textarea v-model="form.description" label="詳細" rows="3" auto-grow />
              <v-row dense>
                <v-col cols="12" sm="7">
                  <v-combobox
                    :model-value="form.requesterName"
                    :items="requesterNames"
                    label="依頼者（必須）"
                    hint="登録済みから選ぶか、新しい名前を入力"
                    persistent-hint
                    data-testid="requester"
                    @update:model-value="onRequesterChange"
                  />
                </v-col>
                <v-col cols="12" sm="5">
                  <v-text-field
                    v-model="form.requesterExtension"
                    label="内線番号"
                    prepend-inner-icon="mdi-phone"
                  />
                </v-col>
              </v-row>
              <v-row dense>
                <v-col cols="12" sm="6">
                  <v-select v-model="form.categoryId" :items="categoryItems" label="カテゴリー" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-combobox
                    v-model="form.confirmTo"
                    :items="confirmTargets"
                    label="確認先"
                    :disabled="form.status !== '確認待ち'"
                    :hint="form.status !== '確認待ち' ? '確認待ちのときに入力します' : ''"
                    persistent-hint
                  />
                </v-col>
              </v-row>
              <v-row dense>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="form.receivedOn" type="date" label="受付日" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    v-model="form.dueOn"
                    type="date"
                    label="期限日（必須）"
                    data-testid="due-on"
                  />
                </v-col>
              </v-row>
              <v-checkbox v-model="form.qms" label="QMS チェック" hide-details density="compact" />
            </v-col>

            <!-- 右側：チェックリスト（この段階では表示だけ。編集は、次の Issue）。新しい依頼は、空 -->
            <v-col cols="12" md="5">
              <div class="text-subtitle-1 font-weight-bold mb-2">チェックリスト</div>
              <div v-if="checklistItems.length === 0" class="text-medium-emphasis text-body-2">
                {{ isNew ? 'チェックリストは、保存したあとで追加します。' : '項目がありません。' }}
              </div>
              <v-list density="compact" class="checklist pa-0">
                <v-list-item v-for="(item, index) in checklistItems" :key="index" class="px-0">
                  <div class="d-flex align-center">
                    <v-icon
                      :icon="item.done ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                      :color="item.done ? 'primary' : 'grey'"
                      class="mr-2"
                    />
                    <span
                      :class="{ 'text-decoration-line-through text-medium-emphasis': item.done }"
                    >
                      {{ item.name }}
                    </span>
                  </div>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>
          <v-alert
            v-if="errorMessage"
            type="error"
            density="compact"
            class="mt-2"
            data-testid="dialog-error"
          >
            {{ errorMessage }}
          </v-alert>
        </v-card-text>

        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn @click="emit('close')">閉じる</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" data-testid="save" @click="save">
            保存
          </v-btn>
        </v-card-actions>
      </template>
      <v-card-actions v-else-if="!loading">
        <v-spacer />
        <v-btn @click="emit('close')">閉じる</v-btn>
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
