<template>
  <div class="app-header">
    <div class="title">P表管理</div>
    <div class="stats">
      <span class="stat-item">共 {{ totalCount }} 条</span>
      <span class="stat-item">{{ sheetNames.length }} 个分类</span>
    </div>
  </div>

  <div class="tab-nav">
    <div
        v-for="name in sheetNames"
        :key="name"
        class="tab-btn"
        :class="{ active: currentSheet === name }"
        @click="switchSheet(name)"
    >
      {{ name }}
      <span class="badge">{{ getRowCount(name) }}</span>
    </div>
  </div>

  <div class="toolbar">
    <div class="search-box">
      <input class="search-input" placeholder="搜索所有字段..." v-model="searchKeyword" />
      <span class="clear-btn" @click="clearSearch">清空</span>
    </div>
    <div class="actions">
      <button class="btn primary" @click="openAddModal">新增</button>
      <button class="btn outline" @click="openCustomFieldForm">添加字段</button>
      <button class="btn outline" @click="refreshData">刷新</button>
    </div>
  </div>

  <div class="table-wrapper">
    <div class="table-scroll">
      <table>
        <thead>
        <tr>
          <th class="col-actions">操作</th>
          <th v-for="field in currentFields" :key="field.key">
            {{ field.label }}
            <span
                v-if="isCustomField(field.key)"
                class="remove-field-btn"
                @click="removeCustomField(field.key)"
            >&times;</span>
          </th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="filteredRows.length === 0">
          <td :colspan="currentFields.length + 1" class="empty-row">
            {{ searchKeyword ? '没有找到匹配的记录' : '暂无数据，点击 "新增" 添加' }}
          </td>
        </tr>
        <tr v-for="row in filteredRows" :key="row.id">
          <td class="col-actions">
            <button class="btn warning sm" @click="openEditModal(row)">编辑</button>
            <button class="btn danger sm" @click="deleteRecord(row)">删除</button>
          </td>
          <td v-for="field in currentFields" :key="field.key">
            <!-- ★★★ 通知字段且为文件路径 → 显示原始文件名链接 ★★★ -->
            <div v-if="field.key === 'notification' && isFilePath(row[field.key])" class="cell-text">
              <a :href="fileViewUrl(row[field.key])" target="_blank" class="file-link">
                {{ getFileNameFromUrl(row[field.key]) || '查看文件' }}
              </a>
            </div>
            <!-- 其他普通字段 -->
            <div v-else class="cell-text"
                 @mouseenter="handleCellEnter($event, formatValue(row[field.key], field.type))"
                 @mouseleave="handleCellLeave">
              {{ formatValue(row[field.key], field.type) }}
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
        <div v-for="field in currentFields" :key="field.key" class="form-group">
          <label class="form-label">{{ field.label }}</label>

          <!-- internalNo field with T表 autocomplete (add mode only) -->
          <template v-if="field.key === 'internalNo' && modalMode === 'add'">
            <div class="autocomplete-wrapper">
              <input
                  class="form-input"
                  v-model="editForm.internalNo"
                  placeholder="输入内部编号，匹配T表记录..."
                  @input="onInternalNoInput"
                  @focus="onInternalNoFocus"
                  @blur="onInternalNoBlur"
                  @keydown.esc="autoCompleteVisible = false"
                  autocomplete="off"
              />
              <div v-if="autoCompleteVisible && autoCompleteItems.length > 0" class="autocomplete-dropdown">
                <div
                    v-for="item in autoCompleteItems"
                    :key="item.id"
                    class="autocomplete-item"
                    @mousedown.prevent="onAutocompleteSelect(item)"
                >
                  <span class="ac-no">{{ item.internalNo }}</span>
                  <span class="ac-name">{{ item.disclosureName }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- notification file input -->
          <template v-else-if="field.key === 'notification'">
            <div class="file-input-row">
              <input
                  class="form-input"
                  v-model="notificationDisplay"
                  :placeholder="field.label + '（输入文本或上传文件）'"
              />
              <label class="file-upload-btn">
                <input
                    type="file"
                    accept=".doc,.docx,.xml,.pdf,.txt,.jpg,.jpeg,.png"
                    @change="onNotificationFileChange"
                    :disabled="notificationUploading"
                    style="display:none"
                />
                <span class="btn sm outline" :class="{ disabled: notificationUploading }">
                  {{ notificationUploading ? '上传中...' : '选择文件' }}
                </span>
              </label>
            </div>
            <div v-if="notificationFileName" class="file-name-tip">
              已上传：{{ notificationFileName }}
            </div>
          </template>

          <!-- normal text input -->
          <input
              v-else-if="field.type !== 'date'"
              class="form-input"
              v-model="editForm[field.key]"
              :placeholder="field.label"
          />
          <!-- date input -->
          <input
              v-else
              class="form-input"
              type="date"
              v-model="editForm[field.key]"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn outline" @click="closeModal">取消</button>
        <button class="btn primary" @click="saveRecord">保存</button>
      </div>
    </div>
  </div>

  <!-- Custom field modal -->
  <div v-if="showCustomFieldForm" class="modal-overlay" @click.self="closeCustomFieldForm">
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <span class="modal-title">添加自定义字段 - {{ currentSheet }}</span>
        <span class="modal-close" @click="closeCustomFieldForm">&times;</span>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">字段名称（中文显示名）</label>
          <input class="form-input" v-model="customFieldLabel" placeholder="如：优先级" />
        </div>
        <div class="form-group">
          <label class="form-label">字段键名（英文标识）</label>
          <input class="form-input" v-model="customFieldKey" placeholder="如：custom_priority" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn outline" @click="closeCustomFieldForm">取消</button>
        <button class="btn primary" @click="addCustomField">确认添加</button>
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
  fetchSheetList, fetchAllSheets, createRecord,
  updateRecord, deleteRecord as apiDeleteRecord,
  uploadFile, API_BASE,getFileNameFromUrl
} from '../api/patentApi.js'
import { fetchAllDisclosures } from '../api/disclosureApi.js'

