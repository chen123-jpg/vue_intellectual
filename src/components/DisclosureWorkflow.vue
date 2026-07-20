<template>
  <div class="dw-page">
    <div class="dw-header">
      <div>
        <div class="title">交底处理流程</div>
        <div class="sub">录入 → 主办处理/发邮件 → 定稿上传申请包 → 定稿待报同步 P 表</div>
      </div>
      <div class="header-actions">
        <el-button v-if="perms.canCreate" type="primary" @click="openCreate">录入交底</el-button>
        <el-button @click="reload">刷新</el-button>
      </div>
    </div>

    <!-- 筛选 -->
    <el-form :inline="true" class="filter-form" @submit.prevent>
      <el-form-item label="仅看我的">
        <el-switch v-model="onlyMine" @change="onOnlyMineChange" :disabled="forceMine" />
        <span class="hint" v-if="currentUserId != null">UID {{ currentUserId }}</span>
        <span class="hint warn" v-else>未获取到登录用户</span>
        <span class="hint" v-if="forceMine">（主办人强制只看本人）</span>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" clearable placeholder="编号/名称/申请人/联系人" style="width: 200px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.patentStatus" clearable placeholder="全部" style="width: 150px">
          <el-option v-for="s in PATENT_STATUS_OPTIONS" :key="s.code" :label="s.desc" :value="s.code" />
        </el-select>
      </el-form-item>
      <el-form-item label="主办人">
        <el-input v-model="query.sponsor" clearable placeholder="姓名" style="width: 120px" :disabled="onlyMine" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="reload">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" stripe border height="420" @row-dblclick="openDetail">
      <el-table-column prop="tempNo" label="临时编号" width="110" />
      <el-table-column prop="internalNo" label="内部编号" width="110" />
      <el-table-column prop="disclosureName" label="交底名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="applicant" label="申请人" width="140" show-overflow-tooltip />
      <el-table-column prop="sponsor" label="主办人" width="90" />
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag size="small" :type="statusTagType(row.patentStatus)">{{ statusLabel(row.patentStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="同步P表" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.syncedToPatent === 1 ? 'success' : 'info'" size="small">
            {{ row.syncedToPatent === 1 ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">处理</el-button>
          <el-button v-if="perms.canCopy" link @click="onCopy(row)">复制</el-button>
          <el-button
            v-if="perms.canStatus"
            link
            type="warning"
            @click="quickStatus(row, '11')"
            :disabled="!canSetFinalized(row)"
          >定稿</el-button>
          <el-button
            v-if="perms.canPending"
            link
            type="success"
            @click="onPendingReport(row)"
          >定稿待报</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 录入对话框 -->
    <el-dialog v-model="createVisible" title="录入交底信息" width="720px" destroy-on-close>
      <el-form :model="createForm" label-width="110px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="交底名称" required>
              <el-input v-model="createForm.disclosureName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="专利类型">
              <el-select v-model="createForm.patentType" clearable style="width:100%">
                <el-option label="发明" value="发明" />
                <el-option label="实用新型" value="实用新型" />
                <el-option label="外观设计" value="外观设计" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申请人">
              <el-select v-model="createForm.applicant" filterable allow-create clearable style="width:100%">
                <el-option v-for="a in applicantList" :key="a.id" :label="a.name" :value="a.name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发明人">
              <el-input v-model="createForm.inventor" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主办人" required>
              <el-select
                v-model="createForm.sponsorUserId"
                filterable
                clearable
                placeholder="选择主办人员工"
                style="width:100%"
                @change="onSponsorSelect"
              >
                <el-option
                  v-for="s in sponsorEmployees"
                  :key="s.id"
                  :label="`${s.name}${s.userId ? ' (UID ' + s.userId + ')' : ' (无账号)'}`"
                  :value="s.userId"
                  :disabled="s.userId == null"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主办人姓名">
              <el-input v-model="createForm.sponsor" placeholder="随选择自动填入" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="代理人">
              <el-select v-model="createForm.agent" filterable allow-create clearable style="width:100%">
                <el-option v-for="a in agentList" :key="a.id" :label="a.name" :value="a.name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="管理人">
              <el-input v-model="createForm.manager" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="createForm.contactPerson" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人邮箱">
              <el-input v-model="createForm.contactEmail" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人电话">
              <el-input v-model="createForm.contactPhone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="交底日">
              <el-date-picker v-model="createForm.disclosureDate" type="date" value-format="YYYY-MM-DD 00:00:00" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="要求">
              <el-input v-model="createForm.requirement" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邀请进群">
              <el-switch v-model="createForm.invitedToGroup" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="自动编号">
              <el-switch v-model="autoGenerateNo" />
            </el-form-item>
          </el-col>
          <template v-if="!autoGenerateNo">
            <el-col :span="12">
              <el-form-item label="临时编号" required>
                <el-input v-model="createForm.tempNo" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="内部编号" required>
                <el-input v-model="createForm.internalNo" />
              </el-form-item>
            </el-col>
          </template>
          <el-col :span="24">
            <el-form-item label="联系人信息">
              <el-input v-model="createForm.contactInfo" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="createForm.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="交底书(Word)" required>
              <input type="file" accept=".doc,.docx" @change="onCreateDocChange" />
              <span class="hint" v-if="createDocFile">{{ createDocFile.name }}</span>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="其他附件">
              <input type="file" multiple @change="onCreateOtherChange" />
              <span class="hint" v-if="createOtherFiles.length">已选 {{ createOtherFiles.length }} 个</span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">保存并上传附件</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" size="72%" :title="detailTitle" destroy-on-close>
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <el-descriptions :column="3" border size="small" class="mb12">
            <el-descriptions-item label="临时编号">{{ detail.disclosure.tempNo }}</el-descriptions-item>
            <el-descriptions-item label="内部编号">{{ detail.disclosure.internalNo }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag size="small">{{ statusLabel(detail.disclosure.patentStatus) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="交底名称" :span="2">{{ detail.disclosure.disclosureName }}</el-descriptions-item>
            <el-descriptions-item label="同步P表">{{ detail.disclosure.syncedToPatent === 1 ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="申请人">{{ detail.disclosure.applicant }}</el-descriptions-item>
            <el-descriptions-item label="发明人">{{ detail.disclosure.inventor }}</el-descriptions-item>
            <el-descriptions-item label="主办人">{{ detail.disclosure.sponsor }}</el-descriptions-item>
            <el-descriptions-item label="联系人">{{ detail.disclosure.contactPerson }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">{{ detail.disclosure.contactEmail }}</el-descriptions-item>
            <el-descriptions-item label="代理人">{{ detail.disclosure.agent }}</el-descriptions-item>
          </el-descriptions>

          <el-tabs v-model="detailTab">
            <!-- 基本信息编辑 -->
            <el-tab-pane label="基本信息" name="base">
              <el-form :model="editForm" label-width="100px" class="edit-form">
                <el-row :gutter="12">
                  <el-col :span="12"><el-form-item label="交底名称"><el-input v-model="editForm.disclosureName" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="要求"><el-input v-model="editForm.requirement" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="申请人"><el-input v-model="editForm.applicant" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="发明人"><el-input v-model="editForm.inventor" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="主办人"><el-input v-model="editForm.sponsor" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="代理人"><el-input v-model="editForm.agent" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="联系人"><el-input v-model="editForm.contactPerson" /></el-form-item></el-col>
                  <el-col :span="12"><el-form-item label="联系邮箱"><el-input v-model="editForm.contactEmail" /></el-form-item></el-col>
                  <el-col :span="24"><el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" /></el-form-item></el-col>
                </el-row>
                <el-button type="primary" :loading="saving" @click="saveEdit">保存修改</el-button>
              </el-form>
            </el-tab-pane>

            <!-- 状态 -->
            <el-tab-pane label="状态流转" name="status">
              <div class="toolbar-row">
                <template v-if="perms.canStatus">
                  <el-select v-model="nextStatus" placeholder="选择目标状态" style="width: 200px">
                    <el-option v-for="s in PATENT_STATUS_OPTIONS" :key="s.code" :label="s.desc" :value="s.code" />
                  </el-select>
                  <el-input v-model="statusRemark" placeholder="备注" style="width: 240px; margin-left: 8px" />
                  <el-button type="primary" style="margin-left: 8px" :loading="saving" @click="submitStatus">变更状态</el-button>
                </template>
                <el-button
                  v-if="perms.canPending"
                  type="success"
                  :loading="saving"
                  @click="onPendingReport(detail.disclosure)"
                >定稿待报并同步P表</el-button>
                <span v-if="!perms.canStatus && !perms.canPending" class="hint">当前角色无状态操作权限</span>
              </div>
              <el-table :data="detail.statusLogs || []" size="small" border class="mt12">
                <el-table-column prop="createTime" label="时间" width="170" />
                <el-table-column prop="fromStatus" label="原状态" width="100">
                  <template #default="{ row }">{{ statusLabel(row.fromStatus) }}</template>
                </el-table-column>
                <el-table-column prop="toStatus" label="新状态" width="100">
                  <template #default="{ row }">{{ statusLabel(row.toStatus) }}</template>
                </el-table-column>
                <el-table-column prop="operatorName" label="操作人" width="100" />
                <el-table-column prop="remark" label="备注" />
              </el-table>
            </el-tab-pane>

            <!-- 附件 -->
            <el-tab-pane label="附件" name="attach">
              <div class="toolbar-row">
                <span>交底书(Word)：</span>
                <input type="file" accept=".doc,.docx" @change="(e) => uploadAtt(e, 'DISCLOSURE_DOC')" />
                <span style="margin-left:16px">其他：</span>
                <input type="file" multiple @change="(e) => uploadAtt(e, 'DISCLOSURE_OTHER')" />
              </div>
              <el-table :data="detail.attachments || []" size="small" border class="mt12">
                <el-table-column prop="bizType" label="类型" width="140">
                  <template #default="{ row }">{{ row.bizType === 'DISCLOSURE_DOC' ? '交底书' : '其他' }}</template>
                </el-table-column>
                <el-table-column prop="fileName" label="文件名" />
                <el-table-column prop="fileSize" label="大小" width="100">
                  <template #default="{ row }">{{ formatSize(row.fileSize) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="{ row }">
                    <el-link :href="fileAbsoluteUrl(row.fileUrl)" target="_blank" type="primary">打开</el-link>
                    <el-button link type="danger" @click="removeAtt(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 申请包 -->
            <el-tab-pane label="申请包" name="pkg">
              <el-alert
                v-if="!isFinalizedOrAfter(detail.disclosure.patentStatus)"
                type="warning"
                show-icon
                :closable="false"
                title="请先将状态改为「定稿」(11) 后再上传 XML 包与五书 Word"
                class="mb12"
              />
              <div class="toolbar-row" v-if="perms.canPackage">
                <span>XML包：</span>
                <input type="file" @change="(e) => uploadPkg(e, 'XML_PACKAGE')" :disabled="!isFinalizedOrAfter(detail.disclosure.patentStatus)" />
                <span style="margin-left:16px">五书Word：</span>
                <input type="file" accept=".doc,.docx" @change="(e) => uploadPkg(e, 'FIVE_BOOKS_WORD')" :disabled="!isFinalizedOrAfter(detail.disclosure.patentStatus)" />
              </div>
              <div v-else class="hint mb8">仅主办人可上传申请包；流程人员可确认</div>
              <el-table :data="detail.packages || []" size="small" border class="mt12">
                <el-table-column prop="packageType" label="类型" width="150">
                  <template #default="{ row }">
                    {{ row.packageType === 'XML_PACKAGE' ? 'XML包' : '五书WORD' }}
                  </template>
                </el-table-column>
                <el-table-column prop="fileName" label="文件名" />
                <el-table-column prop="versionNo" label="版本" width="70" />
                <el-table-column prop="isCurrent" label="当前" width="70">
                  <template #default="{ row }">{{ row.isCurrent === 1 ? '是' : '否' }}</template>
                </el-table-column>
                <el-table-column prop="confirmStatus" label="确认状态" width="120" />
                <el-table-column label="操作" width="180">
                  <template #default="{ row }">
                    <el-link :href="fileAbsoluteUrl(row.fileUrl)" target="_blank" type="primary">打开</el-link>
                    <el-button
                      link
                      type="success"
                      v-if="row.isCurrent === 1 && perms.canConfirm"
                      @click="onConfirmPkg(row)"
                    >确认</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 缴费开票 -->
            <el-tab-pane label="缴费/开票" name="fee">
              <h4>缴费</h4>
              <el-table :data="detail.fees || []" size="small" border>
                <el-table-column prop="feeType" label="类型" width="100" />
                <el-table-column prop="paymentStatus" label="状态" width="100" />
                <el-table-column prop="feeAmount" label="金额" width="100" />
                <el-table-column prop="internalNo" label="内部编号" />
                <el-table-column prop="createTime" label="创建时间" width="170" />
              </el-table>
              <h4 class="mt12">开票</h4>
              <el-table :data="detail.invoices || []" size="small" border>
                <el-table-column prop="invoiceStatus" label="状态" width="100" />
                <el-table-column prop="invoiceTitle" label="抬头" />
                <el-table-column prop="invoiceAmount" label="金额" width="100" />
                <el-table-column prop="internalNo" label="内部编号" />
                <el-table-column prop="createTime" label="创建时间" width="170" />
              </el-table>
            </el-tab-pane>

            <!-- 邮件 -->
            <el-tab-pane label="发邮件" name="mail">
              <el-alert
                v-if="!perms.canMail"
                type="info"
                :closable="false"
                title="仅主办人可向联系人发邮件"
                class="mb12"
              />
              <el-form label-width="100px" v-if="perms.canMail">
                <el-form-item label="模板">
                  <el-select v-model="mailForm.templateCode" clearable placeholder="选择模板" style="width: 260px" @change="onTemplateChange">
                    <el-option v-for="t in templates" :key="t.templateCode" :label="t.templateName" :value="t.templateCode" />
                  </el-select>
                  <el-button style="margin-left:8px" @click="loadPreview">加载预览</el-button>
                </el-form-item>
                <el-form-item label="收件人">
                  <el-input v-model="mailForm.toEmail" placeholder="请输入收件人邮箱" />
                </el-form-item>
                <el-form-item label="主题">
                  <el-input v-model="mailForm.subject" />
                </el-form-item>
                <el-form-item label="正文">
                  <el-input v-model="mailForm.content" type="textarea" :rows="8" />
                </el-form-item>
                <el-form-item label="交底附件">
                  <div class="mail-attach-box">
                    <div class="hint mb8">勾选要附带的已有附件（可增删）；默认勾选交底书</div>
                    <el-checkbox-group v-model="mailForm.attachmentIds">
                      <div v-for="a in (detail.attachments || [])" :key="a.id" class="mail-attach-row">
                        <el-checkbox :value="a.id" :label="a.id">
                          {{ a.bizType === 'DISCLOSURE_DOC' ? '[交底书] ' : '[其他] ' }}{{ a.fileName }}
                        </el-checkbox>
                      </div>
                    </el-checkbox-group>
                    <div v-if="!(detail.attachments || []).length" class="hint warn">暂无附件，请先到「附件」页上传</div>
                  </div>
                </el-form-item>
                <el-form-item label="额外文件">
                  <input type="file" multiple @change="onMailExtraChange" />
                  <span class="hint" v-if="mailForm.extraFiles.length">将先上传为其他附件再发送（{{ mailForm.extraFiles.length }} 个）</span>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" :loading="saving" @click="sendMail">发送邮件</el-button>
                </el-form-item>
              </el-form>
              <h4 class="mt12">发送记录</h4>
              <el-table :data="detail.mailLogs || []" size="small" border>
                <el-table-column prop="sentAt" label="时间" width="170" />
                <el-table-column prop="toEmails" label="收件人" width="160" />
                <el-table-column prop="subject" label="主题" show-overflow-tooltip />
                <el-table-column prop="sendStatus" label="状态" width="90" />
                <el-table-column prop="errorMessage" label="错误" show-overflow-tooltip />
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchAllAgents } from '../api/agentApi.js'
import { fetchAllApplicants } from '../api/applicantApi.js'
import {
  getCurrentUserId,
  getCurrentUserName,
  isSponsorOnly,
  canCreateDisclosure,
  canCopyDisclosure,
  canChangeStatusAsSponsor,
  canUploadPackage,
  canConfirmPackage,
  canPendingReport,
  canSendMail
} from '../api/userSession.js'
import { listEmployeesByType } from '../api/employeeApi.js'
import {
  PATENT_STATUS_OPTIONS,
  statusLabel,
  isFinalizedOrAfter,
  fileAbsoluteUrl,
  searchDisclosures,
  listBySponsor,
  createDisclosureWorkflow,
  copyDisclosure,
  updateDisclosureWorkflow,
  getDisclosureDetail,
  changeDisclosureStatus,
  markPendingReport,
  uploadDisclosureAttachment,
  deleteAttachment,
  uploadPackage,
  confirmPackage,
  listMailTemplates,
  previewMailTemplate,
  sendWorkflowMail
} from '../api/disclosureWorkflowApi.js'

const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const currentUserId = ref(getCurrentUserId())
const currentUserName = ref(getCurrentUserName())
const forceMine = ref(isSponsorOnly())
/** 默认仅看当前登录用户作为主办人的交底；纯主办人强制开启 */
const onlyMine = ref(forceMine.value || currentUserId.value != null)
const perms = reactive({
  canCreate: canCreateDisclosure(),
  canCopy: canCopyDisclosure(),
  canStatus: canChangeStatusAsSponsor(),
  canPackage: canUploadPackage(),
  canConfirm: canConfirmPackage(),
  canPending: canPendingReport(),
  canMail: canSendMail()
})
const query = reactive({
  keyword: '',
  patentStatus: '',
  sponsor: '',
  sponsorUserId: onlyMine.value && currentUserId.value != null ? currentUserId.value : ''
})

const agentList = ref([])
const applicantList = ref([])
const templates = ref([])
const sponsorEmployees = ref([])

const createVisible = ref(false)
const autoGenerateNo = ref(true)
const createDocFile = ref(null)
const createOtherFiles = ref([])
const createForm = reactive(emptyCreateForm())

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)
const detailTab = ref('base')
const editForm = reactive({})
const nextStatus = ref('')
const statusRemark = ref('')
const mailForm = reactive({
  templateCode: 'DISCLOSURE_CONTACT',
  toEmail: '',
  subject: '',
  content: '',
  attachmentIds: [],
  extraFiles: []
})

const detailTitle = computed(() => {
  if (!detail.value?.disclosure) return '交底处理'
  const d = detail.value.disclosure
  return `${d.tempNo || ''} ${d.disclosureName || '交底处理'}`
})

function emptyCreateForm() {
  return {
    disclosureName: '',
    patentType: '发明',
    applicant: '',
    inventor: '',
    sponsor: '',
    sponsorUserId: null,
    agent: '',
    manager: '',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    disclosureDate: '',
    requirement: '',
    invitedToGroup: false,
    contactInfo: '',
    remark: '',
    tempNo: '',
    internalNo: '',
    patentStatus: '0'
  }
}

function statusTagType(status) {
  const s = String(status)
  if (s === '11' || status === '定稿') return 'warning'
  if (s === '12' || status === '定稿待报') return 'success'
  if (s === '3' || s === '4') return 'danger'
  return ''
}

function canSetFinalized(row) {
  const n = Number(row.patentStatus)
  if (!Number.isNaN(n)) return n < 11
  return row.patentStatus !== '定稿' && row.patentStatus !== '定稿待报'
}

function formatSize(n) {
  if (!n) return '-'
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

function refreshPerms() {
  currentUserId.value = getCurrentUserId()
  currentUserName.value = getCurrentUserName()
  forceMine.value = isSponsorOnly()
  perms.canCreate = canCreateDisclosure()
  perms.canCopy = canCopyDisclosure()
  perms.canStatus = canChangeStatusAsSponsor()
  perms.canPackage = canUploadPackage()
  perms.canConfirm = canConfirmPackage()
  perms.canPending = canPendingReport()
  perms.canMail = canSendMail()
  if (forceMine.value) {
    onlyMine.value = true
    query.sponsorUserId = currentUserId.value
  }
}

function resetQuery() {
  query.keyword = ''
  query.patentStatus = ''
  query.sponsor = ''
  onlyMine.value = forceMine.value || currentUserId.value != null
  query.sponsorUserId = onlyMine.value ? currentUserId.value : ''
  reload()
}

function onOnlyMineChange(val) {
  if (forceMine.value) {
    onlyMine.value = true
    query.sponsorUserId = currentUserId.value
    reload()
    return
  }
  if (val) {
    if (currentUserId.value == null) {
      ElMessage.warning('无法识别当前用户，请重新登录')
      onlyMine.value = false
      return
    }
    query.sponsorUserId = currentUserId.value
    query.sponsor = ''
  } else {
    query.sponsorUserId = ''
  }
  reload()
}

function onSponsorSelect(userId) {
  const hit = sponsorEmployees.value.find((s) => s.userId === userId)
  createForm.sponsor = hit?.name || ''
  createForm.sponsorUserId = userId ?? null
}

async function reload() {
  loading.value = true
  try {
    if (onlyMine.value && currentUserId.value != null) {
      let list = await listBySponsor(currentUserId.value)
      // 本地再套一层关键词/状态（主办列表接口本身只按主办过滤）
      if (query.patentStatus) {
        list = list.filter((r) => String(r.patentStatus) === String(query.patentStatus))
      }
      if (query.keyword) {
        const kw = query.keyword.trim().toLowerCase()
        list = list.filter((r) => {
          const blob = [r.tempNo, r.internalNo, r.disclosureName, r.applicant, r.contactPerson, r.sponsor]
            .map((x) => (x == null ? '' : String(x).toLowerCase()))
            .join(' ')
          return blob.includes(kw)
        })
      }
      rows.value = list
    } else {
      const q = {
        keyword: query.keyword || undefined,
        patentStatus: query.patentStatus || undefined,
        sponsor: query.sponsor || undefined
      }
      rows.value = await searchDisclosures(q)
    }
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!perms.canCreate) {
    ElMessage.warning('仅录入人员可录入交底')
    return
  }
  Object.assign(createForm, emptyCreateForm())
  // 若当前人是主办，可默认自己；否则留空由录入员选择主办人
  if (perms.canStatus && currentUserId.value != null) {
    createForm.sponsorUserId = currentUserId.value
    createForm.sponsor = currentUserName.value || ''
  }
  autoGenerateNo.value = true
  createDocFile.value = null
  createOtherFiles.value = []
  createVisible.value = true
  loadSponsors()
}

async function loadSponsors() {
  try {
    sponsorEmployees.value = await listEmployeesByType('SPONSOR')
  } catch {
    sponsorEmployees.value = []
  }
}

function onCreateDocChange(e) {
  createDocFile.value = e.target.files?.[0] || null
}
function onCreateOtherChange(e) {
  createOtherFiles.value = Array.from(e.target.files || [])
}

async function submitCreate() {
  if (!createForm.disclosureName?.trim()) {
    ElMessage.warning('请填写交底名称')
    return
  }
  if (!createDocFile.value) {
    ElMessage.warning('请上传交底书（Word）')
    return
  }
  if (createForm.sponsorUserId == null) {
    ElMessage.warning('请选择有登录账号的主办人')
    return
  }
  const name = createDocFile.value.name || ''
  if (!/\.(doc|docx)$/i.test(name)) {
    ElMessage.warning('交底书必须是 Word 文件（.doc/.docx）')
    return
  }
  saving.value = true
  try {
    const created = await createDisclosureWorkflow(
      {
        autoGenerateNo: autoGenerateNo.value,
        disclosure: {
          ...createForm,
          entryUserId: currentUserId.value,
          entryUserName: currentUserName.value || '录入'
        }
      },
      createDocFile.value,
      createOtherFiles.value,
      {
        uploadUserId: currentUserId.value,
        uploadUserName: currentUserName.value || '录入'
      }
    )
    ElMessage.success(`录入成功 ${created.tempNo || ''} / ${created.internalNo || ''}`)
    createVisible.value = false
    await reload()
    openDetail(created)
  } catch (e) {
    ElMessage.error(e.message || '录入失败')
  } finally {
    saving.value = false
  }
}

async function onCopy(row) {
  try {
    await ElMessageBox.confirm(`复制交底「${row.disclosureName || row.tempNo}」？`, '复制确认')
  } catch {
    return
  }
  saving.value = true
  try {
    const created = await copyDisclosure({
      sourceId: row.id,
      copyAttachments: true,
      autoGenerateNo: true
    })
    ElMessage.success('复制成功')
    await reload()
    openDetail(created)
  } catch (e) {
    ElMessage.error(e.message || '复制失败')
  } finally {
    saving.value = false
  }
}

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detailTab.value = 'base'
  try {
    const data = await getDisclosureDetail(row.id)
    detail.value = data
    Object.keys(editForm).forEach((k) => delete editForm[k])
    Object.assign(editForm, { ...data.disclosure })
    nextStatus.value = String(data.disclosure.patentStatus ?? '')
    statusRemark.value = ''
    mailForm.templateCode = 'DISCLOSURE_CONTACT'
    mailForm.toEmail = data.disclosure.contactEmail || ''
    mailForm.subject = ''
    mailForm.content = ''
    mailForm.extraFiles = []
    // 默认勾选交底书；若无则全不选
    const docs = (data.attachments || []).filter((a) => a.bizType === 'DISCLOSURE_DOC')
    mailForm.attachmentIds = docs.length
      ? docs.map((a) => a.id)
      : (data.attachments || []).map((a) => a.id)
    await loadPreview()
  } catch (e) {
    ElMessage.error(e.message || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

async function refreshDetail() {
  if (!detail.value?.disclosure?.id) return
  const data = await getDisclosureDetail(detail.value.disclosure.id)
  detail.value = data
  Object.assign(editForm, { ...data.disclosure })
}

async function saveEdit() {
  saving.value = true
  try {
    const id = detail.value.disclosure.id
    const body = {
      disclosureName: editForm.disclosureName,
      requirement: editForm.requirement,
      applicant: editForm.applicant,
      inventor: editForm.inventor,
      sponsor: editForm.sponsor,
      agent: editForm.agent,
      contactPerson: editForm.contactPerson,
      contactEmail: editForm.contactEmail,
      remark: editForm.remark
    }
    await updateDisclosureWorkflow(id, body)
    ElMessage.success('已保存')
    await refreshDetail()
    await reload()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function submitStatus() {
  if (!nextStatus.value) {
    ElMessage.warning('请选择状态')
    return
  }
  saving.value = true
  try {
    await changeDisclosureStatus(detail.value.disclosure.id, {
      toStatus: nextStatus.value,
      remark: statusRemark.value,
      operatorUserId: currentUserId.value,
      operatorName: currentUserName.value || '用户'
    })
    ElMessage.success('状态已更新')
    await refreshDetail()
    await reload()
  } catch (e) {
    ElMessage.error(e.message || '状态更新失败')
  } finally {
    saving.value = false
  }
}

async function quickStatus(row, code) {
  try {
    await changeDisclosureStatus(row.id, {
      toStatus: code,
      remark: '快捷定稿',
      operatorUserId: currentUserId.value,
      operatorName: currentUserName.value || '用户'
    })
    ElMessage.success('已设为定稿')
    await reload()
  } catch (e) {
    ElMessage.error(e.message || '失败')
  }
}

async function onPendingReport(row) {
  try {
    await ElMessageBox.confirm(
      '将校验 XML包 + 五书Word，状态改为定稿待报，并同步写入申请专利表。是否继续？',
      '定稿待报'
    )
  } catch {
    return
  }
  saving.value = true
  try {
    const res = await markPendingReport(row.id, {
      operatorUserId: currentUserId.value,
      operatorName: currentUserName.value || '流程员',
      remark: '确认定稿待报'
    })
    ElMessage.success('定稿待报成功' + (res?.patent ? '，已同步P表' : ''))
    await reload()
    if (detailVisible.value) await refreshDetail()
  } catch (e) {
    ElMessage.error(e.message || '定稿待报失败')
  } finally {
    saving.value = false
  }
}

async function uploadAtt(e, bizType) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  if (!files.length) return
  saving.value = true
  try {
    for (const f of files) {
      await uploadDisclosureAttachment(detail.value.disclosure.id, f, bizType, { uploadUserName: '前端' })
    }
    ElMessage.success('上传成功')
    await refreshDetail()
  } catch (err) {
    ElMessage.error(err.message || '上传失败')
  } finally {
    saving.value = false
  }
}

async function removeAtt(row) {
  try {
    await ElMessageBox.confirm(`删除附件 ${row.fileName}？`)
  } catch {
    return
  }
  try {
    await deleteAttachment(row.id)
    ElMessage.success('已删除')
    await refreshDetail()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function uploadPkg(e, packageType) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  saving.value = true
  try {
    await uploadPackage(detail.value.disclosure.id, file, packageType, { uploadUserName: '主办' })
    ElMessage.success('申请包上传成功')
    await refreshDetail()
  } catch (err) {
    ElMessage.error(err.message || '上传失败')
  } finally {
    saving.value = false
  }
}

async function onConfirmPkg(row) {
  try {
    await confirmPackage(row.id, {
      confirmUserId: currentUserId.value,
      confirmUserName: currentUserName.value || '流程员'
    })
    ElMessage.success('已确认')
    await refreshDetail()
  } catch (e) {
    ElMessage.error(e.message || '确认失败')
  }
}

async function onTemplateChange() {
  await loadPreview()
}

async function loadPreview() {
  if (!detail.value?.disclosure?.id || !mailForm.templateCode) return
  try {
    const p = await previewMailTemplate(mailForm.templateCode, detail.value.disclosure.id)
    mailForm.subject = p.subject || ''
    mailForm.content = p.content || ''
  } catch (e) {
    // 模板预览失败不阻断
    console.warn(e)
  }
}

function onMailExtraChange(e) {
  mailForm.extraFiles = Array.from(e.target.files || [])
}

async function sendMail() {
  if (!mailForm.toEmail?.trim()) {
    ElMessage.warning('请填写收件人')
    return
  }
  if (!mailForm.subject?.trim() || !mailForm.content?.trim()) {
    ElMessage.warning('请填写主题和正文（可先加载模板预览）')
    return
  }
  if (currentUserId.value == null) {
    ElMessage.warning('发信需要登录用户信息，请重新登录')
    return
  }
  saving.value = true
  try {
    const disclosureId = detail.value.disclosure.id
    const attachmentIds = [...(mailForm.attachmentIds || [])]
    // 额外本地文件：先上传为其他附件，再纳入 attachmentIds
    for (const f of mailForm.extraFiles) {
      const att = await uploadDisclosureAttachment(disclosureId, f, 'DISCLOSURE_OTHER', {
        uploadUserId: currentUserId.value,
        uploadUserName: currentUserName.value || '用户'
      })
      if (att?.id != null) attachmentIds.push(att.id)
    }
    await sendWorkflowMail({
      disclosureId,
      templateCode: mailForm.templateCode || undefined,
      toEmails: mailForm.toEmail,
      subject: mailForm.subject,
      content: mailForm.content,
      attachmentIds,
      senderUserId: currentUserId.value,
      senderName: currentUserName.value || undefined
    })
    ElMessage.success('发送成功')
    mailForm.extraFiles = []
    await refreshDetail()
    // 刷新后保持已选中（含新上传）
    mailForm.attachmentIds = attachmentIds
  } catch (e) {
    ElMessage.error(e.message || '发送失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  refreshPerms()
  onlyMine.value = forceMine.value || currentUserId.value != null
  query.sponsorUserId = onlyMine.value ? currentUserId.value : ''
  await reload()
  try { agentList.value = await fetchAllAgents() } catch { agentList.value = [] }
  try { applicantList.value = await fetchAllApplicants() } catch { applicantList.value = [] }
  try { templates.value = await listMailTemplates() } catch { templates.value = [] }
  if (perms.canCreate) {
    await loadSponsors()
  }
})
</script>

<style scoped>
.dw-page { padding: 4px 8px 24px; }
.dw-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.title { font-size: 20px; font-weight: 600; }
.sub { color: #909399; font-size: 13px; margin-top: 4px; }
.filter-form { margin-bottom: 8px; }
.mb12 { margin-bottom: 12px; }
.mt12 { margin-top: 12px; }
.hint { color: #909399; font-size: 12px; margin-left: 8px; }
.hint.warn { color: #e6a23c; }
.mb8 { margin-bottom: 8px; }
.toolbar-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.detail-body { padding-right: 8px; }
.edit-form { max-width: 900px; }
.mail-attach-box {
  width: 100%;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 8px 12px;
  background: #fafafa;
}
.mail-attach-row { margin: 4px 0; }
h4 { margin: 8px 0; font-size: 14px; color: #303133; }
</style>
