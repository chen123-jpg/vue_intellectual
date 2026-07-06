import axios from 'axios'

// ============================================================
// 配置
// ============================================================

/** 后端 API 基础地址 */
const API_BASE = 'http://localhost:8080'

/** 前端分类名 → 后端资源路径 */
const SHEET_TO_RESOURCE = {
  '1-专利新申请':               'patent-new-applications',
  '1.2-补漏专利':               'patent-supplementaries',
  '2-中间著变专利（有重复）':    'patent-intermediate-changes',
  '3-PCT国际申请':              'patent-pcts',
  '4-复审无效专利':             'patent-reexaminations'
}

// ============================================================
// 工具函数：snake_case ↔ camelCase
// ============================================================

/** snake_case → camelCase */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/** camelCase → snake_case */
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

/** 递归转换对象所有 key */
function convertKeys(obj, converter) {
  if (Array.isArray(obj)) return obj.map((item) => convertKeys(item, converter))
  if (obj !== null && typeof obj === 'object') {
    const result = {}
    for (const key of Object.keys(obj)) {
      result[converter(key)] = convertKeys(obj[key], converter)
    }
    return result
  }
  return obj
}

// ============================================================
// 基础请求封装
// ============================================================

/**
 * 通用 HTTP 请求
 * @param {string}  url     - 请求地址
 * @param {string}  method  - GET | POST | PUT | DELETE
 * @param {object}  [data]  - 请求体（仅 POST/PUT）
 * @returns {Promise<object>} 响应体
 */
async function request(url, method, data = null) {
  const response = await axios({
    url,
    method,
    data,
    headers: { 'Content-Type': 'application/json' }
  })
  return response.data
}

// ============================================================
// 业务 API：专利 CRUD
// ============================================================

/**
 * 获取指定分类的专利列表（单页，最多100条）
 * @param {string} sheetName - 前端分类名
 * @returns {Promise<Array>} 已转为 camelCase 的记录列表
 */
export async function fetchSheetList(sheetName) {
  const resource = SHEET_TO_RESOURCE[sheetName]
  const result = await request(`${API_BASE}/${resource}?page=1&page_size=100`, 'GET')
  if (result.code === 0) {
    const rawList = result.data?.list || []
    return rawList.map((row) => convertKeys(row, toCamelCase))
  }
  throw new Error(result.message || '加载失败')
}

/**
 * 一次性获取所有分类的专利列表
 * @returns {Promise<object>} { 分类名: 记录数组, ... }
 */
export async function fetchAllSheets(sheetNames) {
  const map = {}
  const tasks = sheetNames.map(async (name) => {
    map[name] = await fetchSheetList(name)
  })
  await Promise.all(tasks)
  return map
}

/**
 * 新增一条专利记录
 * @param {string} sheetName - 前端分类名
 * @param {object} formData  - camelCase 格式的表单数据
 * @returns {Promise<object>} 后端响应
 */
export async function createRecord(sheetName, formData) {
  const resource = SHEET_TO_RESOURCE[sheetName]
  const data = convertKeys(formData, toSnakeCase)
  const result = await request(`${API_BASE}/${resource}`, 'POST', data)
  if (result.code !== 0) throw new Error(result.message || '新增失败')
  return result
}

/**
 * 更新一条专利记录
 * @param {string} sheetName - 前端分类名
 * @param {number} id        - 记录 ID
 * @param {object} formData  - camelCase 格式的变更数据
 * @returns {Promise<object>} 后端响应
 */
export async function updateRecord(sheetName, id, formData) {
  const resource = SHEET_TO_RESOURCE[sheetName]
  const data = convertKeys(formData, toSnakeCase)
  const result = await request(`${API_BASE}/${resource}/${id}`, 'PUT', data)
  if (result.code !== 0) throw new Error(result.message || '更新失败')
  return result
}

/**
 * 删除一条专利记录
 * @param {string} sheetName - 前端分类名
 * @param {number} id        - 记录 ID
 * @returns {Promise<object>} 后端响应
 */
export async function deleteRecord(sheetName, id) {
  const result = await request(`${API_BASE}/${SHEET_TO_RESOURCE[sheetName]}/${id}`, 'DELETE')
  if (result.code !== 0) throw new Error(result.message || '删除失败')
  return result
}