const SHEET_CONFIGS = {
  '1-专利新申请': [
    { key: 'internalNo',      label: '内部编号' },
    { key: 'patentName',      label: '发明创造名称' },
    { key: 'applicationNo',   label: '申请号/专利号' },
    { key: 'applicant',       label: '申请人' },
    { key: 'inventor',        label: '发明人' },
    { key: 'sponsor',         label: '主办人' },
    { key: 'agent',           label: '委托书代理人' },
    { key: 'applicationDate', label: '申请日', type: 'date' },
    { key: 'notification',    label: '通知书' },
    { key: 'issueDate',       label: '发文日', type: 'date' },
    { key: 'preExamMark',     label: '非正标-预审标' },
    { key: 'paymentDeadline', label: '缴费止期', type: 'date' },
    { key: 'feeAmount',       label: '费用金额' },
    { key: 'paymentDate',     label: '缴费时间' },
    { key: 'seqNo',           label: '序号' },
    { key: 'patentType',      label: '类型' },
    { key: 'dasCode',         label: 'DAS码' }
  ],
  '1.2-补漏专利': [
    { key: 'seqNo',            label: '序号' },
    { key: 'applicationNo',    label: '申请号/专利号' },
    { key: 'patentName',       label: '发明创造名称' },
    { key: 'applicant',        label: '申请人' },
    { key: 'inventor',         label: '发明人' },
    { key: 'sponsor',          label: '主办人' },
    { key: 'agent',            label: '委托书代理人' },
    { key: 'applicationDate',  label: '申请日', type: 'date' },
    { key: 'notification',     label: '通知书' },
    { key: 'issueDate',        label: '发文日', type: 'date' },
    { key: 'feeReduction',     label: '费减' },
    { key: 'remark',           label: '备注' }
  ],
  '2-中间著变专利（有重复）': [
    { key: 'seqNo',            label: '序号' },
    { key: 'internalNo',       label: '内部编号' },
    { key: 'businessType',     label: '业务类型' },
    { key: 'applicationNo',    label: '申请号' },
    { key: 'patentName',       label: '发明创造名称' },
    { key: 'applicant',        label: '申请人' },
    { key: 'inventor',         label: '发明人' },
    { key: 'sponsor',          label: '主办人' },
    { key: 'agent',            label: '委托书代理人' },
    { key: 'applicationDate',  label: '申请日', type: 'date' },
    { key: 'status',           label: '状态' },
    { key: 'issueDate',        label: '发文日', type: 'date' },
    { key: 'feeReductionInfo', label: '非正标-费减情况' },
    { key: 'submitDate',       label: '提交日期', type: 'date' },
    { key: 'paymentDeadline',  label: '缴费止期', type: 'date' },
    { key: 'feeAmount',        label: '费用金额' },
    { key: 'paymentStatus',    label: '缴费状态' },
    { key: 'remark1',          label: '备注1' },
    { key: 'remark2',          label: '备注2' }
  ],
  '3-PCT国际申请': [
    { key: 'seqNo',                label: '序号' },
    { key: 'pctInternalNo',        label: 'PCT内部编号' },
    { key: 'status',               label: '状态' },
    { key: 'issueDate',            label: '发文日', type: 'date' },
    { key: 'priorInternalNo',      label: '在先内部编号' },
    { key: 'priorApplicationNo',   label: '在先申请号' },
    { key: 'priorApplicationDate', label: '在先申请日', type: 'date' },
    { key: 'pctApplicationDate',   label: 'PCT申请日', type: 'date' },
    { key: 'applicationName',      label: '申请名称' },
    { key: 'applicationNo',        label: '申请号' },
    { key: 'applicant',            label: '申请人' },
    { key: 'inventor',             label: '发明人' },
    { key: 'sponsor',              label: '主办人' },
    { key: 'agent',                label: '委托书代理人' },
    { key: 'preliminaryConclusion',label: '初检结论' },
    { key: 'remark',               label: '备注' }
  ],
  '4-复审无效专利': [
    { key: 'seqNo',            label: '序号' },
    { key: 'patentType',       label: '类型' },
    { key: 'category',         label: '分类' },
    { key: 'caseNo',           label: '案件编号' },
    { key: 'internalNo',       label: '内部编号' },
    { key: 'applicationNo',    label: '申请号' },
    { key: 'patentName',       label: '专利名称' },
    { key: 'applicant',        label: '申请人' },
    { key: 'sponsor',          label: '主办人' },
    { key: 'agent',            label: '委托书代理人' },
    { key: 'notification',     label: '通知书' },
    { key: 'issueDate',        label: '发文日', type: 'date' },
    { key: 'submitDate',       label: '提交日期', type: 'date' },
    { key: 'queryInfo',        label: '25.6.12查询' },
    { key: 'officialFee',      label: '规费' },
    { key: 'paymentDate',      label: '缴费时间' },
    { key: 'note1',            label: '附注1' }
  ]
}

