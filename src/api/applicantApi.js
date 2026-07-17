import { http } from './http.js'

export async function fetchAllApplicants() {
  const response = await http.get('/applicants')
  if (response.data.code === 200) {
    return response.data.data || []
  }
  throw new Error(response.data.message || '加载申请人列表失败')
}

export async function createApplicant(name) {
  const response = await http.post('/applicants', { name })
  if (response.data.code === 200) {
    return response.data.data
  }
  throw new Error(response.data.message || '新增申请人失败')
}

export async function updateApplicant(id, name) {
  const response = await http.put(`/applicants/${id}`, { name })
  if (response.data.code === 200) {
    return response.data.data
  }
  throw new Error(response.data.message || '更新申请人失败')
}

export async function deleteApplicant(id) {
  const response = await http.delete(`/applicants/${id}`)
  if (response.data.code === 200) {
    return response.data.data
  }
  throw new Error(response.data.message || '删除申请人失败')
}
