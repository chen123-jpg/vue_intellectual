import axios from 'axios'

/** 后端地址（与 Spring Boot 一致） */
export const API_BASE = 'http://localhost:8080'

/**
 * 统一 HTTP：JSON + Cookie 会话（登录后邮件等接口需要）
 */
export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8'
  }
})

http.interceptors.request.use((config) => {
  // FormData 让浏览器自动带 multipart boundary
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type']
    }
  } else if (config.data && typeof config.data === 'object' && !(config.data instanceof URLSearchParams)) {
    // 保持中文不转 Unicode
    config.transformRequest = [(data) => JSON.stringify(data)]
  }
  return config
})

/** 解包 Result { code, message, data } */
export function unwrap(res) {
  const body = res?.data
  if (body && typeof body === 'object' && 'code' in body) {
    if (body.code === 200) return body.data
    throw new Error(body.message || '请求失败')
  }
  return body
}
