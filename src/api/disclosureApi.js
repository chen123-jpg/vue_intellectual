import { http } from './patentApi.js'

export async function fetchAllDisclosures() {
  const response = await http.get('/patent-disclosure')
  return response.data
}

export async function fetchDisclosurePage(pageNum = 1, pageSize = 10) {
  const response = await http.get('/patent-disclosure/page', {
    params: { pageNum, pageSize }
  })
  return response.data
}

export async function fetchDisclosureById(id) {
  const response = await http.get(`/patent-disclosure/${id}`)
  return response.data
}

export async function createDisclosure(data) {
  const response = await http.post('/patent-disclosure', data)
  return response.data
}

export async function updateDisclosure(data) {
  const response = await http.put('/patent-disclosure', data)
  return response.data
}

export async function deleteDisclosure(id) {
  const response = await http.delete(`/patent-disclosure/${id}`)
  return response.data
}

export async function searchDisclosures(params) {
  const response = await http.post('/patent-disclosure/list', params)
  return response.data
}

export async function searchDisclosuresByParams(params) {
  const response = await http.post('/patent-disclosure/listByParams', params)
  return response.data
}

export async function countDisclosures(params) {
  const response = await http.post('/patent-disclosure/count', params)
  return response.data
}
