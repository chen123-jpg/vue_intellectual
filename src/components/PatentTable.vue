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
              <div
                class="cell-text"
                @mouseenter="handleCellEnter($event, formatValue(row[field.key], field.type))"
                @mouseleave="handleCellLeave"
              >
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

<script>
import { fetchSheetList, fetchAllSheets, createRecord, updateRecord, deleteRecord as apiDeleteRecord } from '../api/patentApi.js'
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

export default {
  name: 'PatentTable',
  data() {
    return {
      currentSheet: '1-专利新申请',
      searchKeyword: '',
      dataCache: {},
      modalVisible: false,
      modalMode: 'add',
      editForm: {},
      editId: null,
      toastMessage: '',
      toastType: 'info',
      toastTimer: null,

      // tooltip
      tooltip: { show: false, x: 0, y: 0, text: '' },
      tooltipHover: false,
      hideTimer: null,

      // T表 autocomplete
      disclosureCache: [],
      autoCompleteVisible: false,
      autoCompleteItems: [],
      autoCompleteBlurTimer: null,

      // custom fields
      customFields: {},
      showCustomFieldForm: false,
      customFieldLabel: '',
      customFieldKey: ''
    }
  },
  computed: {
    sheetNames() { return SHEET_NAMES },
    currentFields() {
      const base = SHEET_CONFIGS[this.currentSheet] || []
      const customs = this.customFields[this.currentSheet] || []
      return [...base, ...customs]
    },
    hasInternalNo() {
      return this.currentFields.some(f => f.key === 'internalNo')
    },
    currentRows() { return this.dataCache[this.currentSheet] || [] },
    filteredRows() {
      if (!this.searchKeyword.trim()) return this.currentRows
      const kw = this.searchKeyword.trim().toLowerCase()
      return this.currentRows.filter((row) => {
        for (const f of this.currentFields) {
          if (String(row[f.key] || '').toLowerCase().includes(kw)) return true
        }
        return false
      })
    },
    totalCount() {
      let sum = 0
      for (const name of SHEET_NAMES) sum += (this.dataCache[name] || []).length
      return sum
    },
    modalTitle() {
      return this.modalMode === 'add'
        ? `新增记录 - ${this.currentSheet}`
        : `编辑记录 - ${this.currentSheet}`
    }
  },
  methods: {
    async loadSheetData(sheetName) {
      try {
        this.dataCache[sheetName] = await fetchSheetList(sheetName)
      } catch (e) {
        this.showToast(`${sheetName} 加载失败: ` + e.message, 'error')
      }
    },
    async loadAllSheetData() {
      try {
        const map = await fetchAllSheets(SHEET_NAMES)
        for (const name of SHEET_NAMES) this.dataCache[name] = map[name] || []
      } catch (e) {
        this.showToast('加载全部数据失败: ' + e.message, 'error')
      }
    },
    async reloadCurrentSheet() {
      await this.loadSheetData(this.currentSheet)
    },
    getRowCount(name) {
      return (this.dataCache[name] || []).length
    },
    formatValue(value, type) {
      if (value === undefined || value === null) return ''
      if (type === 'date' && typeof value === 'string' && value.includes('T')) {
        return value.split('T')[0]
      }
      return String(value)
    },
    switchSheet(name) {
      if (this.currentSheet === name) return
      this.currentSheet = name
      this.searchKeyword = ''
      this.tooltip.show = false
      this.tooltipHover = false
      clearTimeout(this.hideTimer)
    },
    clearSearch() { this.searchKeyword = '' },
    async refreshData() {
      await this.loadAllSheetData()
      this.showToast('全部数据已刷新', 'success')
    },

    async loadDisclosureCache() {
      try {
        this.disclosureCache = await fetchAllDisclosures()
      } catch {
        this.disclosureCache = []
      }
    },

    openAddModal() {
      this.modalMode = 'add'
      this.editId = null
      const form = {}
      for (const f of this.currentFields) form[f.key] = ''
      this.editForm = form
      this.modalVisible = true
      this.autoCompleteVisible = false
      this.autoCompleteItems = []
      this.tooltip.show = false
      this.tooltipHover = false
      clearTimeout(this.hideTimer)
      // preload T表 data for autocomplete
      this.loadDisclosureCache()
    },
    openEditModal(row) {
      this.modalMode = 'edit'
      this.editId = row.id
      const form = {}
      for (const f of this.currentFields) {
        form[f.key] = row[f.key] !== undefined ? row[f.key] : ''
      }
      this.editForm = form
      this.autoCompleteVisible = false
      this.autoCompleteItems = []
      this.modalVisible = true
      this.tooltip.show = false
      this.tooltipHover = false
      clearTimeout(this.hideTimer)
    },
    closeModal() {
      this.modalVisible = false
      this.editForm = {}
      this.editId = null
      this.autoCompleteVisible = false
      this.autoCompleteItems = []
    },
    async saveRecord() {
      const data = { ...this.editForm }
      for (const f of this.currentFields) {
        if (f.type === 'date') {
          if (data[f.key] === '' || data[f.key] === null) { data[f.key] = null }
          else if (!/ \d{2}:\d{2}:\d{2}$/.test(data[f.key])) { data[f.key] = data[f.key] + ' 00:00:00' }
        }
      }
      try {
        if (this.modalMode === 'add') {
          await createRecord(this.currentSheet, data)
        } else {
          await updateRecord(this.currentSheet, this.editId, data)
        }
        this.showToast(this.modalMode === 'add' ? '新增成功' : '更新成功', 'success')
        this.closeModal()
        await this.reloadCurrentSheet()
      } catch (e) {
        this.showToast('请求失败: ' + e.message, 'error')
      }
    },
    deleteRecord(row) {
      const name = row.patentName || row.applicationName || '未命名'
      if (!confirm(`确定要删除 "${name}" 吗？此操作不可恢复！`)) return
      apiDeleteRecord(this.currentSheet, row.id)
        .then(async () => {
          this.showToast('已删除', 'success')
          await this.reloadCurrentSheet()
        })
        .catch((e) => {
          this.showToast('请求失败: ' + e.message, 'error')
        })
    },
    showToast(message, type = 'info') {
      this.toastMessage = message
      this.toastType = type
      if (this.toastTimer) clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => {
        this.toastMessage = ''
        this.toastType = 'info'
      }, 3000)
    },

    // Tooltip
    handleCellEnter(event, text) {
      const el = event.currentTarget
      if (el.scrollWidth <= el.clientWidth) return
      clearTimeout(this.hideTimer)
      const rect = el.getBoundingClientRect()
      this.tooltip.text = text
      this.tooltip.x = rect.left + 10
      this.tooltip.y = rect.bottom + window.scrollY + 8
      this.tooltip.show = true
    },
    handleCellLeave() {
      clearTimeout(this.hideTimer)
      this.hideTimer = setTimeout(() => {
        if (!this.tooltipHover) this.tooltip.show = false
      }, 300)
    },

    // ---- T表 autocomplete on internalNo ----
    onInternalNoInput() {
      const val = (this.editForm.internalNo || '').trim().toLowerCase()
      if (!val) {
        this.autoCompleteItems = []
        this.autoCompleteVisible = false
        return
      }
      this.autoCompleteItems = this.disclosureCache
        .filter(d => (d.internalNo || '').toLowerCase().includes(val))
        .slice(0, 8)
      this.autoCompleteVisible = this.autoCompleteItems.length > 0
    },
    onInternalNoFocus() {
      const val = (this.editForm.internalNo || '').trim()
      if (val && this.disclosureCache.length > 0) {
        this.autoCompleteItems = this.disclosureCache
          .filter(d => (d.internalNo || '').toLowerCase().includes(val.toLowerCase()))
          .slice(0, 8)
        this.autoCompleteVisible = this.autoCompleteItems.length > 0
      }
    },
    onInternalNoBlur() {
      clearTimeout(this.autoCompleteBlurTimer)
      this.autoCompleteBlurTimer = setTimeout(() => {
        this.autoCompleteVisible = false
      }, 150)
    },
    onAutocompleteSelect(record) {
      const fields = this.currentFields
      const has = (key) => fields.some(f => f.key === key)

      if (record.internalNo && has('internalNo')) this.editForm.internalNo = record.internalNo
      if (record.disclosureName) {
        if (has('patentName')) this.editForm.patentName = record.disclosureName
        if (has('applicationName')) this.editForm.applicationName = record.disclosureName
      }
      if (record.applicant && has('applicant')) this.editForm.applicant = record.applicant
      if (record.agent && has('agent')) this.editForm.agent = record.agent
      if (record.contactPerson && has('inventor')) this.editForm.inventor = record.contactPerson
      if (record.manager && has('sponsor')) this.editForm.sponsor = record.manager

      this.autoCompleteVisible = false
      this.showToast('T表数据已导入，请检查并补充其他字段', 'success')
    },

    // ---- Custom fields ----
    loadCustomFields() {
      try {
        const raw = localStorage.getItem(CUSTOM_FIELDS_KEY)
        const parsed = raw ? JSON.parse(raw) : {}
        this.customFields = {}
        for (const name of SHEET_NAMES) {
          this.customFields[name] = Array.isArray(parsed[name]) ? parsed[name] : []
        }
      } catch {
        this.customFields = {}
        for (const name of SHEET_NAMES) this.customFields[name] = []
      }
    },
    saveCustomFieldsToStorage() {
      localStorage.setItem(CUSTOM_FIELDS_KEY, JSON.stringify(this.customFields))
    },
    isCustomField(key) {
      const customs = this.customFields[this.currentSheet] || []
      return customs.some(f => f.key === key)
    },
    openCustomFieldForm() {
      this.showCustomFieldForm = true
      this.customFieldLabel = ''
      this.customFieldKey = ''
    },
    closeCustomFieldForm() {
      this.showCustomFieldForm = false
      this.customFieldLabel = ''
      this.customFieldKey = ''
    },
    addCustomField() {
      const label = this.customFieldLabel.trim()
      const key = this.customFieldKey.trim()
      if (!label) { this.showToast('请输入字段名称', 'warning'); return }
      if (!key) { this.showToast('请输入字段键名', 'warning'); return }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        this.showToast('字段键名只能包含字母、数字和下划线，且以字母或下划线开头', 'warning')
        return
      }
      const existing = this.currentFields.some(f => f.key === key)
      if (existing) { this.showToast('字段键名已存在，请换一个', 'warning'); return }
      this.customFields[this.currentSheet].push({ key, label })
      this.saveCustomFieldsToStorage()
      this.closeCustomFieldForm()
      this.showToast(`自定义字段 "${label}" 已添加`, 'success')
    },
    removeCustomField(key) {
      this.customFields[this.currentSheet] = this.customFields[this.currentSheet].filter(f => f.key !== key)
      this.saveCustomFieldsToStorage()
      this.showToast('自定义字段已移除', 'info')
    }
  },

  async mounted() {
    for (const name of SHEET_NAMES) this.dataCache[name] = []
    this.loadCustomFields()
    await this.loadAllSheetData()
  }
}
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
</style>
