function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() {
  return formatDate(new Date())
}

function getDaysDiff(dateStr, mode) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target - now) / (1000 * 60 * 60 * 24))
  return mode === 'countdown' ? diff : -diff
}

function formatDisplay(dateStr, mode) {
  const days = getDaysDiff(dateStr, mode)
  if (mode === 'countdown') {
    if (days < 0)  return { label: '已过期', days: Math.abs(days), status: 'expired' }
    if (days === 0) return { label: '今天到期', days: 0, status: 'today' }
    if (days <= 7)  return { label: '还剩', days, status: 'urgent' }
    if (days <= 30) return { label: '还剩', days, status: 'warning' }
    return { label: '还剩', days, status: 'safe' }
  } else {
    if (days < 0)  return { label: '未开始', days: 0, status: 'safe' }
    if (days === 0) return { label: '第 1 天', days: 1, status: 'countup' }
    return { label: '已坚持', days, status: 'countup' }
  }
}

module.exports = { getDaysDiff, formatDisplay, formatDate, todayStr }
