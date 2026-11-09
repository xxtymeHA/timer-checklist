const storage = require('../../utils/storage')
const { formatDisplay, todayStr } = require('../../utils/timeHelper')

Page({
  data: {
    items: [],
    swipeOpenId: null,
    completeOpenId: null,
    swipeCatching: false,
    swipeOverDelete: false,
    swipeCompleteId: null,    // 当前正在向右滑的卡片id
    swipeCompleteOffset: 0,   // 向右滑动距离
    swipeOverComplete: false, // 是否超过完成阈值
    undoItem: null,
    showUndo: false,
    undoCountdown: 5.0,    
    emojiInputValue: '',
    showModal: false,
    emojiFocused: false,
    modalHeight: null,
    defaultEmoji: '📦',
    modalActive: false,
    undoVisible: false,
    showConfirmModal: false,
    confirmActive: false,
    isExpired: false,       // 是否已过期
    undoHiding: false,
    modalDragOffset: 0,
    confirmDragOffset: 0,
    subscribedModalVisible: false,
    subscribedModalActive: false,
    subscribedModalHiding: false,
    subscribedItems: [], 
    showClearBar: false,
    earlyReminderUnits: ['分钟前', '小时前', '天前'],
    earlyReminderUnitIndex: 0,
    clearVisible: false,
    clearCount: 0,
    undoProgressWidth: 100,
    form: {
      name: '', 
      customEmoji: '',
      mode: 'countdown',
      date: '', time: '09:00',
      note: '', reminderContent: '',
      earlyReminderEnabled: false,
      earlyReminderValue: 10,
      earlyReminderUnit: 'minute',      
      subscribed: false,
      countupReminderEnabled: false,
      countupReminderValue: 7,
      countupReminderUnit: 'day',
      countupReminderTime: '09:00',
      countupReminderNextDate: ''
    },
    countupReminderError: '',
    editId: null,
    touchStartY: 0,
    confirmTouchStartY: 0,
    countupUnits: ['天后', '个月后'],
    countupUnitIndex: 0,
    // 排序相关
    sortMode: 'default',
    showSortModal: false,
    sortModalActive: false,
    sortModalDragOffset: 0,
    showSortUndo: false,
    sortUndoVisible: false,
    sortUndoCountdown: '15.0',
    sortUndoProgressWidth: 100,
    prevSortMode: null,
// 横幅层叠
undoStackOffset: 0,
sortUndoStackOffset: 0,

  },  

  _timer: null,
  _closeTimer: null,
  _closeConfirmTimer: null,
  _undoTimer: null,
  _undoCountdownTimer: null,
  _clearBarTimer: null,
  _undoBatch: [],
  _undoBatchStart: null,
  _undoBatchOrder: null,
  _sortUndoTimer: null,
  _sortUndoCountdownTimer: null,

  
  onLoad() {
    const today = todayStr()
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const sortConfig = storage.getSortConfig()
    this.setData({
      'form.date': today,
      'form.time': hh + ':' + mm,
      sortMode: sortConfig.mode || 'default'
    })
  },
  
  onShow() {
    this.setData({
      showModal: false, modalActive: false,
      showConfirmModal: false, confirmActive: false,
      modalDragOffset: 0, confirmDragOffset: 0
    })
    this.loadItems()
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    const self = this
    this._timer = setInterval(function() {
      if (!self._timer) return
      try {
        const pages = getCurrentPages()
        if (!pages || pages.length === 0) {
          clearInterval(self._timer); self._timer = null; return
        }
        self.loadItems()
      } catch (e) {
        clearInterval(self._timer); self._timer = null
      }
    }, 60000)
  },
  
  onHide() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null }
    if (this._closeConfirmTimer) { clearTimeout(this._closeConfirmTimer); this._closeConfirmTimer = null }
    if (this._clearBarTimer) { clearTimeout(this._clearBarTimer); this._clearBarTimer = null }
    this.setData({ showModal: false, modalActive: false, showConfirmModal: false, confirmActive: false })
  },
  
  onUnload() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },

  loadItems() {
    try {
      const raw = storage.getItems()
      const items = raw.map(item => {
        const display = formatDisplay(item.date, item.mode)
        // 优先使用自定义emoji，否则自动匹配
        const emoji = item.customEmoji || this.getCategoryEmoji(item.name)
        return { ...item, display, emoji }
      })
      this.setData({ items: this.sortItems(items) })
    } catch (e) {
      console.error('loadItems error', e)
    }
  },
  
  getCategoryEmoji(name) {
    if (!name) return '📦';
  
    // 规则配置：优先级高的放前面（如：护肤膏应属于护肤而非药品）
    const categoryMap = [
        // 1. 生日/纪念/周年/节日
        { pattern: /生日|生辰|寿辰|纪念|周年|纪念日|节日/, emoji: '🎂' },
        // 2. 考试/学历相关
        { pattern: /考试|高考|中考|考研|考级|期末|考/, emoji: '📚' },
        // 3. 婚姻相关
        { pattern: /结婚|婚礼|婚期|订婚/, emoji: '💍' },
        // 4. 旅行/度假
        { pattern: /旅行|旅游|出游|度假|日游/, emoji: '🏖️' },
        // 5. 工作/职场
        { pattern: /工作|入职|离职|面试/, emoji: '💼' },
        // 6. 健身/运动/打卡/减肥
        { pattern: /健身|运动|减肥|跑步|戒|坚持|打卡/, emoji: '💪' },
        // 7. 学习/培训
        { pattern: /学习|课程|培训|书/, emoji: '📖' },
        // 8. 会议/活动
        { pattern: /会议|开会|活动/, emoji: '📅' },
        // 9. 护肤/个人护理
        { pattern: /护肤|面膜|精华|乳液|防晒|牙膏|洗发|沐浴/, emoji: '🧴' },
        // 10. 影视/娱乐/阅读
        { pattern: /电影|剧|动漫|听歌/, emoji: '🎬' },
        // 11. 饮食/零食
        { pattern: /食|吃|零食|饮|奶|肉|菜|水果|薯片/, emoji: '🍱' },
        // 12. 药品/体检
        { pattern: /药|胶囊|颗粒|冲剂|体检/, emoji: '💊' },
        // 13. 证件相关
        { pattern: /驾照|证件|护照|身份证/, emoji: '📋' },
        // 14. 车辆相关
        { pattern: /车|年检|加油/, emoji: '🚗' },
        // 15. 电器/数码
        { pattern: /电器|手机|电脑|家电|数码/, emoji: '💻' },
        // 16. 宠物相关
        { pattern: /猫|狗|宠物/, emoji: '🐱' },
        // 17. 财务/收支
        { pattern: /工资|还款|账单|报销/, emoji: '💰' }
      ];
  
    // 简洁的查找逻辑
    const found = categoryMap.find(item => item.pattern.test(name));
    return found ? found.emoji : '📦';
  },


  sortItems(items) {
    const { sortMode } = this.data
  
  
    if (sortMode === 'createdAt') {
      return items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    }
  
    if (sortMode === 'name') {
      return items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh'))
    }
  
    // default：紧迫程度 → 剩余天数 → 创建时间
    const order = { expired: 0, today: 1, urgent: 2, warning: 3, safe: 4, countup: 5 }
    return items.sort((a, b) => {
      const oa = order[a.display.status] !== undefined ? order[a.display.status] : 9
      const ob = order[b.display.status] !== undefined ? order[b.display.status] : 9
      if (oa !== ob) return oa - ob
    
      // 同为已过期：过期越久越靠前（date 越小越靠前）
      if (a.display.status === 'expired' && b.display.status === 'expired') {
        return new Date(a.date) - new Date(b.date)
      }
    
      // 其他状态：剩余天数少的靠前
      const da = a.display?.days ?? 9999
      const db = b.display?.days ?? 9999
      if (da !== db) return da - db
    
      // 天数相同：创建时间早的靠前
      return (a.createdAt || 0) - (b.createdAt || 0)
    })    
  },
  
  openModal() {
    if (this._closeTimer) {
      clearTimeout(this._closeTimer); this._closeTimer = null
    }
    const today = todayStr()
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
  
    this.setData({ 
      showModal: true, 
      modalActive: false, 
      modalDragOffset: 0, 
      editId: null, 
      isExpired: false,
      defaultEmoji: '📦',
      emojiInputValue: '',
      form: {
        name: '',
        customEmoji: '',
        mode: 'countdown',
        date: today,
        time: hh + ':' + mm,
        note: '',
        reminderContent: '',
        earlyReminderEnabled: false,
        earlyReminderValue: 10,
        earlyReminderUnit: 'minute',
        subscribed: false,
        countupReminderEnabled: false,
        countupReminderValue: 7,
        countupReminderUnit: 'day',
        countupReminderTime: '09:00',
        countupReminderNextDate: ''
      }
    },)

  setTimeout(() => {
    this.setData({ modalActive: true })
  }, 30)
},
  
