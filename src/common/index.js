import { getNews, getTXweather, getSweetWord } from '../proxy/api.js'
import { sendFriend, sendRoom, asyncData, getOne, getMaterial } from '../proxy/aibotk.js'
import { getUser } from '../db/userDb.js'
import { formatDate, getDay, MD5, groupArray, delay } from '../lib/index.js'
import { FileBox } from 'file-box'
import { allConfig } from '../db/configDb.js'
/**
 * 获取每日新闻内容
 * @param {*} sortId 新闻资讯分类Id
 * @param {*} endWord 结尾备注
 */
async function getNewsContent(sortId, endWord = '', num = 10) {
  let today = formatDate(new Date()) //获取今天的日期
  let news = await getNews(sortId, num)
  let content = `${today}\n${news}\n${endWord?'————————':''}${endWord}`
  return content
}
/**
 * 获取每日说内容
 * @param {*} date 与朋友的纪念日
 * @param {*} city 朋友所在城市
 * @param {*} endWord 结尾备注
 */
async function getEveryDayContent(date, city, endWord) {
  let one = await getOne() //获取每日一句
  let weather = await getTXweather(city) //获取天气信息
  let today = formatDate(new Date()) //获取今天的日期
  let memorialDay = getDay(date) //获取纪念日天数
  let sweetWord = await getSweetWord() // 土味情话
  let str = `${today}\n我们在一起的第${memorialDay}天\n\n元气满满的一天开始啦,要开心噢^_^\n\n今日天气\n${weather.weatherTips}\n${weather.todayWeather}\n每日一句:\n${one}\n\n情话对你说:\n${sweetWord}\n\n————————${endWord}`
  return str
}

async function getRoomEveryDayContent(date, city, endWord) {
  let one = await getOne() //获取每日一句
  let weather = await getTXweather(city) //获取天气信息
  let today = formatDate(new Date()) //获取今天的日期
  let memorialDay = getDay(date) //获取纪念日天数
  let str = `${today}\n家人们相聚在一起的第${memorialDay}天\n\n元气满满的一天开始啦,家人们要努力保持活跃啊^_^\n\n今日天气\n${weather.weatherTips}\n${weather.todayWeather}\n每日一句:\n${one}\n\n————————${endWord}`
  return str
}

/**
 * 获取倒计时内容
 * @param date
 * @param prefix
 * @param suffix
 * @param endWord
 * @return {string}
 */
function getCountDownContent(date, prefix, suffix, endWord) {
  let countDownDay = getDay(date) //获取倒计时天数
  let today = formatDate(new Date()) //获取今天的日期
  let str = `${today}\r距离${prefix}还有\r\r${countDownDay}天\r\r${suffix}${endWord?`\r\r————————${endWord}`:''}`
  return str;
}
/**
 * 更新用户信息
 */
async function updateContactInfo(that) {
  try {
    const contactSelf = await getUser()
    const hasWeixin = contactSelf && !!contactSelf.weixin
    const contactList = await that.Contact.findAll() || []
    let res = []
    const notids = ['filehelper', 'fmessage']
    let realContact = hasWeixin
      ? contactList.filter((item) => {
          const payload = item.payload || item._payload
          return payload.type === 1 && payload.friend && !notids.includes(payload.id)
        })
      : contactList
    for (let i of realContact) {
      let contact = i.payload || i._payload
      let obj = {
        robotId: hasWeixin ? contactSelf.weixin : MD5(contactSelf.name),
        contactId: hasWeixin ? contact.id : MD5(contactSelf.name + contact.name + contact.alias + contact.province + contact.city + contact.gender),
        wxid: contact.id,
        name: contact.name,
        alias: contact.alias,
        gender: contact.gender,
        province: contact.province,
        city: contact.city,
        avatar: hasWeixin ? contact.avatar : '',
        friend: contact.friend,
        signature: contact.signature,
        star: contact.star,
        type: hasWeixin ? contact.type : '',
        weixin: hasWeixin ? contact.weixin : '',
      }
      res.push(obj)
    }
    await updateFriendInfo(res, 50)
  } catch (e) {
    console.log('e', e)
  }
}
/**
 * 分批次更新好友信息
 * @param {*} list 好友列表
 * @param {*} num 每次发送数据
 */
