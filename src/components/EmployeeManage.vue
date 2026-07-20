<template>
  <div class="emp-page">
    <div class="header">
      <div>
        <div class="title">员工管理</div>
        <div class="sub">维护员工档案与类型（录入 / 主办 / 流程 / 联系人…可扩展）</div>
      </div>
      <div>
        <el-button type="primary" @click="openCreate">新建员工</el-button>
        <el-button @click="openTypeDialog">类型字典</el-button>
        <el-button @click="reload">刷新</el-button>
      </div>
    </div>

    <el-form :inline="true" class="filter" @submit.prevent>
      <el-form-item label="关键词">
        <el-input v-model="keyword" clearable placeholder="姓名/邮箱/工号" style="width: 180px" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="typeCode" clearable placeholder="全部" style="width: 140px">
          <el-option v-for="t in types" :key="t.typeCode" :label="t.typeName" :value="t.typeCode" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="status" clearable placeholder="全部" style="width: 120px">
          <el-option label="启用" value="ACTIVE" />
          <el-option label="停用" value="DISABLED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="reload">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" border stripe height="460">
      <el-table-column prop="empNo" label="工号" width="100" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="email" label="邮箱" min-width="160" />
      <el-table-column prop="department" label="部门" width="120" />
      <el-table-column prop="userId" label="账号ID" width="90" />
      <el-table-column label="类型" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="n in (row.typeNames || [])" :key="n" size="small" class="tag">{{ n }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="editVisible" :title="form.id ? '编辑员工' : '新建员工'" width="560px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="工号">
          <el-input v-model="form.empNo" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="form.department" />
        </el-form-item>
        <el-form-item label="账号ID">
          <el-input v-model.number="form.userId" placeholder="关联 user.id，可空" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="停用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" required>
          <el-checkbox-group v-model="form.typeCodes">
            <el-checkbox v-for="t in types" :key="t.typeCode" :value="t.typeCode" :label="t.typeCode">
              {{ t.typeName }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="typeVisible" title="员工类型字典" width="640px" destroy-on-close>
      <el-button type="primary" size="small" class="mb8" @click="openNewType">新增类型</el-button>
      <el-table :data="allTypes" size="small" border>
        <el-table-column prop="typeCode" label="编码" width="110" />
        <el-table-column prop="typeName" label="名称" width="120" />
        <el-table-column prop="description" label="说明" show-overflow-tooltip />
        <el-table-column prop="needLogin" label="需登录" width="80">
          <template #default="{ row }">{{ row.needLogin === 1 ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="70">
          <template #default="{ row }">{{ row.enabled === 1 ? '是' : '否' }}</template>
        </el-table-column>
      </el-table>
      <el-divider />
      <el-form v-if="typeFormVisible" :model="typeForm" label-width="90px">
        <el-form-item label="编码" required>
          <el-input v-model="typeForm.typeCode" :disabled="!!typeForm.id" placeholder="如 LAWYER" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="typeForm.typeName" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="typeForm.description" />
        </el-form-item>
        <el-form-item label="需登录">
          <el-switch v-model="typeForm.needLoginBool" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="submitType">保存类型</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listEmployeeTypes,
  listEmployees,
  saveEmployee,
  saveEmployeeType
} from '../api/employeeApi.js'

const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const types = ref([])
const allTypes = ref([])
const keyword = ref('')
const typeCode = ref('')
const status = ref('')

const editVisible = ref(false)
const form = reactive(emptyForm())

const typeVisible = ref(false)
const typeFormVisible = ref(false)
const typeForm = reactive({
  id: null,
  typeCode: '',
  typeName: '',
  description: '',
  needLoginBool: true
})

function emptyForm() {
  return {
    id: null,
    name: '',
    empNo: '',
    email: '',
    phone: '',
    department: '',
    userId: null,
    status: 'ACTIVE',
    typeCodes: [],
    remark: ''
  }
}

async function reload() {
  loading.value = true
  try {
    rows.value = await listEmployees({
      keyword: keyword.value || undefined,
      status: status.value || undefined,
      typeCode: typeCode.value || undefined
    })
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadTypes() {
  try {
    types.value = await listEmployeeTypes(true)
  } catch {
    types.value = []
  }
}

function openCreate() {
  Object.assign(form, emptyForm())
  form.typeCodes = ['ENTRY']
  editVisible.value = true
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    empNo: row.empNo,
    email: row.email,
    phone: row.phone,
    department: row.department,
    userId: row.userId,
    status: row.status || 'ACTIVE',
    typeCodes: [...(row.typeCodes || [])],
    remark: row.remark
  })
  editVisible.value = true
}

async function submit() {
  if (!form.name?.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  if (!form.typeCodes?.length) {
    ElMessage.warning('请选择至少一种类型')
    return
  }
  saving.value = true
  try {
    await saveEmployee({ ...form })
    ElMessage.success('已保存')
    editVisible.value = false
    await reload()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function openTypeDialog() {
  typeVisible.value = true
  typeFormVisible.value = false
  try {
    allTypes.value = await listEmployeeTypes(false)
  } catch (e) {
    ElMessage.error(e.message || '加载类型失败')
  }
}

function openNewType() {
  Object.assign(typeForm, {
    id: null,
    typeCode: '',
    typeName: '',
    description: '',
    needLoginBool: true
  })
  typeFormVisible.value = true
}

async function submitType() {
  if (!typeForm.typeCode?.trim() || !typeForm.typeName?.trim()) {
    ElMessage.warning('编码和名称必填')
    return
  }
  saving.value = true
  try {
    await saveEmployeeType({
      id: typeForm.id,
      typeCode: typeForm.typeCode.trim().toUpperCase(),
      typeName: typeForm.typeName.trim(),
      description: typeForm.description,
      needLogin: typeForm.needLoginBool ? 1 : 0,
      enabled: 1
    })
    ElMessage.success('类型已保存')
    typeFormVisible.value = false
    allTypes.value = await listEmployeeTypes(false)
    await loadTypes()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadTypes()
  await reload()
})
</script>

<style scoped>
.emp-page { padding: 4px 8px 24px; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.title { font-size: 20px; font-weight: 600; }
.sub { color: #909399; font-size: 13px; margin-top: 4px; }
.filter { margin-bottom: 8px; }
.tag { margin-right: 4px; }
.mb8 { margin-bottom: 8px; }
</style>
