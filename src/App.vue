<template>
  <Auth v-if="!isLoggedIn" @login-success="checkLogin" />
  <template v-else>
    <div class="top-tab-nav">
      <div class="top-tab-btn" :class="{ active: activeTab === 'disclosure' }"
           @click="activeTab = 'disclosure'">T表交底信息</div>
      <div class="top-tab-btn" :class="{ active: activeTab === 'patent' }"
           @click="activeTab = 'patent'">P表管理</div>
      <div class="top-tab-btn" :class="{ active: activeTab === 'mail' }"
           @click="activeTab = 'mail'">发送邮件</div>
      <el-button type="danger" style="margin-left: auto;" @click="logout">退出</el-button>
    </div>
    <DisclosureTable v-if="activeTab === 'disclosure'" />
    <PatentTable v-if="activeTab === 'patent'" />
    <SendMail v-if="activeTab === 'mail'" />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import Auth from './components/Auth.vue'
import PatentTable from './components/PatentTable.vue'
import DisclosureTable from './components/DisclosureTable.vue'
import SendMail from './components/SendMail.vue'

const isLoggedIn = ref(false)
const activeTab = ref('patent')

const checkLogin = async () => {
  try {
    await axios.get('/api/user/me')
    isLoggedIn.value = true
  } catch {
    isLoggedIn.value = false
  }
}

onMounted(() => checkLogin())

const logout = async () => {
  await axios.post('/api/user/logout')
  isLoggedIn.value = false
  activeTab.value = 'patent'
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
</style>s