<template>
  <div class="auth-container">
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="登录" name="login">
        <el-form :model="loginForm" label-width="80px">
          <el-form-item label="邮箱">
            <el-input v-model="loginForm.email" placeholder="请输入邮箱" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleLogin" :loading="loading">登录</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="注册" name="register">
        <el-form :model="regForm" label-width="100px">
          <el-form-item label="邮箱">
            <el-input v-model="regForm.email" placeholder="邮箱（登录账号）" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="regForm.password" type="password" placeholder="密码" show-password />
          </el-form-item>
          <el-form-item label="授权码">
            <el-input v-model="regForm.authCode" placeholder="邮箱SMTP授权码" />
          </el-form-item>
          <el-collapse style="width: 100%">
            <el-collapse-item title="高级设置（企业邮箱等）" name="1">
              <el-form-item label="SMTP服务器">
                <el-input v-model="regForm.smtpHost" placeholder="例如 smtp.example.com（可选）" />
              </el-form-item>
              <el-form-item label="端口">
                <el-input-number v-model="regForm.smtpPort" :min="1" :max="65535" />
              </el-form-item>
            </el-collapse-item>
          </el-collapse>
          <el-form-item style="margin-top: 15px">
            <el-button type="success" @click="handleRegister" :loading="loading">注册</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { API_BASE } from '../api/http.js'
import axios from 'axios'

const emit = defineEmits(['login-success'])

const activeTab = ref('login')
const loading = ref(false)

const loginForm = reactive({
  email: '',
  password: ''
})

const regForm = reactive({
  email: '',
  password: '',
  authCode: '',
  smtpHost: '',
  smtpPort: null
})

// 登录/注册走后端同源 Cookie（与业务 API 同域 localhost:8080）
const authHttp = axios.create({
  baseURL: API_BASE,
  withCredentials: true
})

const handleLogin = async () => {
  if (!loginForm.email || !loginForm.password) {
    ElMessage.warning('请填写完整信息')
    return
  }
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.append('email', loginForm.email)
    params.append('password', loginForm.password)
    await authHttp.post('/api/user/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    ElMessage.success('登录成功')
    emit('login-success')
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '登录失败')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!regForm.email || !regForm.password || !regForm.authCode) {
    ElMessage.warning('请填写邮箱、密码和授权码')
    return
  }
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.append('email', regForm.email)
    params.append('password', regForm.password)
    params.append('authCode', regForm.authCode)
    if (regForm.smtpHost) params.append('smtpHost', regForm.smtpHost)
    if (regForm.smtpPort) params.append('smtpPort', regForm.smtpPort)
    await authHttp.post('/api/user/register', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    ElMessage.success('注册成功，请登录')
    activeTab.value = 'login'
    Object.assign(regForm, { email: '', password: '', authCode: '', smtpHost: '', smtpPort: null })
  } catch (err) {
    ElMessage.error(err.response?.data?.error || err.response?.data?.message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  max-width: 500px;
  margin: 40px auto;
}
</style>
