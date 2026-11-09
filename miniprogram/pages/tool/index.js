const storage = require('../../utils/storage')

Page({
  data: {
    items: [],
    showModal: false,
    modalActive: false,
    modalDragOffset: 0,
    selectedItem: null,
    version: '',
    showUndo: false,
    undoVisible: false,
    undoCountdown: '6.0',
    undoProgressWidth: 100,
    undoCount: 0,
    showAboutModal: false,
    aboutModalActive: false,
    restoreOpenId: null,
    showClearAllModal: false,
    clearAllModalActive: false,
    clearAllCount: 0,
    showClearAllUndo: false,
    clearAllUndoVisible: false,
    swipeOpenId: null,
    sortMode: 'completedAt',
    showSortModal: false,
    sortModalActive: false,
    prevSortMode: null,
    showSortUndo: false,
    sortUndoVisible: false,
    sortUndoCountdown: '15.0',
    sortUndoProgressWidth: 100,
  },

  _timer: null,
  _closeTimer: null,
  _undoTimer: null,
  _undoCountdownTimer: null,
  _undoBatch: [],
  _undoBatchOrder: null,
  _swipeTouchStartX: 0,
  _swipeTouchStartY: 0,
  _swipeCurrentId: null,
  _swipeStartOffset: 0,
  _swipeDirectionDecided: false,
  _swipeLocked: false,
  _lastSwipeSetDataTime: 0,
  _clearAllUndoTimer: null,
  _clearAllUndoCountdownTimer: null,
  _clearAllBackup: [],
  _sortUndoTimer: null,
  _sortUndoCountdownTimer: null,


// 在 Page({}) 的实例变量区加一个标记
_destroyed: false,

onShow() {
  const app = getApp()
  this.setData({ version: app.globalData.version || '开发版' })
  this._destroyed = false
  this.loadItems()
  if (this._timer) { clearInterval(this._timer); this._timer = null }
  const self = this
  this._timer = setInterval(function() {
    if (self._destroyed || !self._timer) return
    self.loadItems()
  }, 60000)
},

onHide() {
  if (this._timer) { clearInterval(this._timer); this._timer = null }
  if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null }
},

onUnload() {
  this._destroyed = true
  if (this._timer) { clearInterval(this._timer); this._timer = null }
  if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null }
  if (this._undoTimer) { clearTimeout(this._undoTimer); this._undoTimer = null }
  if (this._undoCountdownTimer) { clearInterval(this._undoCountdownTimer); this._undoCountdownTimer = null }
  if (this._clearAllUndoTimer) { clearTimeout(this._clearAllUndoTimer); this._clearAllUndoTimer = null }
  if (this._clearAllUndoCountdownTimer) { clearInterval(this._clearAllUndoCountdownTimer); this._clearAllUndoCountdownTimer = null }
  if (this._sortUndoTimer) { clearTimeout(this._sortUndoTimer); this._sortUndoTimer = null }
  if (this._sortUndoCountdownTimer) { clearInterval(this._sortUndoCountdownTimer); this._sortUndoCountdownTimer = null }
},

  loadItems() {
    try {
      const raw = storage.getCompletedItems()
      const now = new Date()
      const items = raw.map(item => {
        const emoji = item.customEmoji || this.getCategoryEmoji(item.name)
        const completedAt = item.completedAt || Date.now()
        const completedDate = new Date(completedAt)

        // 完成时间格式化（精确到秒）
        const completedStr = this.formatDateTime(completedDate)

        // 右侧数字
        let label, days, unit, cardClass
        if (item.mode === 'countup') {
          // 正计时：已坚持天数从开始日期算
          const startDate = new Date(item.date)
          startDate.setHours(0, 0, 0, 0)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24))
          label = '已坚持'
          unit = '天'
          cardClass = 'card-done-countup'
        } else {
          // 倒计时：已过去天数从完成时间算
          const completedDay = new Date(completedAt)
          completedDay.setHours(0, 0, 0, 0)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          days = Math.floor((today - completedDay) / (1000 * 60 * 60 * 24))
          label = '已过去'
          unit = '天'
          cardClass = 'card-done-countdown'
        }

        return {
          ...item,
          emoji,
          completedStr,
          label,
          days,
          unit,
          cardClass,
          swipeOffset: item.swipeOffset || 0,
          swiping: ''
        }
      })
      this.setData({ items: this.sortItems(items) })
    } catch(e) {
      console.error('loadItems error', e)
    }
  },

  formatDateTime(date) {
    const y = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const mi = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return y + '-' + mo + '-' + d + ' ' + h + ':' + mi + ':' + s
  },

  getCategoryEmoji(name) {
    if (!name) return '📦'
    const categoryMap = [
      { pattern: /生日|生辰|寿辰|纪念|周年|纪念日|节日/, emoji: '🎂' },
      { pattern: /考试|高考|中考|考研|考级|期末|考/, emoji: '📚' },
      { pattern: /结婚|婚礼|婚期|订婚/, emoji: '💍' },
      { pattern: /旅行|旅游|出游|度假|日游/, emoji: '🏖️' },
      { pattern: /工作|入职|离职|面试/, emoji: '💼' },
      { pattern: /健身|运动|减肥|跑步|戒|坚持|打卡/, emoji: '💪' },
      { pattern: /学习|课程|培训|书/, emoji: '📖' },
      { pattern: /会议|开会|活动/, emoji: '📅' },
      { pattern: /护肤|面膜|精华|乳液|防晒|牙膏|洗发|沐浴/, emoji: '🧴' },
      { pattern: /电影|剧|动漫|听歌/, emoji: '🎬' },
      { pattern: /食|吃|零食|饮|奶|肉|菜|水果|薯片/, emoji: '🍱' },
      { pattern: /药|胶囊|颗粒|冲剂|体检/, emoji: '💊' },
      { pattern: /驾照|证件|护照|身份证/, emoji: '📋' },
      { pattern: /车|年检|加油/, emoji: '🚗' },
      { pattern: /电器|手机|电脑|家电|数码/, emoji: '💻' },
      { pattern: /猫|狗|宠物/, emoji: '🐱' },
      { pattern: /工资|还款|账单|报销/, emoji: '💰' }
    ]
    const found = categoryMap.find(i => i.pattern.test(name))
    return found ? found.emoji : '📦'
  },

  sortItems(items) {
    const { sortMode } = this.data
  
    if (sortMode === 'name') {
      return items.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh'))
    }
  
    if (sortMode === 'days') {
      // 倒计时组在前，正计时组在后，组内按天数降序
      const countdown = items.filter(i => i.mode !== 'countup')
        .sort((a, b) => (b.days || 0) - (a.days || 0))
      const countup = items.filter(i => i.mode === 'countup')
        .sort((a, b) => (b.days || 0) - (a.days || 0))
      return [...countdown, ...countup]
    }
  
    // 默认：按完成时间降序（最近完成的在前）
    return items.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
  },
  
  openSortModal() {
    this.setData({ showSortModal: true, sortModalActive: false })
    setTimeout(() => { this.setData({ sortModalActive: true }) }, 30)
  },
  
  closeSortModal() {
    this.setData({ sortModalActive: false })
    setTimeout(() => { this.setData({ showSortModal: false }) }, 360)
  },
  
  onSortModalTouchStart(e) {
    this._sortModalDragStartY = e.touches[0].clientY
  },
  
  onSortModalTouchMove(e) {},
  
  onSortModalTouchEnd(e) {
    const diff = e.changedTouches[0].clientY - this._sortModalDragStartY
    if (diff > 80) { this.closeSortModal() }
  },
  
  onSortChange(e) {
    const newMode = e.currentTarget.dataset.mode
    if (!newMode || newMode === this.data.sortMode) {
      this.closeSortModal()
      return
    }
    const prevMode = this.data.sortMode
    this.setData({ sortMode: newMode, prevSortMode: prevMode })
    this.loadItems()
    this.closeSortModal()
    this.showSortUndoBar()
  },
  
  showSortUndoBar() {
    if (this._sortUndoCountdownTimer) { clearInterval(this._sortUndoCountdownTimer); this._sortUndoCountdownTimer = null }
    if (this._sortUndoTimer) { clearTimeout(this._sortUndoTimer); this._sortUndoTimer = null }
  
    this.setData({
      showSortUndo: true,
      sortUndoVisible: false,
      sortUndoCountdown: '15.0',
      sortUndoProgressWidth: 100
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
      this.setData({ showSortUndo: false, sortUndoCountdown: '15.0', sortUndoProgressWidth: 100 })
    }, 400)
  },
  
  undoSort() {
    const prev = this.data.prevSortMode
    if (!prev) return
    this.setData({ sortMode: prev, prevSortMode: null })
    this.loadItems()
    this.dismissSortUndoBar()
  },
  
  // ===== 滑动手势 =====

  onCardTouchStart(e) {
    this._swipeTouchStartX = e.touches[0].clientX
    this._swipeTouchStartY = e.touches[0].clientY
    this._swipeCurrentId = e.currentTarget.dataset.id
    const isDeleteOpen = this.data.swipeOpenId === this._swipeCurrentId
    const isRestoreOpen = this.data.restoreOpenId === this._swipeCurrentId
    this._swipeStartOffset = isDeleteOpen ? -240 : (isRestoreOpen ? 240 : 0)
        this._swipeDirectionDecided = false
    this._swipeLocked = false
  },

  onCardTouchMove(e) {
    const currentItems = this.data.items || []
    const dx = e.touches[0].clientX - this._swipeTouchStartX
    const dy = e.touches[0].clientY - this._swipeTouchStartY

    if (!this._swipeDirectionDecided) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      this._swipeDirectionDecided = true
      this._swipeLocked = Math.abs(dx) > Math.abs(dy) * 1.5
      if (!this._swipeLocked) {
        this._swipeCurrentId = null
        return
      }
    }

    if (!this._swipeLocked) return
    const id = this._swipeCurrentId
    if (!id) return
    const rawOffset = this._swipeStartOffset + dx

    // 节流：限制 setData 频率到约 30fps（33ms）
    const now = Date.now()
    const shouldUpdateUI = now - this._lastSwipeSetDataTime > 33

    if (rawOffset > 0) {
      // 向右滑：恢复操作
      const restoreOffset = Math.min(rawOffset, 300)
      const overRestore = restoreOffset >= 280
      const items = currentItems.map(item => {
        if (item.id === id) return { ...item, swipeOffset: restoreOffset, swiping: 'restore' }
        return item
      })
      if (shouldUpdateUI) {
        this._lastSwipeSetDataTime = now
        this.setData({ items, swipeOverRestore: overRestore })
      } else {
        // 即使不触发 setData，也要确保内部状态正确，用于后续逻辑判断
        this._tempSwipeData = { items, swipeOverRestore: overRestore }
      }
    } else {
      // 向左滑：删除操作
      const offset = Math.min(0, Math.max(-300, rawOffset))
      const overDelete = offset <= -280
      const items = currentItems.map(item => {
        if (item.id === id) return { ...item, swipeOffset: offset, swiping: 'delete' }
        return item
      })
      if (shouldUpdateUI) {
        this._lastSwipeSetDataTime = now
        this.setData({ items, swipeOverDelete: overDelete })
      } else {
        this._tempSwipeData = { items, swipeOverDelete: overDelete }
      }
    }
  },

  onCardTouchEnd(e) {
    if (!this._swipeLocked) return

    // 如果有缓存的临时数据（节流期间未触发 setData），先同步更新
    if (this._tempSwipeData) {
      this.setData(this._tempSwipeData)
      this._tempSwipeData = null
    }

    const dx = e.changedTouches[0].clientX - this._swipeTouchStartX
    const id = this._swipeCurrentId
    if (!id) return
    const rawOffset = this._swipeStartOffset + dx
    const currentItems = this.data.items || []
    const wasRestoreOpen = this._swipeStartOffset > 0
    const wasDeleteOpen = this._swipeStartOffset < 0

    if (rawOffset > 0) {
      if (rawOffset >= 200) {
        this.executeRestore(id)
      } else {
        const shouldKeepRestore = wasRestoreOpen ? dx > -30 : rawOffset >= 60
        if (shouldKeepRestore) {
          const items = currentItems.map(item =>
            item.id === id ? { ...item, swipeOffset: 240, swiping: 'restore' } : item
          )
          this.setData({ items, restoreOpenId: id, swipeOpenId: null, swipeOverRestore: false })
        } else {
          const items = currentItems.map(item =>
            item.id === id ? { ...item, swipeOffset: 0 } : item
          )
          this.setData({ items, restoreOpenId: null, swipeOverRestore: false })
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
  
    const overDelete = rawOffset <= -200
    if (overDelete) {
      const deletedItem = currentItems.find(item => item.id === id)
      const items = currentItems.map(item =>
        item.id === id ? { ...item, swipeOffset: 0 } : item
      )
      this.setData({ items, swipeOverDelete: false })
      this.executeDelete(id, deletedItem)
      return
    }
  
    const shouldOpenDelete = wasDeleteOpen ? dx < 30 : rawOffset < -60
    if (shouldOpenDelete) {
      const items = currentItems.map(item =>
        item.id === id ? { ...item, swipeOffset: -240, swiping: 'delete' } : item
      )
      this.setData({ items, swipeOpenId: id, restoreOpenId: null, swipeOverDelete: false })
    } else {
      // 保持当前 swiping 不变，等动画结束后清空
      const prevSwiping = (currentItems.find(i => i.id === id) || {}).swiping || ''
      const items = currentItems.map(item =>
        item.id === id ? { ...item, swipeOffset: 0 } : item
      )
      this.setData({ items, swipeOpenId: null, restoreOpenId: null, swipeOverDelete: false })
      setTimeout(() => {
        const items2 = (this.data.items || []).map(i =>
          i.id === id ? { ...i, swiping: '' } : i
        )
        this.setData({ items: items2 })
      }, 350)
    }
  },
  

  // ===== 恢复到进行中 =====

  executeRestore(id) {
    const item = (this.data.items || []).find(i => i.id === id)
    if (!item) return

    const items = (this.data.items || []).map(i =>
      i.id === id
        ? { ...i, flyOutRestore: true, flyOutCollapse: false }
        : i
    )    
    this.setData({ items, swipeOverRestore: false })

    setTimeout(() => {
      const items2 = (this.data.items || []).map(i =>
        i.id === id ? { ...i, flyOutCollapse: true } : i
      )
      this.setData({ items: items2 })
    }, 300)

    setTimeout(() => {
      storage.restoreItem(item)
      const items3 = (this.data.items || []).filter(i => i.id !== id)
      this.setData({ items: items3 })
    }, 700)
  },

  // ===== 删除 =====

  executeDelete(id, deletedItem) {
    if (this._undoCountdownTimer) { clearInterval(this._undoCountdownTimer); this._undoCountdownTimer = null }
    if (this._undoTimer) { clearTimeout(this._undoTimer); this._undoTimer = null }

    this._undoBatch = this._undoBatch || []
    const currentIds = (this.data.items || []).map(i => i.id)
    if (!this._undoBatchOrder) {
      this._undoBatchOrder = currentIds
    } else {
      currentIds.forEach(cid => {
        if (!this._undoBatchOrder.includes(cid)) this._undoBatchOrder.push(cid)
      })
    }
    this._undoBatch.push(deletedItem)
    const batchCount = this._undoBatch.length

    const items = (this.data.items || []).map(item =>
      item.id === id
        ? { ...item, flyOut: true, flyOutCollapse: false }
        : { ...item, flyOutRestore: false, flyOutCollapse: false }
    )
    this.setData({ items })

    setTimeout(() => {
      const items2 = (this.data.items || []).map(item =>
        item.id === id ? { ...item, flyOutCollapse: true } : item
      )
      this.setData({ items: items2 })
    }, 50)

    setTimeout(() => {
      storage.deleteCompletedItem(id)
      const items3 = (this.data.items || []).filter(item => item.id !== id)
      this.setData({ items: items3 })
    }, 600)

    this.setData({
      undoCount: batchCount,
      showUndo: true,
      undoCountdown: '6.0',
      undoProgressWidth: 100
    })
    setTimeout(() => { this.setData({ undoVisible: true }) }, 30)

    let countdown = 6.0
    this._undoCountdownTimer = setInterval(() => {
      countdown = Math.max(0, Math.round((countdown - 0.1) * 10) / 10)
      this.setData({
        undoCountdown: countdown.toFixed(1),
        undoProgressWidth: Math.round(countdown / 6 * 100)
      })
      if (countdown <= 0) { clearInterval(this._undoCountdownTimer); this._undoCountdownTimer = null }
    }, 100)

    this._undoTimer = setTimeout(() => {
      this.setData({ undoVisible: false })
      setTimeout(() => {
        this.setData({ showUndo: false, undoCountdown: '6.0', undoProgressWidth: 100 })
        this._undoBatch = []
        this._undoBatchOrder = null
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
      this.setData({ showUndo: false, undoCountdown: '6.0', undoProgressWidth: 100 })
      this._undoBatch = []
      this._undoBatchOrder = null
    }, 400)
  
    // 恢复回已完成列表，不进入进行中
    batch.forEach(item => {
      const completed = storage.getCompletedItems()
      if (!completed.find(c => c.id === item.id)) {
        completed.unshift({ ...item, swipeOffset: 0, flyOut: false, flyOutCollapse: false })
        wx.setStorageSync('completed_list', completed)
      }
    })
  
    // 重新加载并构建带动画状态的列表
    const raw = storage.getCompletedItems()
    const restoredIds = batch.map(b => b.id)
    const originalOrder = this._undoBatchOrder || []
  
    const now = new Date()
    const newItems = raw.map(item => {
      const emoji = item.customEmoji || this.getCategoryEmoji(item.name)
      const completedAt = item.completedAt || Date.now()
      const completedStr = this.formatDateTime(new Date(completedAt))
      let label, days, unit, cardClass
      if (item.mode === 'countup') {
        const startDate = new Date(item.date)
        startDate.setHours(0, 0, 0, 0)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24))
        label = '已坚持'; unit = '天'; cardClass = 'card-done-countup'
      } else {
        const completedDay = new Date(completedAt); completedDay.setHours(0, 0, 0, 0)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        days = Math.floor((today - completedDay) / (1000 * 60 * 60 * 24))
        label = '已过去'; unit = '天'; cardClass = 'card-done-countdown'
      }
      const isRestored = restoredIds.includes(item.id)
      return {
        ...item, emoji, completedStr, label, days, unit, cardClass,
        swipeOffset: 0, swiping: '',
        flyOut: false, flyOutCollapse: false,
        wrapStyle: isRestored ? 'max-height:0;margin-bottom:0;overflow:hidden;' : '',
        cardStyle: isRestored ? 'opacity:0;transform:translateX(-110%);' : ''
      }
    })
  
    // 按原始顺序排列
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
  
    restoringItems.forEach((item, index) => {
      const delay = 30 + index * 100
  
      // 展开高度
      setTimeout(() => {
        const items2 = this.data.items.map(i =>
          i.id === item.id
            ? { ...i, wrapStyle: 'max-height:200rpx;margin-bottom:20rpx;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),margin-bottom 0.5s cubic-bezier(0.4,0,0.2,1);' }
            : i
        )
        this.setData({ items: items2 })
      }, delay)
  
// 飞入 + 同步加 noGlow
    setTimeout(() => {
     const items3 = this.data.items.map(i =>
        i.id === item.id
          ? { ...i, cardStyle: 'opacity:1;transform:translateX(0);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.32,0.72,0,1);', noGlow: true }
         : i
     )
     this.setData({ items: items3 })
    }, delay + 50)

// 清空动画样式 + 移除 noGlow，触发 box-shadow 渐显
    setTimeout(() => {
      const items4 = this.data.items.map(i =>
        i.id === item.id ? { ...i, wrapStyle: '', cardStyle: '', noGlow: false } : i
      )
     this.setData({ items: items4 })
     }, delay + 560)
    })
  },
  
  // ===== 点击卡片弹窗 =====

  onItemTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const item = (this.data.items || []).find(i => i.id === id)
    if (!item) return
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null }
    this.setData({ showModal: true, modalActive: false, modalDragOffset: 0, selectedItem: item })
    setTimeout(() => { this.setData({ modalActive: true }) }, 30)
  },

  closeModal() {
    this.setData({ modalActive: false, modalDragOffset: 0 })
    if (this._closeTimer) clearTimeout(this._closeTimer)
    this._closeTimer = setTimeout(() => {
      this.setData({ showModal: false, selectedItem: null })
      this._closeTimer = null
    }, 360)
  },

  onModalTouchStart(e) {
    this._modalDragStartY = e.touches[0].clientY
    this._modalScrollTop = 0
  },

  onModalTouchMove(e) {
    if (this._modalScrollTop > 0) return
    const diff = e.touches[0].clientY - this._modalDragStartY
    if (diff <= 0) return
    this.setData({ modalDragOffset: diff })
  },

  onModalTouchEnd(e) {
    const diff = e.changedTouches[0].clientY - this._modalDragStartY
    if (diff > 80 && (this._modalScrollTop || 0) <= 0) {
      this.closeModal()
    } else {
      this.setData({ modalDragOffset: 0 })
    }
  },

  onModalScroll(e) {
    this._modalScrollTop = e.detail.scrollTop
  },

  onRestoreBtnTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    this.executeRestore(id)
  },
  
  onDeleteBtnTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const item = (this.data.items || []).find(i => i.id === id)
    this.executeDelete(id, item)
  },
  
  onRestoreFromModal() {
    const item = this.data.selectedItem
    if (!item) return
    this.closeModal()
    setTimeout(() => {
      this.executeRestore(item.id)
    }, 400)
  },

  openClearAllModal() {
    const count = (this.data.items || []).length
    if (count === 0) {
      wx.showToast({ title: '没有已完成项目', icon: 'none' })
      return
    }
    this.setData({ showClearAllModal: true, clearAllModalActive: false, clearAllCount: count })
    setTimeout(() => { this.setData({ clearAllModalActive: true }) }, 30)
  },
  
  closeClearAllModal() {
    this.setData({ clearAllModalActive: false })
    setTimeout(() => { this.setData({ showClearAllModal: false }) }, 360)
  },
  
  onClearAllModalTouchStart(e) {
    this._clearAllDragStartY = e.touches[0].clientY
  },
  
  onClearAllModalTouchMove(e) {},
  
  onClearAllModalTouchEnd(e) {
    const diff = e.changedTouches[0].clientY - this._clearAllDragStartY
    if (diff > 80) { this.closeClearAllModal() }
  },
  
  executeClearAll() {
    this.closeClearAllModal()
    setTimeout(() => {
      const currentItems = this.data.items || []
      if (!currentItems.length) return
  
      // 备份
      this._clearAllBackup = storage.getCompletedItems()
      const count = currentItems.length
  
      // 第一步：所有卡片触发飞出动画，错开 30ms
      currentItems.forEach((item, index) => {
        setTimeout(() => {
          const items = this.data.items.map(i =>
            i.id === item.id ? { ...i, flyOut: true, flyOutCollapse: false } : i
          )
          this.setData({ items })
        }, index * 30)
  
        // 紧接着触发高度收缩
        setTimeout(() => {
          const items = this.data.items.map(i =>
            i.id === item.id ? { ...i, flyOutCollapse: true } : i
          )
          this.setData({ items })
        }, index * 30 + 50)
      })
  
      // 动画全部结束后清空存储和列表
      const totalDelay = (currentItems.length - 1) * 30 + 600
      setTimeout(() => {
        wx.setStorageSync('completed_list', [])
        this.setData({ items: [] })
  
        // 清掉旧计时器
        if (this._clearAllUndoTimer) { clearTimeout(this._clearAllUndoTimer); this._clearAllUndoTimer = null }
        if (this._clearAllUndoCountdownTimer) { clearInterval(this._clearAllUndoCountdownTimer); this._clearAllUndoCountdownTimer = null }
  
        // 显示撤销横幅
        this.setData({
          showClearAllUndo: true,
          clearAllUndoVisible: false,
          undoCount: count,
          undoCountdown: '6.0',
          undoProgressWidth: 100
        })
        setTimeout(() => { this.setData({ clearAllUndoVisible: true }) }, 30)
  
        let countdown = 6.0
        this._clearAllUndoCountdownTimer = setInterval(() => {
          countdown = Math.max(0, Math.round((countdown - 0.1) * 10) / 10)
          this.setData({
            undoCountdown: countdown.toFixed(1),
            undoProgressWidth: Math.round(countdown / 6 * 100)
          })
          if (countdown <= 0) { clearInterval(this._clearAllUndoCountdownTimer); this._clearAllUndoCountdownTimer = null }
        }, 100)
  
        this._clearAllUndoTimer = setTimeout(() => {
          this.setData({ clearAllUndoVisible: false })
          setTimeout(() => {
            this.setData({ showClearAllUndo: false, undoCountdown: '6.0', undoProgressWidth: 100 })
            this._clearAllBackup = []
          }, 400)
          this._clearAllUndoTimer = null
        }, 6000)
  
      }, totalDelay)
    }, 360)
  },

  
  undoClearAll() {
    if (this._clearAllUndoTimer) { clearTimeout(this._clearAllUndoTimer); this._clearAllUndoTimer = null }
    if (this._clearAllUndoCountdownTimer) { clearInterval(this._clearAllUndoCountdownTimer); this._clearAllUndoCountdownTimer = null }
  
    const backup = this._clearAllBackup || []
    if (!backup.length) return
  
    // 恢复存储
    wx.setStorageSync('completed_list', backup)
    this._clearAllBackup = []
  
    this.setData({ clearAllUndoVisible: false })
    setTimeout(() => {
      this.setData({ showClearAllUndo: false, undoCountdown: '6.0', undoProgressWidth: 100 })
    }, 400)
  
    // 构建带初始动画状态的列表（全部从左飞入）
    const raw = storage.getCompletedItems()
    const newItems = raw.map(item => {
      const emoji = item.customEmoji || this.getCategoryEmoji(item.name)
      const completedAt = item.completedAt || Date.now()
      const completedStr = this.formatDateTime(new Date(completedAt))
      let label, days, unit, cardClass
      if (item.mode === 'countup') {
        const startDate = new Date(item.date)
        startDate.setHours(0, 0, 0, 0)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        days = Math.floor((today - startDate) / (1000 * 60 * 60 * 24))
        label = '已坚持'; unit = '天'; cardClass = 'card-done-countup'
      } else {
        const completedDay = new Date(completedAt); completedDay.setHours(0, 0, 0, 0)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        days = Math.floor((today - completedDay) / (1000 * 60 * 60 * 24))
        label = '已过去'; unit = '天'; cardClass = 'card-done-countdown'
      }
      return {
        ...item, emoji, completedStr, label, days, unit, cardClass,
        swipeOffset: 0, swiping: '',
        flyOut: false, flyOutCollapse: false,
        wrapStyle: 'max-height:0;margin-bottom:0;overflow:hidden;',
        cardStyle: 'opacity:0;transform:translateX(-110%);'
      }
    })
  
    this.setData({ items: newItems })
  
    // 逐卡片错开飞入，每张间隔 60ms
    newItems.forEach((item, index) => {
      const delay = 30 + index * 60
  
      // 展开高度
      setTimeout(() => {
        const items2 = this.data.items.map(i =>
          i.id === item.id
            ? { ...i, wrapStyle: 'max-height:200rpx;margin-bottom:20rpx;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1),margin-bottom 0.5s cubic-bezier(0.4,0,0.2,1);' }
            : i
        )
        this.setData({ items: items2 })
      }, delay)
  
  // 飞入 + 同步加 noGlow
    setTimeout(() => {
      const items3 = this.data.items.map(i =>
        i.id === item.id
         ? { ...i, cardStyle: 'opacity:1;transform:translateX(0);transition:opacity 0.5s ease,transform 0.5s cubic-bezier(0.32,0.72,0,1);', noGlow: true }
          : i
     )
     this.setData({ items: items3 })
    }, delay + 50)

   // 清空动画样式 + 移除 noGlow
    setTimeout(() => {
      const items4 = this.data.items.map(i =>
        i.id === item.id ? { ...i, wrapStyle: '', cardStyle: '', noGlow: false } : i
      )
     this.setData({ items: items4 })
    }, delay + 560)
    })
  },
  
  openAboutModal() {
    this.setData({ showAboutModal: true, aboutModalActive: false })
    setTimeout(() => { this.setData({ aboutModalActive: true }) }, 30)
  },
  
  closeAboutModal() {
    this.setData({ aboutModalActive: false })
    setTimeout(() => { this.setData({ showAboutModal: false }) }, 360)
  },
  
  onAboutModalTouchStart(e) {
    this._aboutModalDragStartY = e.touches[0].clientY
  },
  
  onAboutModalTouchMove(e) {
    // 仅用于 touchend 判断，不需要实时更新
  },
  
  onAboutModalTouchEnd(e) {
    const diff = e.changedTouches[0].clientY - this._aboutModalDragStartY
    if (diff > 80) {
      this.closeAboutModal()
    }
  },
  
  openBeian() {
    // 直接复制备案查询网址，不依赖任何第三方小程序的 appId
    wx.setClipboardData({
      data: 'https://beian.miit.gov.cn',
      success: () => wx.showToast({ title: '网址已复制，可在浏览器打开', icon: 'none' })
    })
  },
  
  openPrivacy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({ fail: () => {} })
    }
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
