<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchConfirmTargets } from '../api'

// open＝開いているか、initial＝入力欄の最初の文字（すでに確認先があれば、それ）
// changingOnly＝すでに確認待ちで、確認先だけを変えるとき（題名とボタンの文字が変わる）
const props = defineProps<{ open: boolean; initial: string | null; changingOnly: boolean }>()
const emit = defineEmits<{ submit: [confirmTo: string]; cancel: [] }>()

const text = ref('')
const suggestions = ref<string[]>([])

// 開くたびに、候補を取り直す（過去に入力した確認先が、増えているかもしれないため）
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    text.value = props.initial ?? ''
    try {
      suggestions.value = await fetchConfirmTargets()
    } catch {
      // 候補が取れなくても、自由に入力できる
      suggestions.value = []
    }
  },
)
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="420"
    @update:model-value="(value: boolean) => !value && emit('cancel')"
  >
    <v-card :title="changingOnly ? '確認先を変更' : '確認先を入力'">
      <v-card-text>
        <v-combobox
          v-model="text"
          :items="suggestions"
          label="確認先（空でもかまいません）"
          autofocus
          data-testid="confirm-to"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('cancel')">やめる</v-btn>
        <v-btn color="primary" variant="flat" @click="emit('submit', text ?? '')">
          {{ changingOnly ? '変更する' : '確認待ちにする' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
