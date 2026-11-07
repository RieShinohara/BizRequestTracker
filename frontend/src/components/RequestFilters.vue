<script setup lang="ts">
import { SORT_OPTIONS, hasActiveFilter } from '../display'
import { STATUSES, type Category, type RequestQuery } from '../types'

// 条件は、親（App.vue）が持つ。ここでは、入力を受けて、条件を書き換えるだけ
const query = defineModel<RequestQuery>({ required: true })
defineProps<{ categories: Category[] }>()

function update(patch: Partial<RequestQuery>) {
  query.value = { ...query.value, ...patch }
}

function clearAll() {
  update({ q: '', qms: false, categoryId: null, status: null })
}
</script>

<template>
  <div class="d-flex flex-wrap align-center ga-4">
    <v-text-field
      :model-value="query.q"
      label="検索（タイトル・詳細・依頼者・確認先）"
      prepend-inner-icon="mdi-magnify"
      clearable
      hide-details
      density="compact"
      variant="outlined"
      style="min-width: 280px; max-width: 360px"
      data-testid="search"
      @update:model-value="update({ q: $event ?? '' })"
    />
    <v-select
      :model-value="query.categoryId"
      :items="categories"
      item-title="name"
      item-value="id"
      label="カテゴリー"
      clearable
      hide-details
      density="compact"
      variant="outlined"
      style="min-width: 160px; max-width: 200px"
      @update:model-value="update({ categoryId: $event ?? null })"
    />
    <v-select
      :model-value="query.status"
      :items="[...STATUSES]"
      label="ステータス"
      clearable
      hide-details
      density="compact"
      variant="outlined"
      style="min-width: 150px; max-width: 190px"
      @update:model-value="update({ status: $event ?? null })"
    />
    <v-switch
      :model-value="query.qms"
      label="QMS のみ"
      hide-details
      density="compact"
      @update:model-value="update({ qms: !!$event })"
    />
    <v-btn
      v-if="hasActiveFilter(query)"
      variant="text"
      prepend-icon="mdi-filter-remove"
      data-testid="clear"
      @click="clearAll"
    >
      条件を外す
    </v-btn>
    <v-spacer />
    <!-- 並び替えは「見せ方」だけ。手動の並びは変わらない。選び直すか「手動の並び」で戻す -->
    <v-btn-toggle
      :model-value="query.sort"
      density="compact"
      variant="outlined"
      divided
      mandatory
      data-testid="sort"
      @update:model-value="update({ sort: $event })"
    >
      <v-btn v-for="option in SORT_OPTIONS" :key="String(option.value)" :value="option.value">
        {{ option.label }}
      </v-btn>
    </v-btn-toggle>
  </div>
</template>
