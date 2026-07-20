/** 当前登录用户本地缓存（含员工类型） */

const USER_KEY = 'auth_user'

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(USER_KEY)
    return
  }
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      id: user.id ?? user.userId,
      email: user.email,
      nickName: user.nickName,
      employeeId: user.employeeId,
      employeeName: user.employeeName,
      empNo: user.empNo,
      department: user.department,
      employeeStatus: user.employeeStatus,
      roles: user.roles || [],
      roleNames: user.roleNames || []
    })
  )
}

export function clearCurrentUser() {
  localStorage.removeItem(USER_KEY)
}

export function getCurrentUserId() {
  const u = getCurrentUser()
  if (!u || u.id == null || u.id === '') return null
  const n = Number(u.id)
  return Number.isNaN(n) ? null : n
}

export function getCurrentUserName() {
  const u = getCurrentUser()
  if (!u) return ''
  return u.employeeName || u.nickName || u.email || ''
}

export function getCurrentRoles() {
  const u = getCurrentUser()
  return Array.isArray(u?.roles) ? u.roles.map((r) => String(r).toUpperCase()) : []
}

export function hasRole(...codes) {
  const roles = getCurrentRoles()
  if (roles.includes('ADMIN')) return true
  return codes.some((c) => roles.includes(String(c).toUpperCase()))
}

export function isAdmin() {
  return getCurrentRoles().includes('ADMIN')
}

/** 仅主办（无录入/流程/管理） */
export function isSponsorOnly() {
  const roles = getCurrentRoles()
  if (roles.includes('ADMIN')) return false
  const sponsor = roles.includes('SPONSOR')
  const other = roles.includes('ENTRY') || roles.includes('PROCESS')
  return sponsor && !other
}

export function canCreateDisclosure() {
  return hasRole('ENTRY', 'ADMIN')
}

export function canCopyDisclosure() {
  return hasRole('ENTRY', 'ADMIN')
}

export function canChangeStatusAsSponsor() {
  return hasRole('SPONSOR', 'ADMIN')
}

export function canUploadPackage() {
  return hasRole('SPONSOR', 'ADMIN')
}

export function canConfirmPackage() {
  return hasRole('PROCESS', 'ADMIN')
}

export function canPendingReport() {
  return hasRole('PROCESS', 'ADMIN')
}

export function canSendMail() {
  return hasRole('SPONSOR', 'ADMIN')
}

export function canManageEmployees() {
  return hasRole('ADMIN')
}
