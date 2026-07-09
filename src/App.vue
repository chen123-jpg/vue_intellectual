<template>
  <div class="top-tab-nav">
    <div
        class="top-tab-btn"
        :class="{ active: activeTab === 'disclosure' }"
        @click="activeTab = 'disclosure'"
    >T表交底信息</div>
    <div
      class="top-tab-btn"
      :class="{ active: activeTab === 'patent' }"
      @click="activeTab = 'patent'"
    >P表管理</div>
  </div>
  <DisclosureTable v-if="activeTab === 'disclosure'" />
  <PatentTable v-if="activeTab === 'patent'" />
</template>

<script setup>
import { ref } from 'vue'
import PatentTable from './components/PatentTable.vue'
import DisclosureTable from './components/DisclosureTable.vue'

const activeTab = ref('patent')
</script>
