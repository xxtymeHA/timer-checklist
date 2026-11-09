const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

// 敏感信息与可变配置全部从云函数环境变量读取，不写进代码
const APPID = process.env.APPID
const APPSECRET = process.env.APPSECRET
const TEMPLATE_ID = process.env.TEMPLATE_ID

// 使用云开发提供的https请求，更安全
const https = require('https')

// 安全地获取 access_token
async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const parsedData = JSON.parse(data)
        if (!parsedData.access_token) {
          throw new Error('获取access_token失败: ' + JSON.stringify(parsedData))
        }
        resolve(parsedData.access_token)
      })
    }).on('error', reject)
  })
}

// 安全地发送模板消息
async function sendOne(accessToken, { openid, itemName, expiryDate, daysLeft, reminderContent, note, isEarly, earlyValue, earlyUnit }) {
  // 2. 对发送给用户的内容进行安全处理，防止XSS攻击
  const itemNameSafe = (itemName || '未命名').replace(/[<>&]/g, '') // 移除危险字符
  const unitMap = { minute: '分钟', hour: '小时', day: '天' }
  let reminderText
  if (isEarly) {
    reminderText = ('提前' + earlyValue + (unitMap[earlyUnit] || '分钟') + '提醒').substring(0, 20)
  } else {
    reminderText = (reminderContent && reminderContent.trim()) 
      ? reminderContent.trim().replace(/[<>&]/g, '').substring(0, 20) 
      : (daysLeft <= 0 ? '已过期，请及时处理' : '还剩' + daysLeft + '天')
  }  
  const noteText = (note && note.trim()) 
    ? note.trim().replace(/[<>&]/g, '').substring(0, 20) 
    : '来自计时清单'

  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`
  return await httpsPost(url, {
    touser: openid,
    template_id: TEMPLATE_ID,
    page: 'pages/index/index',
    data: {
      thing5: { value: itemNameSafe },
      date9: { value: expiryDate },
      thing2: { value: reminderText },
      thing11: { value: noteText }
    }
  })
}

// 使用云开发提供的httpsPost方法，更安全
async function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }
    const req = https.request(options, res => {
      let result = ''
      res.on('data', chunk => result += chunk)
      res.on('end', () => resolve(JSON.parse(result)))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

exports.main = async (event, context) => {
  if (!APPID || !APPSECRET || !TEMPLATE_ID) {
    return { success: false, error: '缺少环境变量 APPID / APPSECRET / TEMPLATE_ID' }
  }

  const db = cloud.database()
  
  // 3. 使用更安全的方法获取北京时间
  const now = new Date()
  const bjTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const todayStr = bjTime.toISOString().split('T')[0] // 使用ISO格式，更标准

  try {
    const accessToken = await getAccessToken()
    const queryResult = await db.collection('reminders')
      .where({ subscribed: true })
      .limit(100)
      .get()
    
    const items = queryResult.data
    console.log('查询数量:', items.length)
    
    const results = []
    for (const item of items) {
      try {
        const target = new Date(item.date + 'T00:00:00+08:00')
        const todayBj = new Date(bjTime.getTime())
        todayBj.setUTCHours(0, 0, 0, 0)
        const daysLeft = Math.round((target - todayBj) / (1000 * 60 * 60 * 24))
        const reminderDays = item.reminderDays || 3
    
        const [rh, rm] = (item.time || '09:00').split(':').map(Number)
        const nowHour = bjTime.getUTCHours()
        const nowMin = bjTime.getUTCMinutes()
    
        // ===== 到期提醒（独立判断）=====
        if (daysLeft >= 0 && daysLeft <= reminderDays) {
          if (nowHour > rh || (nowHour === rh && nowMin >= rm)) {
            const sentKey = todayStr + '_' + item._id
            if (item.lastSentDate !== sentKey) {
              const result = await sendOne(accessToken, {
                openid: item.openid,
                itemName: item.name,
                expiryDate: item.date + ' ' + (item.time || '09:00'),
                daysLeft,
                reminderContent: item.reminderContent || '',
                note: item.note || ''
              })
              await db.collection('reminders').doc(item._id).update({
                data: { lastSentDate: sentKey }
              })
              results.push({ id: item._id, result })
            }
          }
        }
    
        // ===== 提前提醒（独立判断，不依赖到期提醒）=====
        if (item.earlyReminderEnabled && item.earlyReminderValue > 0) {
          const targetDateTime = new Date(item.date + 'T' + (item.time || '09:00') + '+08:00')
          let offsetMs = 0
          if (item.earlyReminderUnit === 'minute') offsetMs = item.earlyReminderValue * 60 * 1000
          else if (item.earlyReminderUnit === 'hour') offsetMs = item.earlyReminderValue * 3600 * 1000
          else if (item.earlyReminderUnit === 'day') offsetMs = item.earlyReminderValue * 86400 * 1000
    
          const earlyTriggerTime = new Date(targetDateTime.getTime() - offsetMs)
          const earlyHourBj = earlyTriggerTime.getUTCHours()
          const earlyMinBj = earlyTriggerTime.getUTCMinutes()
          const earlyDateStr = earlyTriggerTime.toISOString().split('T')[0]
    
          const earlyTimeReached = nowHour > earlyHourBj || (nowHour === earlyHourBj && nowMin >= earlyMinBj)
          const earlySentKey = earlyDateStr + '_early_' + item._id
    
          if (earlyTimeReached && item.lastEarlySentDate !== earlySentKey) {
            const earlyResult = await sendOne(accessToken, {
              openid: item.openid,
              itemName: item.name,
              expiryDate: item.date + ' ' + (item.time || '09:00'),
              daysLeft,
              reminderContent: item.reminderContent || '',
              note: item.note || '',
              isEarly: true,
              earlyValue: item.earlyReminderValue,
              earlyUnit: item.earlyReminderUnit
            })
            await db.collection('reminders').doc(item._id).update({
              data: { lastEarlySentDate: earlySentKey }
            })
            results.push({ id: item._id + '_early', result: earlyResult })
          }
        }
    
      } catch (e) {
        results.push({ id: item._id, error: e.message })
      }
    }    
    
    return { success: true, processed: results.length, results }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