const SHEET_NAMES = Object.keys(SHEET_CONFIGS)
const CUSTOM_FIELDS_KEY = 'patent_custom_fields'
const sheetNames = SHEET_NAMES

// ---- Reactive state ----
const currentSheet = ref('1-专利新申请')
const searchKeyword = ref('')
const dataCache = reactive({})
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

const disclosureCache = ref([])
const autoCompleteVisible = ref(false)
const autoCompleteItems = ref([])
const autoCompleteBlurTimer = ref(null)

const notificationUploading = ref(false)
const notificationFileName = ref('')

const customFields = ref({})
const showCustomFieldForm = ref(false)
const customFieldLabel = ref('')
const customFieldKey = ref('')

// ---- Computed ----
const currentFields = computed(() => {
  const base = SHEET_CONFIGS[currentSheet.value] || []
  const customs = customFields.value[currentSheet.value] || []
  return [...base, ...customs]
})

const currentRows = computed(() => dataCache[currentSheet.value] || [])

const filteredRows = computed(() => {
  if (!searchKeyword.value.trim()) return currentRows.value
  const kw = searchKeyword.value.trim().toLowerCase()
  return currentRows.value.filter((row) => {
    for (const f of currentFields.value) {
      if (String(row[f.key] || '').toLowerCase().includes(kw)) return true
    }
    return false
  })
})

const totalCount = computed(() => {
  let sum = 0
  for (const name of SHEET_NAMES) sum += (dataCache[name] || []).length
  return sum
})

const modalTitle = computed(() => {
  return modalMode.value === 'add'
    ? `新增记录 - ${currentSheet.value}`
    : `编辑记录 - ${currentSheet.value}`
})

// 新增计算属性
const notificationDisplay = computed({
  get: () => {
    const val = editForm.value.notification
    if (val && isFilePath(val)) {
      return getFileNameFromUrl(val) || val
    }
    return val || ''
  },
  set: (newVal) => {
    editForm.value.notification = newVal
  }
})

// ---- Methods ----
function showToast(message, type = 'info') {
  toastMessage.value = message
  toastType.value = type
  if (toastTimer.value) clearTimeout(toastTimer.value)
  toastTimer.value = setTimeout(() => {
    toastMessage.value = ''
    toastType.value = 'info'
  }, 3000)
}

async function loadSheetData(sheetName) {
  try {
    dataCache[sheetName] = await fetchSheetList(sheetName)
  } catch (e) {
    showToast(`${sheetName} 加载失败: ` + e.message, 'error')
  }
}

async function loadAllSheetData() {
  try {
    const map = await fetchAllSheets(SHEET_NAMES)
    for (const name of SHEET_NAMES) dataCache[name] = map[name] || []
  } catch (e) {
    showToast('加载全部数据失败: ' + e.message, 'error')
  }
}

