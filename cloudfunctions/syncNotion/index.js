// cloudfunctions/syncNotion/index.js
const cloud = require('wx-server-sdk')
const { Client } = require('@notionhq/client')
const fetch = require('node-fetch') 
global.fetch = fetch

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ★★★ 你的配置 ★★★
const NOTION_KEY = 'NOTION_KEY_PLACEHOLDER'; 
const DATABASE_ID = '1f0e7299241d819db537daa4eb44c572'; 

// 直连 Notion (得益于你设置的 60s 超时，成功率很高)
const notion = new Client({ auth: NOTION_KEY })

// 数据清洗逻辑
const cleanData = (results) => {
  return results.map(page => {
    const props = page.properties;
    
    // 软删除标记 (如果在 Notion 勾选了 Archived)
    const isDeleted = props['Archived']?.checkbox || false;

    // 图片
    const fileObj = props['豆袋包装']?.files?.[0] || props['Image']?.files?.[0];
    const imageUrl = fileObj?.file?.url || fileObj?.external?.url || page.cover?.file?.url || page.cover?.external?.url || '';

    // Tags
    const tags = [];
    if (props['处理方式']?.rich_text?.[0]?.plain_text) tags.push(props['处理方式'].rich_text[0].plain_text);
    if (props['产区/庄园']?.rich_text?.[0]?.plain_text) tags.push(props['产区/庄园'].rich_text[0].plain_text);

    // 风味
    const rawFlavorText = props['风味描述']?.rich_text?.[0]?.plain_text || '';
    let flavorArray = rawFlavorText ? rawFlavorText.replace(/、/g, ',').replace(/，/g, ',').split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

    return {
      _id: page.id, // 暂存 ID，后面写入时会剔除
      last_edited_time: page.last_edited_time, // 关键时间戳
      
      name: props['咖啡名称']?.title?.[0]?.plain_text || '未命名',
      roaster: props['烘焙商']?.rich_text?.[0]?.plain_text || 'Unknown',
      process: props['处理方式']?.rich_text?.[0]?.plain_text || '',
      country: props['国家']?.rich_text?.[0]?.plain_text || '', 
      region: props['产区 / 庄园']?.rich_text?.[0]?.plain_text || '-', 
      varietal: props['豆种']?.rich_text?.[0]?.plain_text || '-', 
      altitude: props['海拔']?.rich_text?.[0]?.plain_text || '-', 
      producer: props['生产者']?.rich_text?.[0]?.plain_text || '-', 
      flavor: flavorArray,
      notes: props['备注']?.rich_text?.[0]?.plain_text || '',
      score: props['评分']?.number || 0,
      price: props['单价（元/g）']?.number || 0,
      roast_date: props['烘焙日期']?.date?.start || '-',
      open_date: props['开封日期']?.date?.start || '-',
      
      image: imageUrl,
      tags: tags.length > 0 ? tags : ['精选'],
      
      is_deleted: isDeleted, // 写入删除状态
      updatedAt: db.serverDate()
    }
  });
}

exports.main = async (event, context) => {
  const collection = db.collection('coffee_list');
  const configCollection = db.collection('system_config');
  const CONFIG_ID = 'notion_sync_cursor'; 
  
  // 允许强制重跑: { force: true }
  const forceReset = event.force === true;

  try {
    let lastSyncTime = null;

    // 1. 获取上次同步到的时间
    if (!forceReset) {
      const configRes = await configCollection.doc(CONFIG_ID).get().catch(() => ({ data: null }));
      if (configRes.data && configRes.data.last_sync_time) {
        lastSyncTime = configRes.data.last_sync_time;
        console.log('增量模式：上次同步时间', lastSyncTime);
      }
    }

    // 2. 构建查询
    const queryParams = {
      database_id: DATABASE_ID,
      sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }], 
    };

    // 如果有记录，只查新数据
    if (lastSyncTime) {
      queryParams.filter = {
        timestamp: "last_edited_time",
        last_edited_time: { after: lastSyncTime }
      };
    }

    let hasMore = true;
    let nextCursor = undefined;
    let processCount = 0;
    let maxTimeInBatch = lastSyncTime;

    while (hasMore) {
      if (nextCursor) queryParams.start_cursor = nextCursor;
      
      const response = await notion.databases.query(queryParams);
      const results = response.results;
      
      if (results.length > 0) {
        const cleanList = cleanData(results);
        
        // 3. 批量写入 (修复了 _id 报错)
        const tasks = cleanList.map(item => {
          if (!maxTimeInBatch || item.last_edited_time > maxTimeInBatch) {
            maxTimeInBatch = item.last_edited_time;
          }
          
          // ★★★ 核心修复：把 _id 单独拿出来，不放进 data 里 ★★★
          const { _id, ...otherFields } = item;

          return collection.doc(_id).set({ data: otherFields });
        });
        
        await Promise.all(tasks);
        processCount += results.length;
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor;
    }

    // 4. 保存最新的时间游标
    if (maxTimeInBatch) {
      await configCollection.doc(CONFIG_ID).set({
        data: {
          last_sync_time: maxTimeInBatch,
          updatedAt: db.serverDate()
        }
      });
    }

    return { 
      success: true, 
      msg: processCount > 0 ? `同步更新了 ${processCount} 条` : '无数据更新', 
      newCursor: maxTimeInBatch 
    };

  } catch (error) {
    console.error(error);
    // 如果是网络超时，因为有增量逻辑，下次会继续尝试，不慌
    return { success: false, error: error.message };
  }
}