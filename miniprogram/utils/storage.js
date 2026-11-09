const config = require('../config')

const STORAGE_KEY = 'item_list'
const REMINDER_KEY = 'reminder_config'
const COMPLETED_KEY = 'completed_list'


function getItems() {
  return wx.getStorageSync(STORAGE_KEY) || []
}

function saveItems(items) {
  wx.setStorageSync(STORAGE_KEY, items)
}

function addItem(item) {
  const items = getItems()
  items.unshift(item)
  saveItems(items)
}

function updateItem(id, newData) {
  const items = getItems()
  const index = items.findIndex(i => i.id === id)
  if (index !== -1) {
    items[index] = { ...items[index], ...newData }
    saveItems(items)
  }
}

function deleteItem(id) {
  const items = getItems().filter(i => i.id !== id)
  saveItems(items)
}

function getCompletedItems() {
  return wx.getStorageSync(COMPLETED_KEY) || []
}

function completeItem(item) {
  const items = getItems().filter(i => i.id !== item.id)
  saveItems(items)
  const completed = getCompletedItems()
  completed.unshift({ ...item, completedAt: Date.now() })
  wx.setStorageSync(COMPLETED_KEY, completed)
}

function deleteCompletedItem(id) {
  const items = getCompletedItems().filter(i => i.id !== id)
  wx.setStorageSync(COMPLETED_KEY, items)
}

function restoreItem(item) {
  const completed = getCompletedItems().filter(i => i.id !== item.id)
  wx.setStorageSync(COMPLETED_KEY, completed)
  const active = getItems()
  active.unshift({ ...item, completedAt: undefined, swipeOffset: 0, completeOffset: 0, flyOut: false, flyOutCollapse: false })
  saveItems(active)
}


function getReminderConfig() {
  return wx.getStorageSync(REMINDER_KEY) || {
    templateId: config.subscribeTemplateId,
    reminderDays: 3
  }
}

function saveReminderConfig(config) {
  wx.setStorageSync(REMINDER_KEY, config)
}

module.exports = {
  getItems, saveItems, addItem, updateItem, deleteItem,
  completeItem, getCompletedItems, deleteCompletedItem, restoreItem,
  getReminderConfig, saveReminderConfig, 
  getSortConfig() {
    return wx.getStorageSync('sort_config') || { mode: 'default' }
  },
  
  setSortConfig(config) {
    wx.setStorageSync('sort_config', config)
  },
}
