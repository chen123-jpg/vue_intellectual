import axios from 'axios'

// ============================================================
// 全局Axios实例配置（统一UTF-8编码，兼容utf8mb4数据库）
// ============================================================
/** 后端 API 基础地址 */
const API_BASE = 'http://localhost:8080'

// 创建统一axios实例，全局编码配置
const http = axios.create({
  baseURL: API_BASE,
  headers: {
    // 声明请求体编码为utf-8，后端正确解析中文
    'Content-Type': 'application/json; charset=utf-8'
  },
  transformRequest: [(data) => {
    if (!data) return data
    // 不转义中文为Unicode，直接传输原始中文，适配utf8mb4
    return JSON.stringify(data)
  }]
})

/** 前端分类名 → 后端资源路径 */
const SHEET_TO_RESOURCE = {
  '1-专利新申请': 'patent-new-applications',
  '1.2-补漏专利': 'patent-supplementaries',
  '2-中间著变专利（有重复）': 'patent-intermediate-changes',
  '3-PCT国际申请': 'patent-pcts',
  '4-复审无效专利': 'patent-reexaminations'
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
  const response = await http({
    url,
    method,
    data
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
  const result = await request(`${resource}?page=1&page_size=100`, 'GET')
  if (result.code === 200) {
    const rawList = result.data?.list || []
    return rawList.map((row) => convertKeys(row, toCamelCase))
  }
  throw new Error(result.message || '加载失败')
}

/**
 * 一次性获取所有分类的专利列表
 * @param {string[]} sheetNames - 分类名称数组
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
  const result = await request(`${resource}`, 'POST', formData)
  if (result.code !== 200) throw new Error(result.message || '新增失败')
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
  const result = await request(`${resource}/${id}`, 'PUT', formData)
  if (result.code !== 200) throw new Error(result.message || '更新失败')
  return result
}

/**
 * 删除一条专利记录
 * @param {string} sheetName - 前端分类名
 * @param {number} id        - 记录 ID
 * @returns {Promise<object>} 后端响应
 */
export async function deleteRecord(sheetName, id) {
  const resource = SHEET_TO_RESOURCE[sheetName]
  const result = await request(`${resource}/${id}`, 'DELETE')
  if (result.code !== 200) throw new Error(result.message || '删除失败')
  return result
}

/**
 * 上传文件到后端
 * @param {File} file
 * @returns {Promise<string>} 返回带文件名的 URL，如 "/files/abc.pdf?name=原始文件名.pdf"
 */
export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  // 直接调用 axios，不设置 Content-Type，浏览器自动生成 multipart/form-data
  const response = await axios.post(`${API_BASE}/upload`, formData)

  if (response.data.code === 200) {
    // 后端返回的是字符串 URL（包含 ?name=...）
    return response.data.data
  }
  throw new Error(response.data.message || '上传失败')
}

/**
 * 从文件 URL 中解析原始文件名（?name=xxx）
 * @param {string} url - 如 "/files/abc.pdf?name=原始文件名.pdf"
 * @returns {string|null} 原始文件名，若不存在返回 null
 */
export function getFileNameFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const queryIndex = url.indexOf('?')
    if (queryIndex === -1) return null
    const queryString = url.substring(queryIndex + 1)
    const params = new URLSearchParams(queryString)
    return params.get('name')
  } catch {
    return null
  }
}

// 导出 http 和 API_BASE，供外部使用
export { http, API_BASE }