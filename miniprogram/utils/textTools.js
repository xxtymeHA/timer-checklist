// 字数统计
function countText(text) {
  if (!text) return { total: 0, chinese: 0, english: 0, number: 0, punctuation: 0, space: 0 }
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const english = (text.match(/[a-zA-Z]/g) || []).length
  const number = (text.match(/[0-9]/g) || []).length
  const space = (text.match(/\s/g) || []).length
  const punctuation = text.length - chinese - english - number - space
  return { total: text.length, chinese, english, number, punctuation, space }
}

// 数字转中文大写
function numberToChinese(numStr) {
  const num = parseFloat(numStr)
  if (isNaN(num)) return '请输入有效数字'
  const fraction = ['角', '分']
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']]
  const head = num < 0 ? '负' : ''
  const abs = Math.abs(num)
  let s = ''
  const decPart = Math.round((abs % 1) * 100)
  const jiao = Math.floor(decPart / 10)
  const fen = decPart % 10
  if (jiao > 0) s += digit[jiao] + fraction[0]
  if (fen > 0) s += digit[fen] + fraction[1]
  if (s === '') s = '整'
  let intPart = Math.floor(abs)
  if (intPart === 0) return head + '零元' + s
  let intStr = ''
  for (let i = 0; i < unit[0].length && intPart > 0; i++) {
    let p = ''
    for (let j = 0; j < unit[1].length && intPart > 0; j++) {
      p = digit[intPart % 10] + unit[1][j] + p
      intPart = Math.floor(intPart / 10)
    }
    intStr = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + intStr
  }
  return head + intStr.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整') + s
}

// 基于 LCS 算法的逐字符文本对比
function tokenize(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    // 英文单词 + 数字连续读取
    if (/[a-zA-Z0-9]/.test(text[i])) {
      let word = ''
      while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) {
        word += text[i]
        i++
      }
      tokens.push(word)
    } else {
      // 中文、标点、空格、换行各自单独作为一个 token
      tokens.push(text[i])
      i++
    }
  }
  return tokens
}

function diffText(textA, textB) {
  const a = tokenize(textA)
  const b = tokenize(textB)
  const m = a.length
  const n = b.length

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const result = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'same', text: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', text: b[j - 1] })
      j--
    } else {
      result.unshift({ type: 'removed', text: a[i - 1] })
      i--
    }
  }

  const merged = []
  for (const item of result) {
    if (merged.length > 0 && merged[merged.length - 1].type === item.type) {
      merged[merged.length - 1].text += item.text
    } else {
      merged.push({ ...item })
    }
  }

  return merged
}

module.exports = { countText, numberToChinese, diffText }
