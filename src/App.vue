<template>
  <div class="top-tab-nav">
    <div
      class="top-tab-btn"
      :class="{ active: activeTab === 'patent' }"
      @click="activeTab = 'patent'"
    >P表管理</div>
    <div
      class="top-tab-btn"
      :class="{ active: activeTab === 'disclosure' }"
      @click="activeTab = 'disclosure'"
    >T表交底信息</div>
  </div>
  <PatentTable v-if="activeTab === 'patent'" />
  <DisclosureTable v-if="activeTab === 'disclosure'" />
</template>

<script>
import PatentTable from './components/PatentTable.vue'
import DisclosureTable from './components/DisclosureTable.vue'

export default {
  name: 'App',
  components: { PatentTable, DisclosureTable },
  data() {
    return {
      activeTab: 'patent'
    }
  }
}
</script>