async function updateFriendInfo(list, num) {
  const arr = groupArray(list, num)
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    await sendFriend(item)
    await delay(500)
  }
}
/**
 * 更新群列表
 */
async function updateRoomInfo(that) {
  try {
    const contactSelf = await getUser()
    const hasWeixin = contactSelf && !!contactSelf.weixin
    const roomList = await that.Room.findAll() || []
    let res = []
    for (let i of roomList) {
      let room = i.payload || i._payload
      let obj = {
        robotId: hasWeixin ? contactSelf.weixin : MD5(contactSelf.name),
        wxid: room.id,
        roomId: MD5(room.topic),
        topic: room.topic,
        avatar: room.avatar || '',
        ownerId: room.ownerId || '',
        adminIds: room.adminIdList.toString(),
        memberCount: room.memberIdList.length,
      }
      res.push(obj)
    }
    await updateRoomsInfo(res, 40)
  } catch (e) {
    console.log('e', e)
  }
}
/**
 * 更新群信息
 * @param {*} list 好友列表
 * @param {*} num 每次发送数据
 */
async function updateRoomsInfo(list, num) {
  const arr = groupArray(list, num)
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    await sendRoom(item)
    await delay(500)
  }
}
/**
 * 统一触发加群欢迎词
 * @param room 群
 * @param roomName 群名
 * @param contactName 进群人
 * @param msg 消息
 */
async function addRoomWelcomeSay(room, roomName, contactName, msg) {
  if (msg.type === 1 && msg.content !== '') {
    // 文字
    console.log('回复内容', msg.content)
    await room.say(`${roomName}：欢迎新朋友 @${contactName}，\n${msg.content}`)
  } else if (msg.type === 2 && msg.url !== '') {
    // url文件
    let obj = FileBox.fromUrl(msg.url)
    console.log('回复内容', obj)
    await room.say(obj)
  }
}
/**
 * 群关键词回复
 * @param {*} contact
 * @param {*} msg
 * @param {*} isRoom
 */
async function roomSay(room, contact, msg) {
  const config = await allConfig()
  const { role } = config.userInfo
  if (msg.id && role === 'vip') {
    const res = await getMaterial(msg.id)
    if(res.id) {
      msg = res
    }
  }
  console.log('回复内容：', JSON.stringify(msg))
  try {
    if (msg.type === 1 && msg.content) {
      // 文字
      contact ? await room.say(msg.content, contact) : await room.say(msg.content)
    } else if (msg.type === 2 && msg.url) {
      // url文件
      let obj = FileBox.fromUrl(msg.url)
      contact ? await room.say('', contact) : ''
      await delay(500)
      await room.say(obj)
    } else if (msg.type === 3 && msg.url) {
      // bse64文件
      let obj = FileBox.fromDataURL(msg.url, 'room-avatar.jpg')
      contact ? await room.say('', contact) : ''
      await delay(500)
      await room.say(obj)
    } else if (msg.type === 4 && msg.url && msg.title && msg.description) {
      let url = new this.UrlLink({
        description: msg.description,
        thumbnailUrl: msg.thumbUrl,
        title: msg.title,
        url: msg.url,
      })
      await room.say(url)
    } else if (msg.type === 5 && msg.appid && msg.title && msg.pagePath && msg.description && msg.thumbUrl) {
      let miniProgram = new this.MiniProgram({
        appid: msg.appid,
        title: msg.title,
        pagePath: msg.pagePath,
        description: msg.description,
        thumbUrl: msg.thumbUrl,
        thumbKey: msg.thumbKey,
        username: msg.username || ''
      })
      await room.say(miniProgram)
    }
  } catch (e) {
    console.log('群回复错误', e)
  }
}
/**
 * 私聊发送消息
 * @param contact
 * @param msg
 * @param isRoom
 *  type 1 文字 2 图片url 3 图片base64 4 url链接 5 小程序  6 名片
 */
