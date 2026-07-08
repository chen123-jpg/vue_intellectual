<template>
  <div class="app-header">
    <div class="title">T表管理 - 专利交底信息</div>
    <div class="stats">
      <span class="stat-item">共 {{ totalCount }} 条</span>
    </div>
  </div>

  <div class="toolbar">
    <div class="search-box">
      <input class="search-input" placeholder="搜索所有字段..." v-model="searchKeyword" />
      <span class="clear-btn" @click="clearSearch">清空</span>
    </div>
    <div class="actions">
      <button class="btn primary" @click="openAddModal">新增</button>
      <button class="btn outline" @click="refreshData">刷新</button>
    </div>
  </div>

  <div class="table-wrapper">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="col-actions">操作</th>
            <th v-for="field in allFields" :key="field.key">{{ field.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredRows.length === 0">
            <td :colspan="allFields.length + 1" class="empty-row">
              {{ searchKeyword ? '没有找到匹配的记录' : '暂无数据，点击 "新增" 添加' }}
            </td>
          </tr>
          <tr v-for="row in filteredRows" :key="row.id">
            <td class="col-actions">
              <button class="btn warning sm" @click="openEditModal(row)">编辑</button>
              <button class="btn danger sm" @click="deleteRecord(row)">删除</button>
            </td>
            <td v-for="field in allFields" :key="field.key">
              <div
                class="cell-text"
                @mouseenter="handleCellEnter($event, formatValue(row[field.key], field.type))"
                @mouseleave="handleCellLeave"
              >
                {{ field.type === 'bool' ? (row[field.key] ? '是' : '否') : formatValue(row[field.key], field.type) }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Cell tooltip -->
  <div
    v-if="tooltip.show"
    class="text-tooltip"
    :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    @mouseenter="tooltipHover = true"
    @mouseleave="tooltipHover = false"
  >
    {{ tooltip.text }}
  </div>

  <!-- Add/Edit modal -->
  <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <span class="modal-title">{{ modalTitle }}</span>
        <span class="modal-close" @click="closeModal">&times;</span>
      </div>
      <div class="modal-body">
        <div v-for="field in formFields" :key="field.key" class="form-group">
          <label class="form-label">{{ field.label }}</label>
          <template v-if="field.type === 'bool'">
            <div class="form-checkbox">
              <input type="checkbox" v-model="editForm[field.key]" :id="'chk_' + field.key" />
              <label :for="'chk_' + field.key">{{ editForm[field.key] ? '是' : '否' }}</label>
            </div>
          </template>
          <template v-else-if="field.type === 'date'">
            <input class="form-input" type="date" v-model="editForm[field.key]" />
          </template>
          <template v-else>
            <input class="form-input" v-model="editForm[field.key]" :placeholder="field.label" />
          </template>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn outline" @click="closeModal">取消</button>
        <button class="btn primary" @click="saveRecord">保存</button>
      </div>
    </div>
  </div>

  <div class="toast" :class="[toastType, { show: toastMessage }]">
    {{ toastMessage }}
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  fetchAllDisclosures, createDisclosure, updateDisclosure, deleteDisclosure
} from '../api/disclosureApi.js'

const DISCLOSURE_FIELDS = [
  { key: 'tempNo',           label: '临时编号' },
  { key: 'internalNo',       label: '内部编号' },
  { key: 'patentStatus',     label: '专利状态' },
  { key: 'requirement',      label: '要求' },
  { key: 'disclosureName',   label: '专利交底名称' },
  { key: 'applicant',        label: '申请人' },
  { key: 'invitedToGroup',   label: '是否邀请进群', type: 'bool' },
  { key: 'contactPerson',    label: '联系人' },
  { key: 'manager',          label: '管理人' },
  { key: 'agent',            label: '代理人' },
  { key: 'disclosureDate',   label: '交底日', type: 'date' },
  { key: 'disclosureDays',   label: '交底天数' },
  { key: 'remark',           label: '备注' },
  { key: 'contactInfo',      label: '联系人信息' },
  { key: 'id',               label: 'ID', readonly: true },
  { key: 'createTime',       label: '创建时间', readonly: true },
  { key: 'updateTime',       label: '更新时间', readonly: true }
]

const allFields = DISCLOSURE_FIELDS
const formFields = DISCLOSURE_FIELDS.filter(f => !f.readonly)

const searchKeyword = ref('')
const rows = ref([])
const modalVisible = ref(false)
const modalMode = ref('add')
const editForm = ref({})
const editId = ref(null)
const toastMessage = ref('')
const toastType = ref('info')
const toastTimer = ref(null)
const tooltip = reactive({ show: false, x: 0, y: 0, text: '' })
const tooltipHover = ref(false)
const hideTimer = ref(null)

const filteredRows = computed(() => {
  if (!searchKeyword.value.trim()) return rows.value
  const kw = searchKeyword.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    for (const f of allFields) {
      if (String(row[f.key] || '').toLowerCase().includes(kw)) return true
    }
    return false
  })
})