async function reloadCurrentSheet() {
  await loadSheetData(currentSheet.value)
}

function getRowCount(name) {
  return (dataCache[name] || []).length
}

function formatValue(value, type) {
  if (value === undefined || value === null) return ''
  if (type === 'date' && typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0]
  }
  return String(value)
}

function switchSheet(name) {
  if (currentSheet.value === name) return
  currentSheet.value = name
  searchKeyword.value = ''
  tooltip.show = false
  tooltipHover.value = false
  clearTimeout(hideTimer.value)
}

function clearSearch() { searchKeyword.value = '' }

async function refreshData() {
  await loadAllSheetData()
  showToast('全部数据已刷新', 'success')
}

async function loadDisclosureCache() {
  try {
    disclosureCache.value = await fetchAllDisclosures()
  } catch {
    disclosureCache.value = []
  }
}

function openAddModal() {
  modalMode.value = 'add'
  editId.value = null
  const form = {}
  for (const f of currentFields.value) form[f.key] = ''
  editForm.value = form
  modalVisible.value = true
  autoCompleteVisible.value = false
  autoCompleteItems.value = []
  notificationFileName.value = ''
  tooltip.show = false
  tooltipHover.value = false
  clearTimeout(hideTimer.value)
  loadDisclosureCache()
}

function openEditModal(row) {
  modalMode.value = 'edit'
  editId.value = row.id
  const form = {}
  for (const f of currentFields.value) {
    form[f.key] = row[f.key] !== undefined ? row[f.key] : ''
  }
  editForm.value = form
  autoCompleteVisible.value = false
  autoCompleteItems.value = []

  // ★★★ 提取文件名显示到提示 ★★★
  const noti = row.notification
  if (noti && isFilePath(noti)) {
    notificationFileName.value = getFileNameFromUrl(noti) || '未知文件'
  } else {
    notificationFileName.value = ''
  }

  modalVisible.value = true
  tooltip.show = false
  tooltipHover.value = false
  clearTimeout(hideTimer.value)
}

function closeModal() {
  modalVisible.value = false
  editForm.value = {}
  editId.value = null
  autoCompleteVisible.value = false
  autoCompleteItems.value = []
  notificationFileName.value = ''
}

async function saveRecord() {
  const data = { ...editForm.value }
  for (const f of currentFields.value) {
    if (f.type === 'date') {
      if (data[f.key] === '' || data[f.key] === null) { data[f.key] = null }
      else if (!/ \d{2}:\d{2}:\d{2}$/.test(data[f.key])) { data[f.key] = data[f.key] + ' 00:00:00' }
    }
  }
  try {
    if (modalMode.value === 'add') {
      await createRecord(currentSheet.value, data)
    } else {
      await updateRecord(currentSheet.value, editId.value, data)
    }
    showToast(modalMode.value === 'add' ? '新增成功' : '更新成功', 'success')
    closeModal()
    await reloadCurrentSheet()
  } catch (e) {
    showToast('请求失败: ' + e.message, 'error')
  }
}

function deleteRecord(row) {
  const name = row.patentName || row.applicationName || '未命名'
  if (!confirm(`确定要删除 "${name}" 吗？此操作不可恢复！`)) return
  apiDeleteRecord(currentSheet.value, row.id)
    .then(async () => {
      showToast('已删除', 'success')
      await reloadCurrentSheet()
    })
    .catch((e) => {
      showToast('请求失败: ' + e.message, 'error')
    })
}

// ---- File upload ----
async function onNotificationFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  notificationUploading.value = true
  try {
    // uploadFile 现在返回字符串 URL（如 "/files/abc.pdf?name=xxx"）
    const url = await uploadFile(file)
    // 直接赋值给 notification 字段
    editForm.value.notification = url
    // 从 URL 中解析原始文件名，若解析失败则回退为 file.name
    notificationFileName.value = getFileNameFromUrl(url) || file.name
    showToast('文件上传成功', 'success')
  } catch (err) {
    showToast('文件上传失败: ' + err.message, 'error')
  } finally {
    notificationUploading.value = false
    e.target.value = ''
  }
}

function isFilePath(value) {
  return typeof value === 'string' && value.startsWith('/files/')
}

function fileViewUrl(path) {
  return `${API_BASE}${path}`
}

// ---- Tooltip ----
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

// ---- T表 autocomplete on internalNo ----
function onInternalNoInput() {
  const val = (editForm.value.internalNo || '').trim().toLowerCase()
  if (!val) {
    autoCompleteItems.value = []
    autoCompleteVisible.value = false
    return
  }
  autoCompleteItems.value = disclosureCache.value
    .filter(d => (d.internalNo || '').toLowerCase().includes(val))
    .slice(0, 8)
  autoCompleteVisible.value = autoCompleteItems.value.length > 0
}

