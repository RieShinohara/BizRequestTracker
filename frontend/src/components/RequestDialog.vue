<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  apiErrorMessage,
  createRequest,
  deleteRequest,
  fetchConfirmTargets,
  fetchRequest,
  fetchRequesters,
  fetchTemplateItems,
  updateRequest,
} from '../api'
import { addItem, mergeTemplate, removeItem, setDone } from '../checklist'
import {
  detailToForm,
  emptyForm,
  formToPatch,
  isFormChanged,
  resolveRequesterId,
  todayIso,
  validateForm,
  type RequestForm,
} from '../requestForm'
import { PRIORITIES, STATUSES, type Category, type RequestDetail, type Requester } from '../types'

// requestId＝直す依頼の番号、isNew＝新しい依頼を作る（どちらでもなければ、閉じている）
const props = defineProps<{ requestId: number | null; isNew: boolean; categories: Category[] }>()
const isOpen = computed(() => props.isNew || props.requestId !== null)
// closed＝モーダルが、閉じ終わった（親が、Tab の位置を、開いたボタンへ戻すため）
const emit = defineEmits<{ close: []; saved: []; closed: [] }>()

const detail = ref<RequestDetail | null>(null)
const form = ref<RequestForm | null>(null)
const original = ref<RequestForm | null>(null) // 開いたときの内容（変更の有無を調べるための写し）
const requesters = ref<Requester[]>([])
const confirmTargets = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

// チェックリストの操作に使う：項目を足す入力欄、お知らせ（テンプレートがない、など）、テンプレート読み込み中
const newItemName = ref('')
const checklistMessage = ref('')
const templateLoading = ref(false)
// 完全な削除の確認を出しているか、アーカイブ・削除の通信中か
const confirmingDelete = ref(false)
const working = ref(false)
// 保存していない変更があるか（「項目を足す」に書きかけの文字も含める）
const dirty = computed(
  () =>
    form.value !== null &&
    original.value !== null &&
    (isFormChanged(original.value, form.value) || !!newItemName.value.trim()),
)
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
    original.value = null
    errorMessage.value = ''
    newItemName.value = ''
    confirmingDelete.value = false
    checklistMessage.value = ''
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
      const today = todayIso()
      const makeForm = () =>
        loaded ? detailToForm(loaded) : emptyForm(props.categories[0]?.id ?? null, today)
      form.value = makeForm()
      original.value = makeForm() // 画面で直す入力欄とは別の、開いたときの写し
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

// チェックリストの操作。画面の入力欄（form.checklist）を直すだけで、保存は「保存」を押したときに行う
function onAddItem() {
  if (!form.value) return
  form.value.checklist = addItem(form.value.checklist, newItemName.value)
  newItemName.value = ''
  checklistMessage.value = ''
}

// Enter で足す。ただし、日本語の変換を確定する Enter（isComposing）では、足さない
function onEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  onAddItem()
}

function onRemoveItem(index: number) {
  if (form.value) form.value.checklist = removeItem(form.value.checklist, index)
}

function onToggleItem(index: number, done: boolean | null) {
  if (form.value) form.value.checklist = setDone(form.value.checklist, index, !!done)
}

// 「テンプレートを入れる」：選んでいるカテゴリーのテンプレートを、後ろに足す（同じ名前は重ねない）
async function applyTemplate() {
  const current = form.value
  if (!current || current.categoryId === null) return
  checklistMessage.value = ''
  templateLoading.value = true
  try {
    const names = await fetchTemplateItems(current.categoryId)
    if (form.value !== current) return // 読み込み中に、閉じた（または別の依頼を開いた）
    if (names.length === 0) {
      checklistMessage.value = 'このカテゴリーには、テンプレートがありません。'
      return
    }
    const merged = mergeTemplate(current.checklist, names)
    if (merged === current.checklist) {
      checklistMessage.value = 'テンプレートの項目は、すべて入っています。'
    } else {
      current.checklist = merged
    }
  } catch {
    if (form.value === current) checklistMessage.value = 'テンプレートを読み込めませんでした。'
  } finally {
    templateLoading.value = false
  }
}

