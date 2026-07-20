import { http, unwrap, API_BASE } from './http.js'

const BASE = '/api/disclosure-workflow'

// ---------- 交底 ----------

/**
 * 录入交底（强制交底书 Word + 可选其他附件）
 * @param {object} payload { autoGenerateNo, disclosure }
 * @param {File} disclosureDoc Word 文件
 * @param {File[]} [otherFiles]
 * @param {{ uploadUserId?: number, uploadUserName?: string }} [meta]
 */
export async function createDisclosureWorkflow(payload, disclosureDoc, otherFiles = [], meta = {}) {
  if (!disclosureDoc) {
    throw new Error('交底书（Word）不能为空')
  }
  const fd = new FormData()
  fd.append('data', JSON.stringify(payload))
  fd.append('disclosureDoc', disclosureDoc)
  for (const f of otherFiles || []) {
    if (f) fd.append('otherFiles', f)
  }
  if (meta.uploadUserId != null) fd.append('uploadUserId', meta.uploadUserId)
  if (meta.uploadUserName) fd.append('uploadUserName', meta.uploadUserName)
  return unwrap(await http.post(`${BASE}/disclosures/with-attachments`, fd))
}

export async function copyDisclosure(payload) {
  return unwrap(await http.post(`${BASE}/disclosures/copy`, payload))
}

export async function updateDisclosureWorkflow(id, body) {
  return unwrap(await http.put(`${BASE}/disclosures/${id}`, body))
}

export async function searchDisclosures(query = {}) {
  return unwrap(await http.post(`${BASE}/disclosures/search`, query)) || []
}

export async function listBySponsor(sponsorUserId) {
  return unwrap(await http.get(`${BASE}/disclosures/by-sponsor/${sponsorUserId}`)) || []
}

export async function getDisclosureDetail(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}`))
}

export async function changeDisclosureStatus(id, body) {
  return unwrap(await http.post(`${BASE}/disclosures/${id}/status`, body))
}

export async function markPendingReport(id, body = {}) {
  return unwrap(await http.post(`${BASE}/disclosures/${id}/pending-report`, body))
}

// ---------- 附件 ----------

export async function uploadDisclosureAttachment(id, file, bizType = 'DISCLOSURE_OTHER', meta = {}) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('bizType', bizType)
  if (meta.uploadUserId != null) fd.append('uploadUserId', meta.uploadUserId)
  if (meta.uploadUserName) fd.append('uploadUserName', meta.uploadUserName)
  return unwrap(await http.post(`${BASE}/disclosures/${id}/attachments`, fd))
}

export async function listAttachments(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}/attachments`)) || []
}

export async function deleteAttachment(attachmentId) {
  return unwrap(await http.delete(`${BASE}/attachments/${attachmentId}`))
}

// ---------- 申请包 ----------

export async function uploadPackage(id, file, packageType, meta = {}) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('packageType', packageType)
  if (meta.uploadUserId != null) fd.append('uploadUserId', meta.uploadUserId)
  if (meta.uploadUserName) fd.append('uploadUserName', meta.uploadUserName)
  return unwrap(await http.post(`${BASE}/disclosures/${id}/packages`, fd))
}

export async function listPackages(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}/packages`)) || []
}

export async function confirmPackage(packageId, meta = {}) {
  const params = new URLSearchParams()
  if (meta.confirmUserId != null) params.append('confirmUserId', meta.confirmUserId)
  if (meta.confirmUserName) params.append('confirmUserName', meta.confirmUserName)
  const q = params.toString()
  return unwrap(await http.post(`${BASE}/packages/${packageId}/confirm${q ? '?' + q : ''}`))
}

// ---------- 邮件 ----------

export async function listMailTemplates() {
  return unwrap(await http.get(`${BASE}/mail-templates`)) || []
}

export async function previewMailTemplate(code, disclosureId) {
  return unwrap(await http.get(`${BASE}/mail-templates/${encodeURIComponent(code)}/preview`, {
    params: { disclosureId }
  }))
}

/**
 * 工作流发信：读模板可改内容，附件用交底附件 ID 列表（可增删）
 * @param {{
 *   disclosureId: number,
 *   templateCode?: string,
 *   toEmails: string,
 *   ccEmails?: string,
 *   subject: string,
 *   content: string,
 *   attachmentIds?: number[],
 *   senderUserId?: number,
 *   senderName?: string
 * }} payload
 */
export async function sendWorkflowMail(payload) {
  return unwrap(await http.post(`${BASE}/mail/send`, {
    disclosureId: payload.disclosureId,
    templateCode: payload.templateCode || undefined,
    toEmails: payload.toEmails,
    ccEmails: payload.ccEmails || undefined,
    subject: payload.subject,
    content: payload.content,
    attachmentIds: payload.attachmentIds || [],
    senderUserId: payload.senderUserId,
    senderName: payload.senderName
  }))
}

export async function listMailLogs(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}/mail-logs`)) || []
}

// ---------- 附属 ----------

export async function listFees(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}/fees`)) || []
}

export async function listInvoices(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}/invoices`)) || []
}

export async function listStatusLogs(id) {
  return unwrap(await http.get(`${BASE}/disclosures/${id}/status-logs`)) || []
}

/** 文件访问完整 URL */
export function fileAbsoluteUrl(fileUrl) {
  if (!fileUrl) return ''
  if (fileUrl.startsWith('http')) return fileUrl
  return API_BASE + fileUrl
}

/** 交底状态选项（与后端 PatentStatus 一致） */
export const PATENT_STATUS_OPTIONS = [
  { code: '0', desc: '接收交底书' },
  { code: '1', desc: '联系发明人' },
  { code: '2', desc: '检索交底书' },
  { code: '3', desc: '撤回' },
  { code: '4', desc: '打回' },
  { code: '5', desc: '修改交底' },
  { code: '6', desc: '一稿撰写中' },
  { code: '7', desc: '一稿待反馈' },
  { code: '8', desc: 'N稿撰写中' },
  { code: '9', desc: 'N稿待反馈' },
  { code: '10', desc: '待定稿' },
  { code: '11', desc: '定稿' },
  { code: '12', desc: '定稿待报' },
  { code: '13', desc: '提交待受理' },
  { code: '14', desc: '受理' }
]

export function statusLabel(code) {
  if (code === undefined || code === null || code === '') return ''
  const s = String(code)
  const hit = PATENT_STATUS_OPTIONS.find((o) => o.code === s || o.desc === s)
  return hit ? hit.desc : s
}

export function isFinalizedOrAfter(status) {
  const hit = PATENT_STATUS_OPTIONS.find((o) => o.code === String(status) || o.desc === status)
  if (!hit) return status === '定稿' || status === '定稿待报'
  return Number(hit.code) >= 11
}
