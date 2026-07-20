import { http, unwrap } from './http.js'

/** 员工类型字典 */
export async function listEmployeeTypes(onlyEnabled = true) {
  return unwrap(await http.get('/api/employees/types', { params: { onlyEnabled } })) || []
}

export async function saveEmployeeType(body) {
  return unwrap(await http.post('/api/employees/types', body))
}

export async function listEmployees({ keyword, status, typeCode } = {}) {
  return unwrap(await http.get('/api/employees', {
    params: {
      keyword: keyword || undefined,
      status: status || undefined,
      typeCode: typeCode || undefined
    }
  })) || []
}

export async function listEmployeesByType(typeCode) {
  return unwrap(await http.get(`/api/employees/by-type/${encodeURIComponent(typeCode)}`)) || []
}

export async function getEmployee(id) {
  return unwrap(await http.get(`/api/employees/${id}`))
}

export async function saveEmployee(body) {
  return unwrap(await http.post('/api/employees', body))
}

export async function fetchEmployeeMe() {
  return unwrap(await http.get('/api/employees/me'))
}

export const ROLE_LABELS = {
  ADMIN: '管理员',
  ENTRY: '录入人员',
  SPONSOR: '主办人',
  PROCESS: '流程人员',
  CONTACT: '联系人'
}
