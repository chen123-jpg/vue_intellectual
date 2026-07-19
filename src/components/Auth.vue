<template>
  <div class="auth-container">
    <el-tabs v-model="activeTab" type="border-card" @tab-change="onTabChange">
      <el-tab-pane label="登录" name="login">
        <el-form :model="loginForm" label-width="80px">
          <el-form-item label="邮箱">
            <el-input v-model="loginForm.email" placeholder="请输入邮箱" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" show-password />
          </el-form-item>
          <el-form-item label="验证码">
            <div class="captcha-row">
              <el-input v-model="loginForm.checkCode" placeholder="请输入验证码" style="width: 180px" />
              <img
                v-if="checkCodeImage"
                :src="checkCodeImage"
                class="captcha-img"
                title="点击刷新"
                @click="fetchCheckCode"
              />
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleLogin" :loading="loading">登录</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane label="注册" name="register">
        <el-form :model="regForm" label-width="80px">
          <el-form-item label="昵称">
            <el-input v-model="regForm.nickName" placeholder="请输入昵称" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="regForm.email" placeholder="邮箱（登录账号）" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="regForm.password" type="password" placeholder="密码" show-password />
          </el-form-item>
          <el-form-item label="授权码">
            <el-input v-model="regForm.authCode" placeholder="邮箱SMTP授权码" />
          </el-form-item>
          <el-form-item label="员工类型" required>
            <el-checkbox-group v-model="regForm.roleCodes">
              <el-checkbox
                v-for="t in registerTypes"
                :key="t.typeCode"
                :value="t.typeCode"
                :label="t.typeCode"
              >{{ t.typeName }}</el-checkbox>
            </el-checkbox-group>
            <div class="hint">可多选；默认建议选「录入人员」。管理员请注册后由已有管理员改类型。</div>
          </el-form-item>
          <el-form-item label="验证码">
            <div class="captcha-row">
              <el-input v-model="regForm.checkCode" placeholder="请输入验证码" style="width: 180px" />
              <img
                v-if="checkCodeImage"
                :src="checkCodeImage"
                class="captcha-img"
                title="点击刷新"
                @click="fetchCheckCode"
              />
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="success" @click="handleRegister" :loading="loading">注册</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { http, unwrap, setToken } from '../api/http.js'
import { setCurrentUser } from '../api/userSession.js'
import { listEmployeeTypes } from '../api/employeeApi.js'

const emit = defineEmits(['login-success'])

const activeTab = ref('login')
const loading = ref(false)
const checkCodeKey = ref('')
const checkCodeImage = ref('')
const registerTypes = ref([])

const loginForm = reactive({
  email: '',
  password: '',
  checkCode: ''
})

const regForm = reactive({
  nickName: '',
  email: '',
  password: '',
  authCode: '',
  checkCode: '',
  roleCodes: ['ENTRY']
})

async function fetchCheckCode() {
  try {
    const params = {}
    if (checkCodeKey.value) params.oldCheckCodeKey = checkCodeKey.value
    const data = await unwrap(await http.get('/api/account/checkCode', { params }))
    checkCodeImage.value = data.checkCode
    checkCodeKey.value = data.checkCodeKey
  } catch (err) {
    ElMessage.error('获取验证码失败')
  }
}

async function loadRegisterTypes() {
  try {
    // 注册页不带 token；过滤掉 ADMIN 避免自助注册管理员
    const all = await listEmployeeTypes(true)
    registerTypes.value = (all || []).filter((t) => t.typeCode !== 'ADMIN' && t.typeCode !== 'CONTACT')
    if (!registerTypes.value.length) {
      registerTypes.value = [
        { typeCode: 'ENTRY', typeName: '录入人员' },
        { typeCode: 'SPONSOR', typeName: '主办人' },
        { typeCode: 'PROCESS', typeName: '流程人员' }
      ]
    }
  } catch {
    registerTypes.value = [
      { typeCode: 'ENTRY', typeName: '录入人员' },
      { typeCode: 'SPONSOR', typeName: '主办人' },
      { typeCode: 'PROCESS', typeName: '流程人员' }
    ]
  }
}

onMounted(async () => {
  await fetchCheckCode()
  await loadRegisterTypes()
})

function onTabChange() {
  fetchCheckCode()
}

const handleLogin = async () => {
  if (!loginForm.email || !loginForm.password || !loginForm.checkCode) {
    ElMessage.warning('请填写完整信息')
    return
  }
  loading.value = true
  try {
    const data = await unwrap(await http.post('/api/account/login', {
      checkCodeKey: checkCodeKey.value,
      checkCode: loginForm.checkCode,
      email: loginForm.email,
      password: loginForm.password
    }))
    setToken(data.token)
    setCurrentUser(data)
    ElMessage.success('登录成功')
    emit('login-success')
  } catch (err) {
    ElMessage.error(err.message || '登录失败')
    fetchCheckCode()
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!regForm.nickName || !regForm.email || !regForm.password || !regForm.authCode || !regForm.checkCode) {
    ElMessage.warning('请填写完整信息')
    return
  }
  if (!regForm.roleCodes?.length) {
    ElMessage.warning('请选择员工类型')
    return
  }
  loading.value = true
  try {
    await unwrap(await http.post('/api/account/register', {
      checkCodeKey: checkCodeKey.value,
      checkCode: regForm.checkCode,
      email: regForm.email,
      password: regForm.password,
      nickName: regForm.nickName,
      authCode: regForm.authCode,
      roleCodes: regForm.roleCodes
    }))
    ElMessage.success('注册成功，请登录')
    activeTab.value = 'login'
    Object.assign(regForm, {
      nickName: '',
      email: '',
      password: '',
      authCode: '',
      checkCode: '',
      roleCodes: ['ENTRY']
    })
    fetchCheckCode()
  } catch (err) {
    ElMessage.error(err.message || '注册失败')
    fetchCheckCode()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  max-width: 560px;
  margin: 40px auto;
}
.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.captcha-img {
  height: 38px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
  margin-top: 4px;
}
</style>
