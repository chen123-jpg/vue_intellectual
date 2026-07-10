import { http } from './patentApi.js'

export async function fetchAllAgents() {
  const response = await http.get('/agents')
  if (response.data.code === 200) {
    return response.data.data || []
  }
  throw new Error(response.data.message || '加载代理人列表失败')
}

export async function createAgent(name) {
  const response = await http.post('/agents', { name })
  if (response.data.code === 200) {
    return response.data.data
  }
  throw new Error(response.data.message || '新增代理人失败')
}

export async function updateAgent(id, name) {
  const response = await http.put(`/agents/${id}`, { name })
  if (response.data.code === 200) {
    return response.data.data
  }
  throw new Error(response.data.message || '更新代理人失败')
}

export async function deleteAgent(id) {
  const response = await http.delete(`/agents/${id}`)
  if (response.data.code === 200) {
    return response.data.data
  }
  throw new Error(response.data.message || '删除代理人失败')
}