// アーカイブ・元に戻す・完全な削除。押した時点の依頼（requestId）に対して、その場で行う。
// アーカイブと元に戻すは、archived だけを送る（画面で直している途中の内容は、保存しない）

async function setArchived(archived: boolean) {
  const id = props.requestId
  if (id === null) return
  working.value = true
  errorMessage.value = ''
  try {
    await updateRequest(id, { archived })
    emit('saved')
  } catch (error) {
    errorMessage.value = apiErrorMessage(
      error,
      archived
        ? 'アーカイブできませんでした。もう一度お試しください。'
        : '元に戻せませんでした。もう一度お試しください。',
    )
  } finally {
    working.value = false
  }
}

async function doDelete() {
  const id = props.requestId
  if (id === null) return
  working.value = true
  errorMessage.value = ''
  try {
    await deleteRequest(id)
    confirmingDelete.value = false
    emit('saved')
  } catch (error) {
    confirmingDelete.value = false
    errorMessage.value = apiErrorMessage(
      error,
      '削除できませんでした。アーカイブ中の依頼だけ、削除できます。',
    )
  } finally {
    working.value = false
  }
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
    const body = formToPatch(current, requesterId, detail.value?.checklist_items ?? [])
    if (id === null) await createRequest(body)
    else await updateRequest(id, body)
    emit('saved')
  } catch (error) {
    errorMessage.value = apiErrorMessage(
      error,
      '保存できませんでした。入力を確かめて、もう一度お試しください。',
    )
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
  <!-- 保存していない変更があるときは、枠の外を押す・Esc では閉じない（編集中の内容が、うっかり消えないように） -->
  <v-dialog
    :model-value="isOpen"
    max-width="1000"
    scrollable
    :persistent="dirty"
    @after-leave="emit('closed')"
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
          <v-row density="compact" align="center">
            <v-col cols="12" md="7">
              <v-text-field v-model="form.title" hide-details data-testid="title">
                <template #label>
                  タイトル<span class="required-mark"
                    ><span class="paren">（</span>必須<span class="paren">）</span></span
                  >
                </template>
              </v-text-field>
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
              <v-row density="compact">
                <v-col cols="12" sm="7">
                  <v-combobox
                    :model-value="form.requesterName"
                    :items="requesterNames"
                    hint="登録済みから選ぶか、新しい名前を入力"
                    persistent-hint
                    data-testid="requester"
                    @update:model-value="onRequesterChange"
                  >
                    <template #label>
                      依頼者<span class="required-mark"
                        ><span class="paren">（</span>必須<span class="paren">）</span></span
                      >
                    </template>
                  </v-combobox>
                </v-col>
                <v-col cols="12" sm="5">
                  <v-text-field
                    v-model="form.requesterExtension"
                    label="内線番号"
                    prepend-inner-icon="mdi-phone"
                  />
                </v-col>
              </v-row>
              <v-row density="compact">
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
              <v-row density="compact">
                <v-col cols="12" sm="6">
                  <v-text-field v-model="form.receivedOn" type="date" label="受付日" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="form.dueOn" type="date" data-testid="due-on">
                    <template #label>
                      期限日<span class="required-mark"
                        ><span class="paren">（</span>必須<span class="paren">）</span></span
                      >
                    </template>
                  </v-text-field>
                </v-col>
              </v-row>
              <v-checkbox v-model="form.qms" label="QMS チェック" hide-details density="compact" />
            </v-col>

            <!-- 右側：チェックリスト。「保存」を押したときに、まとめて保存される -->
            <v-col cols="12" md="5">
              <div class="d-flex align-center mb-2">
                <div class="text-subtitle-1 font-weight-bold">チェックリスト</div>
                <v-spacer />
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-playlist-plus"
                  :loading="templateLoading"
                  :disabled="form.categoryId === null"
                  data-testid="apply-template"
                  @click="applyTemplate"
                >
                  テンプレートを入れる
                </v-btn>
              </div>
              <div v-if="form.checklist.length === 0" class="text-medium-emphasis text-body-2 mb-2">
                項目がありません。テンプレートを入れるか、下から足してください。
              </div>
              <v-list density="compact" class="checklist pa-0" data-testid="checklist">
                <v-list-item v-for="(item, index) in form.checklist" :key="index" class="px-0">
                  <div class="d-flex align-center">
                    <v-checkbox
                      :model-value="item.done"
                      hide-details
                      density="compact"
                      @update:model-value="onToggleItem(index, $event)"
                    />
                    <span
                      :class="{ 'text-decoration-line-through text-medium-emphasis': item.done }"
                    >
                      {{ item.name }}
                    </span>
                    <v-spacer />
                    <v-btn
                      icon="mdi-close"
                      size="x-small"
                      variant="text"
                      color="grey"
                      aria-label="項目を消す"
                      @click="onRemoveItem(index)"
                    />
                  </div>
                </v-list-item>
              </v-list>
              <v-text-field
                v-model="newItemName"
                label="項目を足す"
                density="compact"
                hide-details
                append-inner-icon="mdi-plus"
                class="mt-2"
                data-testid="new-item"
                @keydown.enter="onEnter"
                @click:append-inner="onAddItem"
              />
              <div
                v-if="checklistMessage"
                class="text-caption text-medium-emphasis mt-2"
                data-testid="checklist-message"
              >
                {{ checklistMessage }}
              </div>
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
          <!-- 下の段（左）：アーカイブ・元に戻す・完全に削除。新しい依頼には、出さない -->
          <template v-if="detail">
            <v-btn
              v-if="!detail.archived"
              prepend-icon="mdi-archive-outline"
              :disabled="working || saving"
              data-testid="archive"
              @click="setArchived(true)"
            >
              アーカイブ
            </v-btn>
            <template v-else>
              <v-chip size="small" label class="mr-1">アーカイブ中</v-chip>
              <v-btn
                prepend-icon="mdi-archive-arrow-up-outline"
                :disabled="working || saving"
                data-testid="unarchive"
                @click="setArchived(false)"
              >
                元に戻す
              </v-btn>
              <v-btn
                color="error"
                prepend-icon="mdi-delete-outline"
                :disabled="working || saving"
                data-testid="delete"
                @click="confirmingDelete = true"
              >
                完全に削除
              </v-btn>
            </template>
          </template>
          <v-spacer />
          <span
            v-if="dirty"
            class="text-caption text-medium-emphasis mr-2"
            data-testid="dirty-note"
          >
            保存していない変更があります
          </span>
          <v-btn :color="dirty ? 'error' : undefined" data-testid="close" @click="emit('close')">
            {{ dirty ? '変更を捨てて閉じる' : '閉じる' }}
          </v-btn>
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

  <!-- 完全な削除の確認 -->
  <v-dialog v-model="confirmingDelete" max-width="420">
    <v-card title="完全に削除しますか？">
      <v-card-text>
        「{{ detail?.title }}」を完全に削除します。チェックリストも一緒に消えます。
        <strong>元に戻せません。</strong>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn data-testid="delete-cancel" @click="confirmingDelete = false">やめる</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="working"
          data-testid="delete-confirm"
          @click="doDelete"
        >
          削除する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* 入力欄の名前の「必須」：基調色（インディゴ）の小さな札にして、目立たせる。かっこは、札にするので隠す */
.required-mark {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 4px;
  padding: 0 5px;
  margin-left: 6px;
  font-size: 0.85em;
  font-weight: 600;
}
.required-mark .paren {
  display: none;
}
.checklist {
  max-height: 320px;
  overflow-y: auto;
}
</style>
