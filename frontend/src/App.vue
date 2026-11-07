<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { checkHealth } from './api'

// null＝確認中、true＝つながった、false＝つながらない
const apiConnected = ref<boolean | null>(null)

async function check() {
  apiConnected.value = null
  apiConnected.value = await checkHealth()
}

onMounted(check)
</script>

<template>
  <v-app>
    <v-app-bar color="primary" flat>
      <v-app-bar-title>業務依頼管理</v-app-bar-title>
    </v-app-bar>
    <v-main>
      <v-container>
        <v-card max-width="560" class="mx-auto mt-8" title="画面の骨組み（動作確認用）">
          <v-card-text>
            <p class="mb-4">画面から API（バックエンド）につながるかを、確かめています。</p>
            <v-chip v-if="apiConnected === null" prepend-icon="mdi-loading mdi-spin">
              確認中…
            </v-chip>
            <v-chip
              v-else-if="apiConnected"
              color="success"
              prepend-icon="mdi-check-circle"
              data-testid="api-status"
            >
              API につながっています
            </v-chip>
            <v-chip v-else color="error" prepend-icon="mdi-alert-circle" data-testid="api-status">
              API につながりません（API を起動していますか？）
            </v-chip>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" @click="check">もう一度確認</v-btn>
          </v-card-actions>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>