closeModal() {
  this.setData({ modalActive: false, modalDragOffset: 0, modalHeight: null })
  if (this._closeTimer) clearTimeout(this._closeTimer)
  this._closeTimer = setTimeout(() => {
    this.setData({ showModal: false })
    this._closeTimer = null
  }, 360)
},

  
  subscribeAll() {
    if (this._closeConfirmTimer) { clearTimeout(this._closeConfirmTimer); this._closeConfirmTimer = null }
    this.setData({ showConfirmModal: true, confirmActive: false, confirmDragOffset: 0 })
    setTimeout(() => { this.setData({ confirmActive: true }) }, 30)
  },
  
  closeConfirmModal() {
    this.setData({ confirmActive: false, confirmDragOffset: 0 })
    if (this._closeConfirmTimer) clearTimeout(this._closeConfirmTimer)
    this._closeConfirmTimer = setTimeout(() => {
      this.setData({ showConfirmModal: false })
      this._closeConfirmTimer = null
    }, 360)
  },
  
  onItemTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const item = storage.getItems().find(i => i.id === id)
    if (!item) return
    if (this._closeTimer) {
      clearTimeout(this._closeTimer); this._closeTimer = null
    }
    const isExpired = this.checkExpired(item.date, item.time)
    const defaultEmoji = this.getCategoryEmoji(item.name)
  
    this.setData({ 
      showModal: true, 
      modalActive: false, 
      modalDragOffset: 0, 
      emojiInputValue: item.customEmoji || '',
      editId: id, 
      isExpired: isExpired,
      defaultEmoji: defaultEmoji,
      earlyReminderUnitIndex: ['minute','hour','day'].indexOf(item.earlyReminderUnit || 'minute'), 
      form: {
        name: item.name || '',
        customEmoji: item.customEmoji || '',
        mode: item.mode || 'countdown',
        date: item.date || todayStr(),
        time: item.time || '09:00',
        note: item.note || '',
        reminderContent: item.reminderContent || '',
        earlyReminderEnabled: item.earlyReminderEnabled || false,
        earlyReminderValue: item.earlyReminderValue || 10,
        earlyReminderUnit: item.earlyReminderUnit || 'minute',        
        subscribed: isExpired ? false : (item.subscribed || false),
        countupReminderEnabled: item.countupReminderEnabled || false,
        countupReminderValue: item.countupReminderValue || 7,
        countupReminderUnit: item.countupReminderUnit || 'day',
        countupReminderTime: item.countupReminderTime || '09:00',
        countupReminderNextDate: item.countupReminderNextDate || ''
      }
    })

  setTimeout(() => {
    this.setData({ modalActive: true })
  }, 30)
},

  
  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    this.setData({ 
      ['form.' + field]: e.detail.value 
    })
    // 名称变化时，更新默认emoji
    if (field === 'name') {
      const defaultEmoji = this.getCategoryEmoji(e.detail.value)
      this.setData({ defaultEmoji })
    }
  },
  
  onEmojiInput(e) {
    const value = e.detail.value
    if (!value) {
      this.setData({ 'form.customEmoji': '', emojiInputValue: '' })
      return
    }
    if (this.isValidEmoji(value)) {
      this.setData({ 'form.customEmoji': value, emojiInputValue: value })
    } else {
      wx.showToast({ title: '只能输入emoji', icon: 'none' })
    }
  },
  
  onEmojiFocus() {
    this.setData({ emojiFocused: true, emojiInputValue: '' })
  },
  
  onEmojiBlur() {
    this.setData({
      emojiFocused: false,
      emojiInputValue: this.data.form.customEmoji || ''
    })
  },
  
  isValidEmoji(str) {
    if (!str) return false
    // emoji正则，匹配常见emoji
    const emojiRegex = /^[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}]+$/u
    return emojiRegex.test(str) && !/^[\d\w\s\p{Punctuation}]+$/u.test(str)
  },
  
  onModeChange(e) {
    const mode = e.currentTarget.dataset.value
    if (!mode) return
    this.setData({ 'form.mode': mode })
  },

  onDateChange(e) {
    const targetDate = e.detail.value
    const isExpired = this.checkExpired(targetDate, this.data.form.time)
    this.setData({ 
      'form.date': targetDate,
      isExpired: isExpired,
      'form.subscribed': isExpired ? false : this.data.form.subscribed
    })
  },
  
  onTimeChange(e) {
    const targetTime = e.detail.value
    const isExpired = this.checkExpired(this.data.form.date, targetTime)
    this.setData({ 
      'form.time': targetTime,
      isExpired: isExpired,
      'form.subscribed': isExpired ? false : this.data.form.subscribed
    })
  },  

  onSubscribeToggle() {
    this.setData({ 'form.subscribed': !this.data.form.subscribed })
  },
  
  onEarlyReminderToggle() {
    this.setData({ 'form.earlyReminderEnabled': !this.data.form.earlyReminderEnabled })
  },
  
  onEarlyReminderValueInput(e) {
    let val = parseInt(e.detail.value)
    if (isNaN(val) || val < 1) val = 1
    this.setData({ 'form.earlyReminderValue': val })
  },
  
  onEarlyReminderUnitChange(e) {
    const units = ['minute', 'hour', 'day']
    const unitIndex = parseInt(e.detail.value)
    this.setData({ 
      'form.earlyReminderUnit': units[unitIndex],
      earlyReminderUnitIndex: unitIndex
    })
  },  
  
  onCountupReminderToggle() {
    const val = !this.data.form.countupReminderEnabled
    this.setData({ 'form.countupReminderEnabled': val }, () => {
      if (val) this.calcCountupReminderDate()
    })
  },
  
  onCountupReminderValueInput(e) {
    let val = parseInt(e.detail.value)
    if (isNaN(val)) val = 0
    // 只有选择"天后"时允许0，否则最小为1
    if (this.data.form.countupReminderUnit === 'month' && val < 1) {
      val = 1
    }
    this.setData({ 
      'form.countupReminderValue': val
    }, () => {
      this.validateCountupReminder()
    })
  },
  
  onCountupReminderUnitChange(e) {
    const index = parseInt(e.detail.value)
    const units = ['day', 'month']
    let val = this.data.form.countupReminderValue
    // 切换到"月"时，如果值为0则改为1
    if (units[index] === 'month' && val < 1) {
      val = 1
    }
    this.setData({ 
      'form.countupReminderUnit': units[index], 
      countupUnitIndex: index,
      'form.countupReminderValue': val
    }, () => {
      this.validateCountupReminder()
    })
  },
  
  onCountupReminderTimeChange(e) {
    this.setData({ 
      'form.countupReminderTime': e.detail.value 
    }, () => {
      this.validateCountupReminder()
    })
  },
  
  onCountupReminderRepeatToggle() {
    this.setData({ 'form.countupReminderRepeat': !this.data.form.countupReminderRepeat })
  },

  calcCountupReminderDate() {
    const { form } = this.data
    if (!form.date || !form.countupReminderEnabled) return
    
    const nextDate = this.calcReminderDate(
      form.date, 
      form.countupReminderValue, 
      form.countupReminderUnit
    )
    this.setData({ 'form.countupReminderNextDate': nextDate })
  },
  
  validateCountupReminder() {
    const { form } = this.data
    if (!form.countupReminderEnabled) {
      this.setData({ countupReminderError: '' })
      return true
    }
    
    const val = form.countupReminderValue
    const unit = form.countupReminderUnit
    
    // 检查值是否有效
    if (unit === 'month' && val < 1) {
      this.setData({ countupReminderError: '按月提醒最少为1个月' })
      return false
    }
    if (unit === 'day' && val < 0) {
      this.setData({ countupReminderError: '按天提醒不能为负数' })
      return false
    }
    
    // 检查提醒时间是否早于当前时间
    const reminderDate = this.calcReminderDate(form.date, val, unit)
    const reminderTime = form.countupReminderTime || '09:00'
    const reminderDateTime = new Date(reminderDate + 'T' + reminderTime)
    const now = new Date()
    
    if (reminderDateTime < now) {
      this.setData({ countupReminderError: '提醒时间不能早于当前时间' })
      return false
    }
    
    this.setData({ countupReminderError: '' })
    return true
  },
  
  calcReminderDate(startDate, value, unit) {
    const start = new Date(startDate)
    if (unit === 'day') {
      start.setDate(start.getDate() + value)
    } else {
      start.setMonth(start.getMonth() + value)
    }
    const y = start.getFullYear()
    const m = String(start.getMonth() + 1).padStart(2, '0')
    const d = String(start.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  },
  
  saveItem() {
    const { form, editId } = this.data
    if (!form.name || !form.name.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' }); return
    }
    if (!form.date) {
      wx.showToast({ title: '请选择日期', icon: 'none' }); return
    }
    
      // 验证正计时提醒
  if (form.mode === 'countup' && form.countupReminderEnabled) {
    if (!this.validateCountupReminder()) {
      wx.showToast({ title: '请检查提醒设置', icon: 'none' })
      return
    }
  }
  
    // 检查重名，编辑时排除自身
    const allItems = storage.getItems()
    const duplicate = allItems.find(item =>
      item.name.trim() === form.name.trim() && item.id !== editId
    )
    if (duplicate) {
      wx.showModal({
        title: '名称重复',
        content: '已有同名项目"' + form.name.trim() + '"，请修改名称后再保存。',
        showCancel: false,
        confirmText: '返回修改',
        success: () => {
          this.setData({ 'form.name': form.name })
          setTimeout(() => {
            this.selectComponent('#nameInput') && this.selectComponent('#nameInput').focus()
          }, 300)
        }
      })
      return
    }
    
    const needSubscribe = (form.mode === 'countdown' && form.subscribed) ||
                          (form.mode === 'countup' && form.countupReminderEnabled)
    const doSave = () => {
      const itemData = {
        name: form.name.trim(), 
        customEmoji: form.customEmoji || '', 
        mode: form.mode || 'countdown', date: form.date,
        time: form.time || '09:00', note: form.note || '',
        reminderContent: form.reminderContent || '',
        earlyReminderEnabled: form.earlyReminderEnabled || false,
        earlyReminderValue: form.earlyReminderValue || 10,
        earlyReminderUnit: form.earlyReminderUnit || 'minute',        
        subscribed: form.subscribed || false,
        countupReminderEnabled: form.countupReminderEnabled || false,
        countupReminderValue: form.countupReminderValue || 7,
        countupReminderUnit: form.countupReminderUnit || 'day',
        countupReminderTime: form.countupReminderTime || '09:00',
        countupReminderNextDate: form.countupReminderNextDate || ''
      }
      if (editId) {
        storage.updateItem(editId, itemData)
      } else {
        storage.addItem({ ...itemData, id: Date.now().toString(), createdAt: Date.now() })
      }
      this.closeModal()
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.syncItemToCloud(itemData, editId)
      
      // 如果是在已订阅弹窗内编辑，且关闭了订阅，触发飞出动画
      this.loadItems()
      if (this.data.subscribedModalVisible && editId) {
        const stillSubscribed = (itemData.subscribed || itemData.countupReminderEnabled)
        if (!stillSubscribed) {
          // 等编辑弹窗退场动画结束后（360ms）再触发飞出
          setTimeout(() => {
            this.executeSubscribedItemRemove(editId)
          }, 360)
        } else {
          setTimeout(() => {
            this.loadSubscribedItems()
          }, 360)
        }
      }
    }

  // 审核名称和备注
  const textsToCheck = [form.name, form.note].filter(t => t && t.trim()).join('\n')
  
  wx.showLoading({ title: '加载中...' })
  wx.cloud.callFunction({
    name: 'getOpenid',
    success: (res) => {
      const openid = res.result.openid
      wx.cloud.callFunction({
        name: 'checkContent',
        data: { content: textsToCheck, openid },
        success: (checkRes) => {
          wx.hideLoading()
          if (checkRes.result && checkRes.result.pass === false) {
            wx.showToast({ title: '内容含有违规信息，请修改', icon: 'none' })
          } else {
            // 审核通过，继续原有保存流程
            const needSubscribe = (form.mode === 'countdown' && form.subscribed) ||
                                  (form.mode === 'countup' && form.countupReminderEnabled)
            if (needSubscribe) {
              const config = storage.getReminderConfig()
              const templateId = config.templateId
              if (!templateId) { doSave(); return }
              wx.requestSubscribeMessage({
                tmplIds: [templateId],
                success: (subRes) => {
                  if (subRes[templateId] !== 'accept') {
                    this.setData({ 'form.subscribed': false, 'form.countupReminderEnabled': false })
                  }
                  doSave()
                },
                fail: () => { doSave() }
              })
            } else {
              doSave()
            }
          }
        },
        fail: () => {
          // 云函数调用失败时放行，不阻断用户
          wx.hideLoading()
          doSave()
        }
      })
    },
    fail: () => {
      wx.hideLoading()
      doSave()
    }
  })
},

deleteItem(e) {
  const id = e.currentTarget.dataset.id
  if (!id) return
  const deletedItem = (this.data.items || []).find(item => item.id === id)
  if (!deletedItem) return
  const items = (this.data.items || []).map(item =>
    item.id === id ? { ...item, swipeOffset: 0 } : item
  )
  this.setData({ items, swipeOpenId: null, swipeOverDelete: false })
  this.executeDelete(id, deletedItem)
},


  confirmSubscribeAll() {
    const config = storage.getReminderConfig()
    const templateId = config.templateId
    if (!templateId) { 
      wx.showToast({ title: '请先配置模板ID', icon: 'none' })
      return 
    }
  
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => {
        this.closeConfirmModal()   // 授权弹窗处理完再关弹窗
        if (res[templateId] === 'accept') {
          const items = storage.getItems()
          items.forEach(item => {
            if (!item.subscribed && item.mode === 'countdown' && !this.checkExpired(item.date, item.time)) {
              storage.updateItem(item.id, { subscribed: true })
            }
          })
          this.loadItems()
          wx.showToast({ title: '全部订阅成功', icon: 'success' })
          this.checkAndSendReminders()
        } else {
          wx.showToast({ title: '未授权提醒', icon: 'none' })
        }
      },
      fail: () => { 
        this.closeConfirmModal()
        wx.showToast({ title: '订阅失败，请重试', icon: 'none' }) 
      }
    })
  },
  

  onModalTouchStart(e) {
    this._dragStartY = e.touches[0].clientY
    this._modalScrollTop = this._modalScrollTop || 0
  },

  onModalTouchMove(e) {
    if (this._modalScrollTop > 0) return
    const diff = e.touches[0].clientY - this._dragStartY
    if (diff <= 0) return
    this.setData({ modalDragOffset: diff })
  },

  onModalTouchEnd(e) {
    const diff = e.changedTouches[0].clientY - this._dragStartY
    if (diff > 80 && (this._modalScrollTop || 0) <= 0) {
      this.closeModal()
    } else {
      this.setData({ modalDragOffset: 0 })
    }
  },

  onModalScroll(e) {
    this._modalScrollTop = e.detail.scrollTop
  },

  onConfirmTouchStart(e) {
    this._confirmDragStartY = e.touches[0].clientY
  },

  onConfirmTouchMove(e) {
    const diff = e.touches[0].clientY - this._confirmDragStartY
    if (diff <= 0) return
    this.setData({ confirmDragOffset: diff })
  },

  onConfirmTouchEnd(e) {
    const diff = e.changedTouches[0].clientY - this._confirmDragStartY
    if (diff > 80) {
      this.closeConfirmModal()
    } else {
      this.setData({ confirmDragOffset: 0 })
    }
  },

  checkAndSendReminders() {
    try {
      const config = storage.getReminderConfig()
      if (!config.templateId) return
      const items = storage.getItems()
      const reminderDays = config.reminderDays || 3
      wx.cloud.callFunction({
        name: 'getOpenid',
        success: (openidRes) => {
          const openid = openidRes.result.openid
          items.forEach(item => {
            if (item.mode !== 'countdown' || !item.subscribed) return
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            const target = new Date(item.date)
            target.setHours(0, 0, 0, 0)
            const daysLeft = Math.round((target - now) / (1000 * 60 * 60 * 24))
            const reminderTime = item.time || '09:00'
            const [rh, rm] = reminderTime.split(':').map(Number)
            const nowHour = new Date().getHours()
            const nowMin = new Date().getMinutes()
            const timeReached = nowHour > rh || (nowHour === rh && nowMin >= rm)
            if (daysLeft <= reminderDays && daysLeft >= 0 && timeReached) {
              wx.cloud.callFunction({
                name: 'sendReminder',
                data: {
                  itemName: item.name,
                  expiryDate: item.date + ' ' + reminderTime,
                  daysLeft,
                  reminderContent: item.reminderContent || '',
                  note: item.note || '',
                  openid
                },
                fail: (err) => console.error('发送提醒失败', err)
              })
            }            
          })
        },
        fail: (err) => console.error('获取openid失败', err)
      })
    } catch (e) {
      console.error('checkAndSendReminders error', e)
    }
  },

  syncItemToCloud(itemData, editId) {
    if (!itemData.subscribed && !itemData.countupReminderEnabled) return
    wx.cloud.callFunction({
      name: 'getOpenid',
      success: (res) => {
        const openid = res.result.openid
        const db = wx.cloud.database()
        const reminderDays = 3
        const cloudData = {
          openid,
          name: itemData.name,
          date: itemData.date,
          time: itemData.time || '09:00',
          mode: itemData.mode,
          subscribed: itemData.subscribed || false,
          reminderContent: itemData.reminderContent || '',
          note: itemData.note || '',
          reminderDays,
          earlyReminderEnabled: itemData.earlyReminderEnabled || false,
          earlyReminderValue: itemData.earlyReminderValue || 10,
          earlyReminderUnit: itemData.earlyReminderUnit || 'minute',
          updatedAt: Date.now()
        }        
        if (editId) {
          // 按 localId 查找云端记录并更新
          db.collection('reminders')
            .where({ localId: editId, openid })
            .get()
            .then(({ data }) => {
              if (data.length > 0) {
                db.collection('reminders').doc(data[0]._id).update({ data: cloudData })
              } else {
                db.collection('reminders').add({ data: { ...cloudData, localId: editId } })
              }
            })
        } else {
          const localId = Date.now().toString()
          storage.updateItem(localId, { cloudSynced: true })
          db.collection('reminders').add({ data: { ...cloudData, localId } })
        }
      },
      fail: (err) => console.error('syncItemToCloud 获取openid失败', err)
    })
  },
  
  onCardTouchStart(e) {
    this._swipeTouchStartX = e.touches[0].clientX
    this._swipeTouchStartY = e.touches[0].clientY
    this._swipeCurrentId = e.currentTarget.dataset.id
    const isDeleteOpen = this.data.swipeOpenId === this._swipeCurrentId
    const isCompleteOpen = this.data.completeOpenId === this._swipeCurrentId
    this._swipeStartOffset = isDeleteOpen ? -240 : (isCompleteOpen ? 240 : 0)
    this._swipeDirectionDecided = false
    this._swipeLocked = false
    this.setData({ swipeCatching: false })
  },
  
  onCardTouchMove(e) {
    const currentItems = this.data.items || []
    const dx = e.touches[0].clientX - this._swipeTouchStartX
    const dy = e.touches[0].clientY - this._swipeTouchStartY
  
    if (!this._swipeDirectionDecided) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      this._swipeDirectionDecided = true
      this._swipeLocked = Math.abs(dx) > Math.abs(dy) * 1.5
      if (this._swipeLocked) {
        this.setData({ swipeCatching: true })
      } else {
        this._swipeCurrentId = null
        return
      }
    }
  
    if (!this._swipeLocked) return
    const id = this._swipeCurrentId
    if (!id) return
    const rawOffset = this._swipeStartOffset + dx
  
    if (rawOffset > 0) {
      const offset = Math.min(rawOffset, 400)
      const overComplete = offset >= 320
      const items = currentItems.map(item => {
        if (item.id === id) return { ...item, swipeOffset: offset, swiping: 'complete' }
        return { ...item }
      })
      this.setData({ items, swipeOverComplete: overComplete })
    } else {
      const offset = Math.min(0, Math.max(-400, rawOffset))
      const overDelete = offset <= -320
      const items = currentItems.map(item => {
        if (item.id === id) return { ...item, swipeOffset: offset, swiping: 'delete' }
        return { ...item }
      })
      this.setData({ items, swipeOverDelete: overDelete })
    }
  },
  
  onCardTouchEnd(e) {
    this.setData({ swipeCatching: false })
    if (!this._swipeLocked) return
    const dx = e.changedTouches[0].clientX - this._swipeTouchStartX
    const id = this._swipeCurrentId
    if (!id) return
    const rawOffset = this._swipeStartOffset + dx
    const currentItems = this.data.items || []
  
    if (rawOffset > 0) {
      if (rawOffset >= 200) {
        this.executeComplete(id)
      } else {
        const wasCompleteOpen = this._swipeStartOffset > 0
        const shouldKeepComplete = wasCompleteOpen ? dx > -30 : rawOffset >= 60
        if (shouldKeepComplete) {
          const items = currentItems.map(item =>
            item.id === id ? { ...item, swipeOffset: 240, swiping: 'complete' } : item
          )
          this.setData({ items, completeOpenId: id, swipeOpenId: null, swipeOverComplete: false })
        } else {
          const items = currentItems.map(item =>
            item.id === id ? { ...item, swipeOffset: 0 } : item
          )
          this.setData({ items, completeOpenId: null, swipeOverComplete: false })
          setTimeout(() => {
            const items2 = (this.data.items || []).map(i =>
              i.id === id ? { ...i, swiping: '' } : i
            )
            this.setData({ items: items2 })
          }, 350)          
        }
      }
      return
    }
    
  
    const wasDeleteOpen = this._swipeStartOffset < 0
    const overDelete = rawOffset <= -240
    if (overDelete) {
      const deletedItem = currentItems.find(item => item.id === id)
      const items = currentItems.map(item =>
        item.id === id ? { ...item, swipeOffset: 0 } : item
      )
      this.setData({ items, swipeOpenId: null, swipeOverDelete: false })
      this.executeDelete(id, deletedItem)
      return
    }
  
    const shouldOpen = wasDeleteOpen ? dx < 30 : rawOffset < -60
    const items = currentItems.map(item => {
      if (item.id === id) return { ...item, swipeOffset: shouldOpen ? -240 : 0, swiping: shouldOpen ? 'delete' : 'delete' }
      return item
    })
    this.setData({ items, swipeOpenId: shouldOpen ? id : null, swipeOverDelete: false })
    if (!shouldOpen) {
      setTimeout(() => {
        const items2 = (this.data.items || []).map(i =>
          i.id === id ? { ...i, swiping: '' } : i
        )
        this.setData({ items: items2 })
      }, 350)
    }    
  },
  
  executeComplete(id) {
    const item = (this.data.items || []).find(i => i.id === id)
    if (!item) return
  
    const items = (this.data.items || []).map(i =>
      i.id === id
        ? { ...i, swipeOffset: 0, flyOutComplete: true, flyOutCollapse: false }
        : { ...i }
    )
    this.setData({ items, swipeOverComplete: false, completeOpenId: null })
  
    setTimeout(() => {
      const items2 = (this.data.items || []).map(i =>
        i.id === id ? { ...i, flyOutCollapse: true } : i
      )
      this.setData({ items: items2 })
    }, 300)
  
    setTimeout(() => {
      storage.completeItem({ ...item, completedAt: Date.now(), swipeOffset: 0, flyOutComplete: false, flyOutCollapse: false })
      const items3 = (this.data.items || []).filter(i => i.id !== id)
      this.setData({ items: items3 })
    }, 700)
  },
  
  
  onCompleteBtnTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    this.executeComplete(id)
  },
  
  executeDelete(id, deletedItem) {
    // 如果排序横幅正在显示，把它顶上去
   if (this.data.showSortUndo) {
     this.setData({ sortUndoStackOffset: 1 })
    }
    if (this._undoCountdownTimer) {
      clearInterval(this._undoCountdownTimer)
      this._undoCountdownTimer = null
    }
    if (this._undoTimer) {
      clearTimeout(this._undoTimer)
      this._undoTimer = null
    }
  
    this._undoBatch = this._undoBatch || []
    // 每次删除都把当前列表里还存在的项目顺序合并进去
    const currentIds = this.data.items.map(i => i.id)
    if (!this._undoBatchOrder) {
      this._undoBatchOrder = currentIds
    } else {
      // 把新的项目顺序合并，保留已删除项目的原始位置
      currentIds.forEach(id => {
        if (!this._undoBatchOrder.includes(id)) {
          this._undoBatchOrder.push(id)
        }
      })
    }
    this._undoBatch.push(deletedItem)    
    const batchCount = this._undoBatch.length
  
    // 触发飞出动画
    const items = this.data.items.map(item =>
      item.id === id
        ? { ...item, flyOut: true, flyOutCollapse: false }
        : { ...item, flyOut: false, flyOutCollapse: false, restoring: false, restored: false }
    )
    this.setData({ items })
    
    // 同步触发高度收缩
    setTimeout(() => {
      const items2 = this.data.items.map(item =>
        item.id === id ? { ...item, flyOutCollapse: true } : item
      )
      this.setData({ items: items2 })
    }, 50)
  
    // 动画结束后从数组删除
    setTimeout(() => {
      storage.deleteItem(id)
      const items3 = this.data.items.filter(item => item.id !== id)
      this.setData({ items: items3 })
    }, 600)
  
    // 显示/更新撤销横幅
    this.setData({
      undoItem: [...this._undoBatch],
      undoCount: batchCount,
      showUndo: true,
      undoCountdown: '6.0',
      undoProgressWidth: 100
    })
    setTimeout(() => { this.setData({ undoVisible: true }) }, 30)
  
    // 重置倒计时
    let countdown = 6.0
    this._undoCountdownTimer = setInterval(() => {
      countdown = Math.max(0, Math.round((countdown - 0.1) * 10) / 10)
      this.setData({
        undoCountdown: countdown.toFixed(1),
        undoProgressWidth: Math.round(countdown / 6 * 100)
      })
      if (countdown <= 0) {
        clearInterval(this._undoCountdownTimer)
        this._undoCountdownTimer = null
      }
    }, 100)
  
    this._undoTimer = setTimeout(() => {
      this.setData({ undoVisible: false })
      setTimeout(() => {
        this.setData({
          showUndo: false, undoItem: null, undoCountdown: '6.0',
          undoProgressWidth: 100, undoStackOffset: 0
        })
        this._undoBatch = []
        this._undoBatchOrder = null
        // 排序横幅降回原位
        if (this.data.showSortUndo) {
          this.setData({ sortUndoStackOffset: 0 })
        }
      }, 400)
      this._undoTimer = null
    }, 6000)
  },
  
  undoDelete() {
    if (this._undoTimer) { clearTimeout(this._undoTimer); this._undoTimer = null }
    if (this._undoCountdownTimer) { clearInterval(this._undoCountdownTimer); this._undoCountdownTimer = null }
  
    const batch = [...(this._undoBatch || [])]
    if (!batch.length) return
  
    this.setData({ undoVisible: false })
    setTimeout(() => {
      this.setData({
        showUndo: false, undoItem: null, undoCountdown: '6.0',
        undoProgressWidth: 100, undoStackOffset: 0
      })
      this._undoBatch = []
      this._undoBatchOrder = null
      if (this.data.showSortUndo) {
        this.setData({ sortUndoStackOffset: 0 })
      }
    }, 400)    
  
    batch.forEach(item => {
      storage.addItem({ ...item, swipeOffset: 0, flyOut: false, flyOutCollapse: false })
    })
  
    const raw = storage.getItems()
    const restoredIds = batch.map(b => b.id)
    const originalOrder = this._undoBatchOrder || []
  
    const newItems = raw.map(item => {
      const display = formatDisplay(item.date, item.mode)
      const emoji = item.customEmoji || this.getCategoryEmoji(item.name)
      const isRestored = restoredIds.includes(item.id)
      return {
        ...item, display, emoji,
        swipeOffset: 0,
        flyOut: false,
        flyOutCollapse: false,
        wrapStyle: isRestored ? 'max-height:0;margin-bottom:0;overflow:hidden;' : '',
        cardStyle: isRestored ? 'opacity:0;transform:translateX(-110%);' : '',
        glowStyle: ''
      }
    })
  
    const sortedItems = [...newItems].sort((a, b) => {
      const ai = originalOrder.indexOf(a.id)
      const bi = originalOrder.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  
    this.setData({ items: sortedItems })
  
    const restoringItems = sortedItems.filter(i => restoredIds.includes(i.id))
    const allDoneDelay = 30 + (restoringItems.length - 1) * 100 + 560
  
    restoringItems.forEach((item, index) => {
      const delay = 30 + index * 100
  
      // 展开高度，其他项目下移
      setTimeout(() => {
        const items2 = this.data.items.map(i =>
          i.id === item.id
            ? { ...i, wrapStyle: 'max-height:200rpx;margin-bottom:20rpx;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),margin-bottom 0.5s cubic-bezier(0.4,0,0.2,1);' }
            : i
        )
        this.setData({ items: items2 })
      }, delay)
  
      // 触发卡片飞入
      setTimeout(() => {
        const items3 = this.data.items.map(i =>
          i.id === item.id
            ? { ...i, cardStyle: 'opacity:1;transform:translateX(0);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.32,0.72,0,1);' }
            : i
        )
        this.setData({ items: items3 })
      }, delay + 50)
  

// 第一步：飞入开始时同步加 noGlow
setTimeout(() => {
  const items4 = this.data.items.map(i =>
    i.id === item.id ? { ...i, noGlow: true } : i
  )
  this.setData({ items: items4 })
}, delay + 50)

// 飞入结束后：同时清空 cardStyle 并移除 noGlow，触发阴影渐显
setTimeout(() => {
  const items4b = this.data.items.map(i =>
    i.id === item.id ? { ...i, wrapStyle: '', cardStyle: '', noGlow: false } : i
  )
  this.setData({ items: items4b })
      }, delay + 560)
    })
  },
  
  checkExpired(date, time) {
    if (!date) return false
    const now = new Date()
    // 使用 T 分隔符，兼容 iOS
    const target = new Date(date + 'T' + (time || '23:59'))
    return target < now
  },
  
// 打开已订阅弹窗
openSubscribedModal() {
  this.loadSubscribedItems()
  this.setData({
    subscribedModalVisible: true,
    subscribedModalActive: false,
    subscribedModalHiding: false
  }, () => {
  })
  setTimeout(() => {
    this.setData({ subscribedModalActive: true })
  }, 30)
},


// 加载已订阅项目
loadSubscribedItems() {
  const items = storage.getItems().filter(item => {
    if (item.mode === 'countdown') {
      return item.subscribed
    }
    if (item.mode === 'countup') {
      return item.countupReminderEnabled
    }
    return false
  })
  
  
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  
  const processedItems = items.map(item => {
    const itemDate = new Date(item.date)
    itemDate.setHours(0, 0, 0, 0)
    const diffTime = itemDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    const expired = item.mode === 'countdown' ? diffDays < 0 : false
    
    let reminderInfo = ''
    if (item.mode === 'countdown') {
      reminderInfo = `将于 ${item.date} ${item.time} 提醒`
    } else {
      const unit = item.countupReminderUnit === 'day' ? '天' : '个月'
      reminderInfo = `开始后第 ${item.countupReminderValue} ${unit} ${item.countupReminderTime} 提醒`
    }
    
    let labelText, daysText, unitText, cardClass
    if (item.mode === 'countdown') {
      if (diffDays < 0) {
        labelText = '已过期'
        daysText = Math.abs(diffDays)
        unitText = '天前'
        cardClass = 'card-pushed'
      } else if (diffDays === 0) {
        labelText = '今天'
        daysText = '0'
        unitText = '天'
        cardClass = 'card-today'
      } else if (diffDays <= 7) {
        labelText = '还有'
        daysText = diffDays
        unitText = '天'
        cardClass = 'card-urgent'
      } else if (diffDays <= 30) {
        labelText = '还有'
        daysText = diffDays
        unitText = '天'
        cardClass = 'card-warning'
      } else {
        labelText = '还有'
        daysText = diffDays
        unitText = '天'
        cardClass = 'card-safe'
      }
    } else {
      const elapsedDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24))
      labelText = '已开始'
      daysText = elapsedDays
      unitText = '天'
      cardClass = 'card-countup'
    }
    
    return {
      ...item,
      expired,
      reminderInfo,
      labelText,
      daysText,
      unitText,
      cardClass,
      emoji: item.customEmoji || this.getCategoryEmoji(item.name)
    }
  })
  
  processedItems.sort((a, b) => {
    if (a.expired && !b.expired) return 1
    if (!a.expired && b.expired) return -1
    return 0
  })
  
  this.setData({ subscribedItems: processedItems })
},

