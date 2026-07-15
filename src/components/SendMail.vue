<template>
  <div class="mail-form">
    <el-form :model="form" label-width="80px">
      <el-form-item label="收件人">
        <el-input v-model="form.to" placeholder="多个收件人用逗号分隔" />
      </el-form-item>
      <el-form-item label="主题">
        <el-input v-model="form.subject" placeholder="请输入邮件主题" />
      </el-form-item>
      <el-form-item label="正文">
        <el-input
          type="textarea"
          :rows="6"
          v-model="form.text"
          placeholder="请输入邮件内容"
        />
      </el-form-item>
      <el-form-item label="附件">
        <el-upload
          v-model:file-list="fileList"
          :auto-upload="false"
          multiple
          :limit="5"
          :on-exceed="handleExceed"
        >
          <el-button type="primary">选择文件</el-button>
          <template #tip>
            <div class="el-upload__tip">支持多个文件，单文件不超过10MB</div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item>
        <el-button type="success" @click="submitForm" :loading="sending">发送</el-button>
        <el-button @click="resetForm">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const form = reactive({
  to: '',
  subject: '',
  text: ''
})
const fileList = ref([])
const sending = ref(false)

const handleExceed = () => {
  ElMessage.warning('最多只能选择5个文件')
}

const submitForm = async () => {
  if (!form.to.trim()) {
    ElMessage.warning('请填写收件人')
    return
  }
  const formData = new FormData()
  formData.append('to', form.to)
  formData.append('subject', form.subject)
  formData.append('text', form.text)

  fileList.value.forEach(file => {
    formData.append('attachments', file.raw || file)
  })

  sending.value = true
  try {
    const res = await axios.post('/api/mail/send', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success(res.data.message || '发送成功')
    resetForm()
  } catch (err) {
    const msg = err.response?.data?.error || '请求失败'
    ElMessage.error(msg)
  } finally {
    sending.value = false
  }
}

const resetForm = () => {
  form.to = ''
  form.subject = ''
  form.text = ''
  fileList.value = []
}
</script>

<style scoped>
.mail-form {
  max-width: 700px;
  margin: 40px auto;
}
</style>