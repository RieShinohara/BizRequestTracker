<script setup lang="ts">
import { STATUS_COLOR } from '../display'
import { STATUSES, type Summary } from '../types'

defineProps<{ summary: Summary }>()
</script>

<template>
  <div class="d-flex align-center ga-2" data-testid="summary">
    <v-chip
      v-for="status in STATUSES"
      :key="status"
      :color="STATUS_COLOR[status]"
      size="small"
      variant="tonal"
    >
      {{ status }}
      <span class="font-weight-bold ml-1">{{ summary.status_counts[status] }}</span>
    </v-chip>
    <v-divider vertical class="mx-2" />
    <!-- 急ぎが1件以上のときは濃い赤、0件のときは淡い色 -->
    <v-chip
      color="red"
      size="small"
      label
      :variant="summary.urgent_count > 0 ? 'flat' : 'tonal'"
      prepend-icon="mdi-fire"
    >
      急ぎ
      <span class="font-weight-bold ml-1">{{ summary.urgent_count }}</span>
    </v-chip>
  </div>
</template>
