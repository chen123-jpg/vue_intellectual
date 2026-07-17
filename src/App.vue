<template>
  <Auth v-if="!isLoggedIn" @login-success="checkLogin" />
  <template v-else>
    <div class="top-tab-nav">
      <div
        class="top-tab-btn"
        :class="{ active: activeTab === 'workflow' }"
        @click="activeTab = 'workflow'"
      >交底处理</div>
      <div
        class="top-tab-btn"
        :class="{ active: activeTab === 'disclosure' }"
        @click="activeTab = 'disclosure'"
      >T表(旧)</div>
      <div
        class="top-tab-btn"
        :class="{ active: activeTab === 'patent' }"
        @click="activeTab = 'patent'"
      >P表管理</div>
      <el-button type="danger" style="margin-left: auto;" @click="logout">退出</el-button>
    </div>
    <DisclosureWorkflow v-if="activeTab === 'workflow'" />
    <DisclosureTable v-if="activeTab === 'disclosure'" />
    <PatentTable v-if="activeTab === 'patent'" />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { http } from './api/http.js'
import Auth from './components/Auth.vue'
import PatentTable from './components/PatentTable.vue'
import DisclosureTable from './components/DisclosureTable.vue'
import DisclosureWorkflow from './components/DisclosureWorkflow.vue'

const isLoggedIn = ref(false)
const activeTab = ref('workflow')

const checkLogin = async () => {
  try {
    await http.get('/api/user/me')
    isLoggedIn.value = true
  } catch {
    isLoggedIn.value = false
  }
}

onMounted(() => checkLogin())

const logout = async () => {
  try {
    await http.post('/api/user/logout')
  } catch {
    // ignore
  }
  isLoggedIn.value = false
  activeTab.value = 'workflow'
}
</script>

<style scoped>
.top-tab-nav {
  display: flex;
  align-items: center;
  border-bottom: 2px solid #e4e7ed;
  margin-bottom: 20px;
}
.top-tab-btn {
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: 0.3s;
}
.top-tab-btn.active {
  color: #409eff;
  border-bottom-color: #409eff;
}
.top-tab-btn:hover {
  color: #409eff;
}
</style>