closeSubscribedModal() {
  this.setData({ subscribedModalActive: false })
  setTimeout(() => {
    this.setData({ subscribedModalVisible: false })
  }, 360)
},

onSubscribedModalTouchStart(e) {
  this._subscribedModalDragStartY = e.touches[0].clientY
  this._subscribedModalScrollTop = this._subscribedModalScrollTop || 0
},


onSubscribedModalTouchMove(e) {
  const diff = e.touches[0].clientY - this._subscribedModalDragStartY
  if (diff <= 0) return
  // modal-subscribed 没有内联 style 控制位移，只做手势判断
},

onSubscribedModalTouchEnd(e) {
  const diff = e.changedTouches[0].clientY - this._subscribedModalDragStartY
  if (diff > 80 && (this._subscribedModalScrollTop || 0) <= 0) {
    this.closeSubscribedModal()
  }
},

onSubscribedModalScroll(e) {
  this._subscribedModalScrollTop = e.detail.scrollTop
},


confirmClearExpired() {
  const expiredItems = this.data.subscribedItems.filter(item => item.expired)
  if (!expiredItems.length) {
    wx.showToast({ title: '没有已过期项目', icon: 'none' })
    return
  }
  wx.showModal({
    title: '清除已过期',
    content: '将取消 ' + expiredItems.length + ' 个已过期项目的订阅提醒，确认继续？',
    confirmText: '确认清除',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        this.executeClearExpired(expiredItems)
      }
    }
  })
},

