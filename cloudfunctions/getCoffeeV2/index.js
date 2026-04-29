// cloudfunctions/getCoffeeV2/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const result = await db.collection('coffee_list')
      .where({
        // ★★★ 核心修改：排除掉 is_deleted 为 true 的数据 ★★★
        is_deleted: _.neq(true) 
      })
      .orderBy('open_date', 'desc')
      .limit(100)
      .get()

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}