function onInternalNoFocus() {
  const val = (editForm.value.internalNo || '').trim()
  if (val && disclosureCache.value.length > 0) {
    autoCompleteItems.value = disclosureCache.value
      .filter(d => (d.internalNo || '').toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8)
    autoCompleteVisible.value = autoCompleteItems.value.length > 0
  }
}

function onInternalNoBlur() {
  clearTimeout(autoCompleteBlurTimer.value)
  autoCompleteBlurTimer.value = setTimeout(() => {
    autoCompleteVisible.value = false
  }, 150)
}

function onAutocompleteSelect(record) {
  const fields = currentFields.value
  const has = (key) => fields.some(f => f.key === key)

  if (record.internalNo && has('internalNo')) editForm.value.internalNo = record.internalNo
  if (record.disclosureName) {
    if (has('patentName')) editForm.value.patentName = record.disclosureName
    if (has('applicationName')) editForm.value.applicationName = record.disclosureName
  }
  if (record.applicant && has('applicant')) editForm.value.applicant = record.applicant
  if (record.agent && has('agent')) editForm.value.agent = record.agent
  if (record.contactPerson && has('inventor')) editForm.value.inventor = record.contactPerson
  if (record.manager && has('sponsor')) editForm.value.sponsor = record.manager

  autoCompleteVisible.value = false
  showToast('T表数据已导入，请检查并补充其他字段', 'success')
}

// ---- Custom fields ----
function loadCustomFields() {
  try {
    const raw = localStorage.getItem(CUSTOM_FIELDS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    customFields.value = {}
    for (const name of SHEET_NAMES) {
      customFields.value[name] = Array.isArray(parsed[name]) ? parsed[name] : []
    }
  } catch {
    customFields.value = {}
    for (const name of SHEET_NAMES) customFields.value[name] = []
  }
}

function saveCustomFieldsToStorage() {
  localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(customFields.value))
}

function isCustomField(key) {
  const customs = customFields.value[currentSheet.value] || []
  return customs.some(f => f.key === key)
}

function openCustomFieldForm() {
  showCustomFieldForm.value = true
  customFieldLabel.value = ''
  customFieldKey.value = ''
}

function closeCustomFieldForm() {
  showCustomFieldForm.value = false
  customFieldLabel.value = ''
  customFieldKey.value = ''
}

function addCustomField() {
  const label = customFieldLabel.value.trim()
  const key = customFieldKey.value.trim()
  if (!label) { showToast('请输入字段名称', 'warning'); return }
  if (!key) { showToast('请输入字段键名', 'warning'); return }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    showToast('字段键名只能包含字母、数字和下划线，且以字母或下划线开头', 'warning')
    return
  }
  const existing = currentFields.value.some(f => f.key === key)
  if (existing) { showToast('字段键名已存在，请换一个', 'warning'); return }
  customFields.value[currentSheet.value].push({ key, label })
  saveCustomFieldsToStorage()
  closeCustomFieldForm()
  showToast(`自定义字段 "${label}" 已添加`, 'success')
}

function removeCustomField(key) {
  customFields.value[currentSheet.value] = customFields.value[currentSheet.value].filter(f => f.key !== key)
  saveCustomFieldsToStorage()
  showToast('自定义字段已移除', 'info')
}

// ---- Lifecycle ----
onMounted(async () => {
  for (const name of SHEET_NAMES) dataCache[name] = []
  loadCustomFields()
  await loadAllSheetData()
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

/* Autocomplete dropdown */
.autocomplete-wrapper {
  position: relative;
}
.autocomplete-wrapper .form-input {
  width: 100%;
}
.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #1a5c9e;
  border-top: none;
  max-height: 240px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.autocomplete-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f0f3f8;
}
.autocomplete-item:hover {
  background: #eef3fc;
}
.ac-no {
  font-weight: 600;
  color: #1a5c9e;
  white-space: nowrap;
  min-width: 100px;
}
.ac-name {
  color: #4a5a72;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* File upload */
.file-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.file-input-row .form-input {
  flex: 1;
}
.file-upload-btn {
  cursor: pointer;
  flex-shrink: 0;
}
.file-name-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #2980b9;
}
.file-link {
  color: #1e2d42;               /* 悬停保持黑色，如需其他效果可自行调整 */
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
}
.file-link:hover {
  color: #1e2d42;               /* 悬停保持黑色，如需其他效果可自行调整 */
  font-size: 13px;
  text-decoration: none;
}
.btn.sm.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