executeClearExpired(expiredItems) {
  const count = expiredItems.length

  // 逐个取消订阅
  expiredItems.forEach(item => {
    storage.updateItem(item.id, { subscribed: false, countupReminderEnabled: false })
  })

  // 从已订阅列表移除
  const remaining = this.data.subscribedItems.filter(item => !item.expired)
  this.setData({ subscribedItems: remaining })

  // 刷新首页列表
  this.loadItems()

  // 显示提示横幅
  this.setData({ showClearBar: true, clearCount: count })
  setTimeout(() => { this.setData({ clearVisible: true }) }, 30)

  // 3秒后自动消失
  if (this._clearBarTimer) clearTimeout(this._clearBarTimer)
  this._clearBarTimer = setTimeout(() => {
    this.setData({ clearVisible: false })
    setTimeout(() => {
      this.setData({ showClearBar: false })
    }, 400)
    this._clearBarTimer = null
  }, 3000)
},

executeSubscribedItemRemove(id) {
  const s0 = this.data.subscribedItems.map(item =>
    item.id === id ? { ...item, showDelete: true, flyOut: false, flyOutCollapse: false } : item
  )
  this.setData({ subscribedItems: s0 })

  setTimeout(() => {
    const s1 = this.data.subscribedItems.map(item =>
      item.id === id ? { ...item, flyOut: true } : item
    )
    this.setData({ subscribedItems: s1 })
  }, 16)

  setTimeout(() => {
    const s2 = this.data.subscribedItems.map(item =>
      item.id === id ? { ...item, flyOutCollapse: true } : item
    )
    this.setData({ subscribedItems: s2 })
  }, 50)

  setTimeout(() => {
    const s3 = this.data.subscribedItems.filter(item => item.id !== id)
    this.setData({ subscribedItems: s3 })
    this.loadItems()
  }, 600)
},

