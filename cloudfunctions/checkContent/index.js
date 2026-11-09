const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const APPID = process.env.APPID
const APPSECRET = process.env.APPSECRET

async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const parsed = JSON.parse(data)
        if (!parsed.access_token) reject(new Error('获取token失败: ' + JSON.stringify(parsed)))
        else resolve(parsed.access_token)
      })
    }).on('error', reject)
  })
}

async function msgSecCheck(accessToken, content, openid) {
  const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`
  const body = JSON.stringify({
    content,
    openid,
    scene: 2,    // 1=资料 2=评论 3=论坛 4=社交，填2适合备注/名称场景
    version: 2   // 必须传2，使用新版接口
  })
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(options, res => {
      let result = ''
      res.on('data', chunk => result += chunk)
      res.on('end', () => resolve(JSON.parse(result)))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  const { content, openid } = event
  if (!content || !content.trim()) return { pass: true }

  try {
    const accessToken = await getAccessToken()
    const result = await msgSecCheck(accessToken, content, openid)

    // result.result.suggest: 'pass' / 'review' / 'risky'
    if (result.errcode === 0) {
      const suggest = result.result && result.result.suggest
      return { pass: suggest === 'pass', suggest, detail: result.detail }
    } else {
      // 接口异常时放行，避免影响正常用户
      console.error('msgSecCheck errcode:', result.errcode, result.errmsg)
      return { pass: true, error: result.errmsg }
    }
  } catch (e) {
    console.error('checkContent error:', e)
    return { pass: true, error: e.message }
  }
}
