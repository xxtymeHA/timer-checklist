const config = require('./config')

App({
  globalData: {
    version: '1.0.0'
  },
  onLaunch() {
    if (!config.cloudEnv) {
      console.warn('未配置云开发环境 ID：请复制 miniprogram/config.example.js 为 miniprogram/config.js 后填写 cloudEnv')
    }
    wx.cloud.init({
      env: config.cloudEnv,
      traceUser: true
    })
    const accountInfo = wx.getAccountInfoSync()
    this.globalData.version = accountInfo.miniProgram.version || '开发版'
  }
})