onSubscribedItemTap(e) {
  const id = e.currentTarget.dataset.id
  if (!id) return
  const item = storage.getItems().find(i => i.id === id)
  if (!item) return
  const isExpired = this.checkExpired(item.date, item.time)
  const defaultEmoji = this.getCategoryEmoji(item.name)
  this.setData({
    showModal: true,
    modalActive: false,
    modalDragOffset: 0,
    editId: id,
    isExpired: isExpired,
    emojiInputValue: item.customEmoji || '',
    defaultEmoji: defaultEmoji,
    earlyReminderUnitIndex: ['minute','hour','day'].indexOf(item.earlyReminderUnit || 'minute'), 
    form: {
      name: item.name || '',
      customEmoji: item.customEmoji || '',
      mode: item.mode || 'countdown',
      date: item.date || todayStr(),
      time: item.time || '09:00',
      note: item.note || '',
      reminderContent: item.reminderContent || '',
      earlyReminderEnabled: item.earlyReminderEnabled || false,
      earlyReminderValue: item.earlyReminderValue || 10,
      earlyReminderUnit: item.earlyReminderUnit || 'minute',      
      subscribed: isExpired ? false : (item.subscribed || false),
      countupReminderEnabled: item.countupReminderEnabled || false,
      countupReminderValue: item.countupReminderValue || 7,
      countupReminderUnit: item.countupReminderUnit || 'day',
      countupReminderTime: item.countupReminderTime || '09:00',
      countupReminderNextDate: item.countupReminderNextDate || ''
    }
  })
  setTimeout(() => {
    this.setData({ modalActive: true })
  }, 30)
},