async function contactSay(contact, msg, isRoom = false) {
  const config = await allConfig()
  const { role } = config.userInfo
  if (msg.id && role === 'vip') {
    const res = await getMaterial(msg.id)
    if(res.id) {
      msg = res
    }
  }
  console.log('回复内容：', JSON.stringify(msg))
  try {
    if (msg.type === 1 && msg.content) {
      // 文字
      await contact.say(msg.content)
    } else if (msg.type === 2 && msg.url) {
      // url文件
      let obj = FileBox.fromUrl(msg.url)
      await obj.ready()
      await contact.say(obj)
    } else if (msg.type === 3 && msg.url) {
      // bse64文件
      let obj = FileBox.fromDataURL(msg.url, 'user-avatar.jpg')
      await contact.say(obj)
    } else if (msg.type === 4 && msg.url && msg.title && msg.description) {
      let url = new this.UrlLink({
        description: msg.description,
        thumbnailUrl: msg.thumbUrl,
        title: msg.title,
        url: msg.url,
      })
      await contact.say(url)
    } else if (msg.type === 5 && msg.appid && msg.title && msg.pagePath && msg.description && msg.thumbUrl) {
      let miniProgram = new this.MiniProgram({
        appid: msg.appid,
        title: msg.title,
        pagePath: msg.pagePath,
        description: msg.description,
        thumbUrl: msg.thumbUrl,
        thumbKey: msg.thumbKey,
        username: msg.username || ''
      })
      await contact.say(miniProgram)
    }
  } catch (e) {
    console.log('私聊发送消息失败', e)
  }
}
/**
 * 统一邀请加群
 * @param that
 * @param contact
 */
async function addRoom(that, contact, roomName, replys) {
  let room = await that.Room.find({ topic: roomName })
  if (room) {
    try {
      for (const item of replys) {
        await delay(2000)
        await contactSay.call(that, contact, item)
      }
      await room.add(contact)
    } catch (e) {
      console.error('加群报错', e)
    }
  } else {
    console.log(`不存在此群：${roomName}`)
  }
}
/**
 * 重新同步好友和群组
 * @param that
 * @returns {Promise<void>}
 */
async function updateContactAndRoom(that) {
  const contactSelf = await getUser()
  await asyncData(contactSelf.robotId, 1)
  await delay(3000)
  await asyncData(contactSelf.robotId, 2)
  await delay(3000)
  await updateRoomInfo(that)
  await delay(3000)
  await updateContactInfo(that)
}
/**
 * 重新同步好友
 * @param that
 * @returns {Promise<void>}
 */
async function updateContactOnly(that) {
  const contactSelf = await getUser()
  await asyncData(contactSelf.robotId, 1)
  await delay(3000)
  await updateContactInfo(that)
}
/**
 * 重新同步群
 * @param that
 * @returns {Promise<void>}
 */
async function updateRoomOnly(that) {
  const contactSelf = await getUser()
  await asyncData(contactSelf.robotId, 2)
  await delay(3000)
  await updateRoomInfo(that)
}
export { updateRoomOnly }
export { updateContactOnly }
export { getEveryDayContent }
export { getNewsContent }
export { updateContactInfo }
export { updateRoomInfo }
export { addRoom }
export { contactSay }
export { roomSay }
export { addRoomWelcomeSay }
export { updateContactAndRoom }
export { getRoomEveryDayContent }
export { getCountDownContent }
export default {
  updateRoomOnly,
  updateContactOnly,
  getEveryDayContent,
  getNewsContent,
  updateContactInfo,
  updateRoomInfo,
  addRoom,
  contactSay,
  roomSay,
  addRoomWelcomeSay,
  updateContactAndRoom,
  getCountDownContent
}