const totalCount = computed(() => rows.value.length)

const modalTitle = computed(() => {
  return modalMode.value === 'add' ? '新增交底记录' : '编辑交底记录'
})

function formatValue(value, type) {
  if (value === undefined || value === null) return ''
  if (type === 'bool') return value ? '是' : '否'
  if (type === 'date' && typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0]
  }
  return String(value)
}

function showToast(message, type = 'info') {
  toastMessage.value = message
  toastType.value = type
  if (toastTimer.value) clearTimeout(toastTimer.value)
  toastTimer.value = setTimeout(() => {
    toastMessage.value = ''
    toastType.value = 'info'
  }, 3000)
}

async function loadData() {
  try {
    rows.value = await fetchAllDisclosures()
  } catch (e) {
    showToast('加载数据失败: ' + e.message, 'error')
  }
}

function clearSearch() { searchKeyword.value = '' }

async function refreshData() {
  await loadData()
  showToast('数据已刷新', 'success')
}

function openAddModal() {
  modalMode.value = 'add'
  editId.value = null
  const form = {}
  for (const f of formFields) {
    form[f.key] = f.type === 'bool' ? false : ''
  }
  editForm.value = form
  modalVisible.value = true
}

function openEditModal(row) {
  modalMode.value = 'edit'
  editId.value = row.id
  const form = {}
  for (const f of formFields) {
    const val = row[f.key]
    if (f.type === 'bool') {
      form[f.key] = !!val
    } else if (f.type === 'date' && typeof val === 'string' && val.includes('T')) {
      form[f.key] = val.split('T')[0]
    } else {
      form[f.key] = val !== undefined && val !== null ? val : ''
    }
  }
  editForm.value = form
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  editForm.value = {}
  editId.value = null
}

async function saveRecord() {
  const data = { ...editForm.value }
  for (const f of formFields) {
    if (f.type === 'date') {
      if (data[f.key] === '' || data[f.key] === null) { data[f.key] = null }
      else if (!/ \d{2}:\d{2}:\d{2}$/.test(data[f.key])) { data[f.key] = data[f.key] + ' 00:00:00' }
    }
  }
  try {
    if (modalMode.value === 'add') {
      await createDisclosure(data)
    } else {
      data.id = editId.value
      await updateDisclosure(data)
    }
    showToast(modalMode.value === 'add' ? '新增成功' : '更新成功', 'success')
    closeModal()
    await loadData()
  } catch (e) {
    showToast('请求失败: ' + e.message, 'error')
  }
}

function deleteRecord(row) {
  const name = row.disclosureName || row.internalNo || '未命名'
  if (!confirm(`确定要删除 "${name}" 吗？此操作不可恢复！`)) return
  deleteDisclosure(row.id)
    .then(async () => {
      showToast('已删除', 'success')
      await loadData()
    })
    .catch((e) => {
      showToast('请求失败: ' + e.message, 'error')
    })
}

function handleCellEnter(event, text) {
  const el = event.currentTarget
  if (el.scrollWidth <= el.clientWidth) return
  clearTimeout(hideTimer.value)
  const rect = el.getBoundingClientRect()
  tooltip.text = text
  tooltip.x = rect.left + 10
  tooltip.y = rect.bottom + window.scrollY + 8
  tooltip.show = true
}

function handleCellLeave() {
  clearTimeout(hideTimer.value)
  hideTimer.value = setTimeout(() => {
    if (!tooltipHover.value) tooltip.show = false
  }, 300)
}

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.cell-text {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: default;
}
.text-tooltip {
  position: fixed;
  z-index: 9999;
  max-width: 450px;
  padding: 10px 14px;
  background: #1a2332;
  color: #fff;
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.22);
  user-select: text;
  word-break: break-all;
  line-height: 1.5;
  font-size: 13px;
}
</style>