// ===== 排序 =====

openSortModal() {
  this.setData({ showSortModal: true, sortModalActive: false })
  setTimeout(() => { this.setData({ sortModalActive: true }) }, 30)
},

closeSortModal() {
  this.setData({ sortModalActive: false, sortModalDragOffset: 0 })
  setTimeout(() => { this.setData({ showSortModal: false }) }, 360)
},

onSortModalTouchStart(e) {
  this._sortModalDragStartY = e.touches[0].clientY
},

onSortModalTouchMove(e) {
  // 不需要实时更新位移，只记录方向用于 touchend 判断
},

onSortModalTouchEnd(e) {
  const diff = e.changedTouches[0].clientY - this._sortModalDragStartY
  if (diff > 80) {
    this.closeSortModal()
  } else {
    this.setData({ sortModalDragOffset: 0 })
  }
},

onSortChange(e) {
  const newMode = e.currentTarget.dataset.mode
  if (!newMode || newMode === this.data.sortMode) {
    this.closeSortModal()
    return
  }
  const prevMode = this.data.sortMode
  this.setData({ sortMode: newMode, prevSortMode: prevMode })
  storage.setSortConfig({ mode: newMode })
  this.loadItems()
  this.closeSortModal()
  this.showSortUndoBar()
},

showSortUndoBar() {
  // 如果删除横幅正在显示，把它顶上去
  if (this.data.showUndo) {
    this.setData({ undoStackOffset: 1 })
  }

  if (this._sortUndoCountdownTimer) { clearInterval(this._sortUndoCountdownTimer); this._sortUndoCountdownTimer = null }
  if (this._sortUndoTimer) { clearTimeout(this._sortUndoTimer); this._sortUndoTimer = null }

  this.setData({
    showSortUndo: true,
    sortUndoVisible: false,
    sortUndoCountdown: '15.0',
    sortUndoProgressWidth: 100,
    sortUndoStackOffset: 0
  })
  setTimeout(() => { this.setData({ sortUndoVisible: true }) }, 30)

  let countdown = 15.0
  this._sortUndoCountdownTimer = setInterval(() => {
    countdown = Math.max(0, Math.round((countdown - 0.1) * 10) / 10)
    this.setData({
      sortUndoCountdown: countdown.toFixed(1),
      sortUndoProgressWidth: Math.round(countdown / 15 * 100)
    })
    if (countdown <= 0) { clearInterval(this._sortUndoCountdownTimer); this._sortUndoCountdownTimer = null }
  }, 100)

  this._sortUndoTimer = setTimeout(() => {
    this.dismissSortUndoBar()
  }, 15000)
},

dismissSortUndoBar() {
  if (this._sortUndoTimer) { clearTimeout(this._sortUndoTimer); this._sortUndoTimer = null }
  if (this._sortUndoCountdownTimer) { clearInterval(this._sortUndoCountdownTimer); this._sortUndoCountdownTimer = null }
  this.setData({ sortUndoVisible: false })
  setTimeout(() => {
    this.setData({ showSortUndo: false, sortUndoCountdown: '15.0', sortUndoProgressWidth: 100, sortUndoStackOffset: 0 })
    // 删除横幅降回原位
    if (this.data.showUndo) {
      this.setData({ undoStackOffset: 0 })
    }
  }, 400)
},

undoSort() {
  const prev = this.data.prevSortMode
  if (!prev) return
  this.setData({ sortMode: prev, prevSortMode: null })
  storage.setSortConfig({ mode: prev })
  this.loadItems()
  this.dismissSortUndoBar()
},

onShareAppMessage() {
  return {
    title: '实用计时清单-免费无广待办提醒',
    path: '/pages/index/index',
    imageUrl: '/images/shareqr.jpg'  // 自定义分享封面图
  }
},

  stopPropagation() {}
})

