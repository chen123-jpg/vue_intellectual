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
        v-if="showEmployeeTab"
        class="top-tab-btn"
        :class="{ active: activeTab === 'employee' }"
        @click="activeTab = 'employee'"
      >员工管理</div>
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
      <div class="top-right">
        <span v-if="currentUserLabel" class="user-label">
          {{ currentUserLabel }}
          <el-tag
            v-for="n in roleNames"
            :key="n"
            size="small"
            type="info"
            class="role-tag"
          >{{ n }}</el-tag>
        </span>
        <el-button type="danger" @click="logout">退出</el-button>
      </div>
    </div>
    <DisclosureWorkflow v-if="activeTab === 'workflow'" />
    <EmployeeManage v-if="activeTab === 'employee'" />
    <DisclosureTable v-if="activeTab === 'disclosure'" />
    <PatentTable v-if="activeTab === 'patent'" />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { http, getToken, clearToken, unwrap } from './api/http.js'
import {
  setCurrentUser,
  clearCurrentUser,
  canManageEmployees,
  getCurrentUser
} from './api/userSession.js'
import Auth from './components/Auth.vue'
import PatentTable from './components/PatentTable.vue'
import DisclosureTable from './components/DisclosureTable.vue'
import DisclosureWorkflow from './components/DisclosureWorkflow.vue'
import EmployeeManage from './components/EmployeeManage.vue'

const isLoggedIn = ref(false)
const activeTab = ref('workflow')
const currentUserLabel = ref('')
const roleNames = ref([])
const showEmployeeTab = ref(false)

const applyUserUi = (me) => {
  setCurrentUser(me)
  currentUserLabel.value = me?.employeeName || me?.nickName || me?.email || ''
  roleNames.value = me?.roleNames?.length
    ? me.roleNames
    : (me?.roles || [])
  showEmployeeTab.value = canManageEmployees()
}

const checkLogin = async () => {
  if (!getToken()) {
    clearCurrentUser()
    isLoggedIn.value = false
    currentUserLabel.value = ''
    roleNames.value = []
    showEmployeeTab.value = false
    return
  }
  try {
    const me = unwrap(await http.get('/api/account/me'))
    applyUserUi(me)
    isLoggedIn.value = true
  } catch {
    clearToken()
    clearCurrentUser()
    isLoggedIn.value = false
    currentUserLabel.value = ''
    roleNames.value = []
    showEmployeeTab.value = false
  }
}

onMounted(() => checkLogin())

const logout = () => {
  clearToken()
  clearCurrentUser()
  isLoggedIn.value = false
  currentUserLabel.value = ''
  roleNames.value = []
  showEmployeeTab.value = false
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
.top-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-label {
  color: #606266;
  font-size: 13px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.role-tag {
  margin-left: 2px;
}
</style>
