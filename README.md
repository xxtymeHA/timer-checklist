# 实用计时清单

一个用微信原生小程序 + 云开发写的到期提醒工具：记下物品或事项的截止时间，到期前通过微信「服务通知」推送提醒。

支持两种计时模式：倒计时看还有几天到期，正计时看已经坚持了多久。

- 前端：微信小程序原生框架（WXML / WXSS / JS）
- 后端：微信云开发（云函数 + 云数据库 + 定时触发器）
- 基础库：3.14.2
- 无第三方 npm 依赖，导入即可编译

## 功能

- 两种计时模式：倒计时对应到期日，正计时对应开始时间
- 卡片列表，左滑删除、右滑完成，操作后可在倒计时内撤销
- 到期提醒的提前量按分钟、小时、天设置
- 已完成页支持按完成时间、名称、剩余天数排序，可恢复到进行中
- 清空全部前自动备份，并可撤销
- 保存前调用微信内容安全接口 `msgSecCheck`，违规内容不写入
- 自定义分享封面、隐私协议入口、工信部备案网址一键复制
- 正文数据全部存在本地 `wx.setStorageSync`，只有勾选了提醒的事项才同步到云数据库

## 目录结构

```
miniprogram/                    小程序前端
  app.js                        云开发初始化，读取 config.js
  config.example.js             本地配置模板（云环境 ID、订阅模板 ID）
  app.json                      页面注册与 tabBar
  app.wxss                      全局样式
  pages/index/                  「进行中」页：列表、新建、提醒订阅
  pages/tool/                   「已完成」页：排序、恢复、清空、关于
  utils/storage.js              本地存储读写 + 默认提醒配置
  utils/timeHelper.js           剩余天数计算与展示文案
  utils/textTools.js            文本处理
  images/                       tabBar 图标、分享封面
cloudfunctions/
  getOpenid/                    返回当前用户 openid
  checkContent/                 内容安全检测，调用 msgSecCheck
  sendReminder/                 定时扫描到期事项并发送订阅消息
  sendReminder/config.json      定时触发器，每分钟一次
project.config.example.json     开发者工具项目配置模板
```

## 快速开始

### 1. 导入项目

```bash
cp project.config.example.json project.config.json
cp miniprogram/config.example.js miniprogram/config.js
```

用微信开发者工具导入本目录，在 `project.config.json` 里填入你自己的小程序 AppID。

`miniprogram/config.js` 是本地私有配置，已被 `.gitignore` 排除，不会提交。缺少它时小程序无法编译，务必先复制。

### 2. 开通云开发

在开发者工具里开通云开发、创建环境，把环境 ID 填到 `miniprogram/config.js`：

```js
module.exports = {
  cloudEnv: '你的云环境 ID',
  subscribeTemplateId: '你的订阅消息模板 ID'
}
```

数据库新建集合 `reminders`，权限设为「仅创建者可读写」。

云端记录字段：

```
openid, localId, name, date, time, mode, subscribed,
reminderContent, note, reminderDays,
earlyReminderEnabled, earlyReminderValue, earlyReminderUnit,
lastSentDate, lastEarlySentDate, updatedAt
```

### 3. 部署云函数

`cloudfunctions` 下三个目录分别右键「上传并部署：云端安装依赖」。

`checkContent` 和 `sendReminder` 需要三个环境变量，在云开发控制台的函数配置里添加：

| 变量 | 值 |
| --- | --- |
| `APPID` | 小程序 AppID |
| `APPSECRET` | 小程序 AppSecret |
| `TEMPLATE_ID` | 订阅消息模板 ID |

AppSecret 只从这里读取，代码中没有任何硬编码，也不要把 AppSecret 提交到仓库。

`sendReminder` 的定时触发器写在 `config.json`，表达式 `0 * * * * * *` 表示每分钟执行一次。部署后在控制台确认触发器已生效。

### 4. 配置订阅消息

在微信公众平台申请订阅消息模板，四个字段的对应关系固定：

| 字段 | 含义 |
| --- | --- |
| `thing5` | 事项名称 |
| `date9` | 到期时间 |
| `thing2` | 提醒文案 |
| `thing11` | 备注 |

拿到模板 ID 后填两处，两处必须一致：

- `miniprogram/config.js` 的 `subscribeTemplateId`，供前端 `requestSubscribeMessage` 使用
- 云函数 `sendReminder` 的环境变量 `TEMPLATE_ID`

## 提醒逻辑

1. 用户勾选提醒后，前端 `requestSubscribeMessage` 取得授权，把事项同步到 `reminders` 集合
2. `sendReminder` 每分钟查一次 `subscribed: true` 的记录，计算 `date` 与北京时间的差值
3. 剩余天数落在 `reminderDays` 内且已过当天设定时刻，就发一条订阅消息
4. 提前提醒单独判断，按 `earlyReminderValue` 与 `earlyReminderUnit` 反推触发时间
5. 用 `lastSentDate`、`lastEarlySentDate` 记录当天已发送的键，避免重复推送

订阅消息是一次性授权，用户每授权一次只能收到一条，长期使用需要引导用户重复订阅。

## 敏感信息处理

- 仓库不含 AppSecret，`APPSECRET` 仅从云函数环境变量读取
- `project.config.json` 含本机 AppID，已被 `.gitignore` 排除，仓库只保留 `project.config.example.json`
- 云环境 ID、订阅模板 ID 被抽到 `miniprogram/config.js`（已忽略），仓库只保留 `config.example.js`
- `pages/tool/index.wxml` 的「关于」弹窗里，联系邮箱与 ICP 备案号是占位符，部署前替换成你自己的
- 仓库不含任何第三方小程序的 AppID，「备案查询」改为复制 beian.miit.gov.cn 网址，不依赖小程序跳转

## License

MIT，原始版权声明见 [LICENSE](LICENSE)。本项目由微信官方 [miniprogram-demo](https://github.com/wechat-miniprogram/miniprogram-demo) 改造而来。
