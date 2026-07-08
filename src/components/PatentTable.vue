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
      <input
          class="search-input"
          placeholder="搜索所有字段..."
          v-model="searchKeyword"
      />
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
          <th v-for="field in currentFields" :key="field.key">{{ field.label }}</th>
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

  <!-- 悬浮Tooltip，支持移入选文字 -->
  <div
      v-if="tooltip.show"
      class="text-tooltip"
      :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      @mouseenter="tooltipHover = true"
      @mouseleave="tooltipHover = false"
  >
    {{ tooltip.text }}
  </div>

  <div class="modal-overlay" v-if="modalVisible" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <span class="modal-title">{{ modalTitle }}</span>
        <span class="modal-close" @click="closeModal">&times;</span>
      </div>
      <div class="modal-body">
        <div v-for="field in currentFields" :key="field.key" class="form-group">
          <label class="form-label">{{ field.label }}</label>
          <input
              v-if="field.type !== 'date'"
              class="form-input"
              v-model="editForm[field.key]"
              :placeholder="field.label"
          />
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
  <div class="toast" :class="[toastType, { show: toastMessage }]">
    {{ toastMessage }}
  </div>
</template>

<script>
import { fetchSheetList, fetchAllSheets, createRecord, updateRecord, deleteRecord as apiDeleteRecord } from '../api/patentApi.js'
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

      // 悬浮提示数据
      tooltip: {
        show: false,
        x: 0,
        y: 0,
        text: ''
      },
      tooltipHover: false,
      hideTimer: null
    }
  },
  computed: {
    sheetNames() { return SHEET_NAMES },
    currentFields() { return SHEET_CONFIGS[this.currentSheet] || [] },
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
      if (type === 'string' && typeof value === 'string' && value.includes('T')) {
        return value.split('T')[0]
      }
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
    openAddModal() {
      this.modalMode = 'add'
      this.editId = null
      const form = {}
      for (const f of this.currentFields) form[f.key] = ''
      this.editForm = form
      this.modalVisible = true
      this.tooltip.show = false
      this.tooltipHover = false
      clearTimeout(this.hideTimer)
    },
    openEditModal(row) {
      this.modalMode = 'edit'
      this.editId = row.id
      const form = {}
      for (const f of this.currentFields) {
        form[f.key] = row[f.key] !== undefined ? row[f.key] : ''
      }
      this.editForm = form
      this.modalVisible = true
      this.tooltip.show = false
      this.tooltipHover = false
      clearTimeout(this.hideTimer)
    },
    closeModal() {
      this.modalVisible = false
      this.editForm = {}
      this.editId = null
    },
    async saveRecord() {
      const data = { ...this.editForm }
      for (const f of this.currentFields) {
        if (f.type === 'date' && data[f.key] === '') data[f.key] = null
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

    // 鼠标移入单元格：清除关闭计时器，显示浮窗
    handleCellEnter(event, text) {
      const el = event.currentTarget
      const isOverflow = el.scrollWidth > el.clientWidth
      if (!isOverflow) return

      clearTimeout(this.hideTimer)
      const rect = el.getBoundingClientRect()
      this.tooltip.text = text
      this.tooltip.x = rect.left + 10
      this.tooltip.y = rect.bottom + window.scrollY + 8
      this.tooltip.show = true
    },
    // 鼠标离开单元格：300ms延迟关闭，给移动到浮窗的时间
    handleCellLeave() {
      clearTimeout(this.hideTimer)
      this.hideTimer = setTimeout(() => {
        // 只有鼠标不在浮窗内才关闭
        if (!this.tooltipHover) {
          this.tooltip.show = false
        }
      }, 300)
    }
  },
  async mounted() {
    for (const name of SHEET_NAMES) this.dataCache[name] = []
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
  user-select: text; /* 允许鼠标框选复制 */
  word-break: break-all;
  line-height: 1.5;
  font-size: 13px;
}


.stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #4a5a72;
  background: #f7f9fc;
  padding: 4px 14px;
  border: 1px solid #e2e8f0;
}
.stat-item {
  font-weight: 500;
}
.tab-nav {
  display: flex;
  flex-shrink: 0;
  white-space: nowrap;
  padding: 4px 0 0 0;
  border-bottom: 2px solid #e9edf4;
  margin-bottom: 6px;
  overflow-x: auto;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  margin-right: 4px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #5a6e85;
  border: 1px solid transparent;
  border-bottom: none;
  cursor: pointer;
}
.tab-btn.active {
  background: #eef3fc;
  color: #1a5c9e;
  font-weight: 600;
  border-color: #dce3ed;
  border-bottom-color: #1a5c9e;
  border-bottom-width: 3px;
}
.badge {
  background: #dce3ed;
  color: #3d5270;
  font-size: 11px;
  font-weight: 600;
  padding: 0 8px;
  margin-left: 6px;
  border: 1px solid #c8d2de;
}
.tab-btn.active .badge {
  background: #1a5c9e;
  color: #fff;
  border-color: #1a5c9e;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 0 6px 0;
  flex-wrap: wrap;
  gap: 8px;
}
.search-box {
  display: flex;
  align-items: center;
  background: #f5f7fb;
  border: 1px solid #dce3ed;
  padding: 0 12px;
  flex: 1 1 200px;
  max-width: 320px;
  height: 36px;
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  height: 100%;
  color: #1a2332;
}
.clear-btn {
  color: #8a9bb0;
  font-size: 14px;
  padding-left: 6px;
  cursor: pointer;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  padding: 6px 16px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  cursor: pointer;
}
.btn.primary {
  background: #1a5c9e;
  color: #fff;
  border-color: #1a5c9e;
}
.btn.primary:hover { background: #134a80; }
.btn.outline {
  border-color: #d0d9e5;
  color: #4a5a72;
}
.btn.outline:hover { background: #f0f4fa; }
.btn.warning {
  background: #e67e22;
  color: #fff;
  border-color: #e67e22;
}
.btn.danger {
  background: #c0392b;
  color: #fff;
  border-color: #c0392b;
}
.btn.sm {
  padding: 2px 10px;
  font-size: 12px;
  margin: 2px 0;
}
.table-wrapper {
  flex: 1;
  overflow: hidden;
  margin-top: 4px;
}
.table-scroll {
  overflow: auto;
  width: 100%;
  height: 100%;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  border: 1px solid #bcc8d6;
}
thead {
  background: #eef3fc;
  position: sticky;
  top: 0;
  z-index: 2;
}
th {
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  color: #1a3a5c;
  border: 1px solid #c8d4e2;
  white-space: nowrap;
  font-size: 12px;
}
td {
  padding: 6px 6px;
  border: 1px solid #dce3ed;
  color: #1e2d42;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}
.col-actions {
  text-align: center;
  white-space: nowrap;
}
.empty-row {
  text-align: center;
  padding: 40px 0;
  color: #8a9bb0;
  font-size: 15px;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal {
  background: #fff;
  max-width: 600px;
  width: 92%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  border: 1px solid #d0d9e5;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e9edf4;
}
.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #0b2b4a;
}
.modal-close {
  font-size: 28px;
  color: #8a9bb0;
  padding: 0 6px;
  cursor: pointer;
}
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
.form-group {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}
.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #2c405a;
  margin-bottom: 4px;
}
.form-input {
  padding: 8px 12px;
  border: 1px solid #dce3ed;
  font-size: 14px;
  background: #fafcfe;
  color: #1a2332;
}
.form-input:focus {
  border-color: #1a5c9e;
  outline: none;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid #e9edf4;
  background: #fafcfe;
}
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a2332;
  color: #fff;
  padding: 12px 28px;
  font-size: 14px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
  z-index: 9999;
  transition: opacity 0.4s;
  opacity: 0;
  pointer-events: none;
  border: 1px solid #444;
}
.toast.show {
  opacity: 1;
  pointer-events: auto;
}
.toast.success { background: #1d8a4f; }
.toast.error { background: #c0392b; }
.toast.warning { background: #e67e22; }

</style>