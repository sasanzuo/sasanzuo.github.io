// pages/index/index.js

const CONTINENT_MAP = {
  'Ethiopia': '非洲', '埃塞俄比亚': '非洲',
  'Kenya': '非洲', '肯尼亚': '非洲',
  'Rwanda': '非洲', '卢旺达': '非洲',
  'Burundi': '非洲', '布隆迪': '非洲',
  'Tanzania': '非洲', '坦桑尼亚': '非洲',
  'Uganda': '非洲', '乌干达': '非洲',
  'China': '亚洲', '中国': '亚洲',
  'Nepal': '亚洲', '尼泊尔': '亚洲',
  'Yunnan': '亚洲', '云南': '亚洲',
  'Indonesia': '亚洲', '印度尼西亚': '亚洲', '印尼': '亚洲',
  'Yemen': '亚洲', '也门': '亚洲',
  'Vietnam': '亚洲', '越南': '亚洲',
  'Papua New Guinea': '亚洲', '巴布亚新几内亚': '亚洲',
  'Colombia': '美洲', '哥伦比亚': '美洲',
  'Brazil': '美洲', '巴西': '美洲',
  'Panama': '美洲', '巴拿马': '美洲',
  'Costa Rica': '美洲', '哥斯达黎加': '美洲',
  'Guatemala': '美洲', '危地马拉': '美洲',
  'Honduras': '美洲', '洪都拉斯': '美洲',
  'El Salvador': '美洲', '萨尔瓦多': '美洲',
  'Peru': '美洲', '秘鲁': '美洲',
  'Bolivia': '美洲', '玻利维亚': '美洲',
  'Mexico': '美洲', '墨西哥': '美洲'
};

Page({
  data: {
    allCoffees: [],      
    filteredCoffees: [], 
    coffees: [],         
    
    loading: true, 
    lastUpdated: '',
    sortBy: 'date', 
    filterCategories: ['全部'], 
    activeFilter: '全部',

    // 分页状态
    pageSize: 10,
    currentPage: 1,
    hasMore: true, 

    // 彩蛋控制变量
    showEasterEgg: false 
  },

  onLoad: function () {
    console.log('🚀 onLoad 触发：开始首次加载');
    this.getData();
  },

  onShow: function () {
    if (this.data.coffees.length > 0) {
      console.log('🔄 onShow 触发：静默更新数据');
      this.getData(true);
    }
  },

  onPullDownRefresh: function() {
    console.log('⬇️ 下拉刷新触发');
    this.getData();
  },

  onReachBottom: function() {
    if (this.data.hasMore) {
      this.loadMoreData();
    }
  },

// 判断国家/大洲归属
getContinent: function(countryName) {
  if (!countryName) return '其他';
  
  // ★★★ 新增：优先判断是否为拼配 ★★★
  // 只要国家名称里包含顿号 "、" (或者逗号)，就直接归类为 "拼配"
  // 这样它就不会被分到非洲或美洲，而是单独成为一个分类
  if (countryName.includes('、') || countryName.includes(',')) {
    return '拼配';
  }

  // 原有的通过国家名匹配大洲的逻辑
  for (let key in CONTINENT_MAP) {
    if (countryName.includes(key)) return CONTINENT_MAP[key];
  }
  return '其他';
},

  getProcessCategory: function(processName) {
    if (!processName) return '特殊处理';
    const name = processName.trim();
    const washedTags = ['水洗处理（Washed）', '水洗', 'Washed', 'Washe'];
    if (washedTags.includes(name)) return '水洗处理';
    const naturalTags = ['日晒处理（Natural）', '日晒', 'Natural', 'Dry Process'];
    if (naturalTags.includes(name)) return '日晒处理';
    return '特殊处理';
  },

  getData: function(isSilent = false) {
    const startTime = Date.now();

    if (!isSilent && this.data.coffees.length === 0) {
      this.setData({ loading: true });
    }

    wx.cloud.callFunction({
      name: 'getCoffeeV2', 
      success: res => {
        if (res.result && res.result.success) {
          const rawData = res.result.data.map(item => ({
            ...item,
            priceDisplay: Number(item.price || 0).toFixed(1),
            _continent: this.getContinent(item.country),
            _processCat: this.getProcessCategory(item.process)
          }));

          this.generateFilters(rawData);

          const duration = Date.now() - startTime;
          const minLoadingTime = 800; 
          const waitTime = isSilent ? 0 : (duration > minLoadingTime ? 0 : (minLoadingTime - duration));

          setTimeout(() => {
            this.setData({
              allCoffees: rawData,
              lastUpdated: new Date().toTimeString().slice(0, 5)
            }, () => {
              this.applySortAndFilter();
              this.setData({ loading: false });
            });
          }, waitTime);
        }
      },
      fail: (err) => {
        console.error("❌ 数据请求失败", err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      },
      complete: () => {
        wx.stopPullDownRefresh();
      }
    })
  },

  generateFilters: function(data) {
    const categories = new Set();
    data.forEach(item => {
      if (item._continent && item._continent !== '其他') {
        categories.add(item._continent);
      }
    });

    const processTypes = ['水洗处理', '日晒处理', '特殊处理'];
    const availableProcesses = new Set();
    data.forEach(item => {
      availableProcesses.add(item._processCat);
    });

    const finalFilters = ['全部', ...Array.from(categories)];
    processTypes.forEach(p => {
      if (availableProcesses.has(p)) {
        finalFilters.push(p);
      }
    });

    this.setData({ filterCategories: finalFilters });
  },

  applySortAndFilter: function() {
    let result = [...this.data.allCoffees];

    if (this.data.activeFilter !== '全部') {
      const key = this.data.activeFilter;
      result = result.filter(item => {
        return item._continent === key || item._processCat === key;
      });
    }

    if (this.data.sortBy === 'date') {
      result.sort((a, b) => (b.open_date || '0') > (a.open_date || '0') ? 1 : -1);
    } else if (this.data.sortBy === 'score') {
      result.sort((a, b) => b.score - a.score);
    }

    this.setData({ 
      filteredCoffees: result,
      currentPage: 1 
    }, () => {
      this.loadMoreData(true);
    });
  },

  loadMoreData: function(isReset = false) {
    const { filteredCoffees, coffees, currentPage, pageSize } = this.data;
    
    const currentList = isReset ? [] : coffees;
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    const nextBatch = filteredCoffees.slice(startIndex, endIndex);
    const newList = currentList.concat(nextBatch);
    
    this.setData({
      coffees: newList,
      currentPage: isReset ? 2 : currentPage + 1,
      hasMore: newList.length < filteredCoffees.length 
    });
  },

  toggleSort: function(e) {
    const type = e.currentTarget.dataset.type;
    if (this.data.sortBy !== type) {
      this.setData({ sortBy: type }, () => {
        this.applySortAndFilter();
        wx.pageScrollTo({ scrollTop: 0 });
      });
    }
  },

  onFilterTap: function(e) {
    const tag = e.currentTarget.dataset.tag;
    if (this.data.activeFilter !== tag) {
      this.setData({ activeFilter: tag }, () => {
        this.applySortAndFilter();
        wx.pageScrollTo({ scrollTop: 0 });
      });
    }
  },

  goToDetail: function(e) {
    const item = e.currentTarget.dataset.item;
    const itemStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({ url: `/pages/detail/detail?coffee=${itemStr}` });
  },

  // =========================================
  // ★★★ 彩蛋交互逻辑 (长按版) ★★★
  // =========================================

  // 长按标题触发
  handleTitleLongPress: function() {
    console.log('🎉 长按触发彩蛋！');
    this.setData({ showEasterEgg: true });
    wx.vibrateShort({ type: 'medium' }); 
  },

  // 关闭彩蛋
  closeEasterEgg: function() {
    this.setData({ showEasterEgg: false });
  }, // <--- 🔴 注意：这里必须有一个逗号！如果不加逗号就会报错

  // 1. 发送给朋友 (首页)
  onShareAppMessage: function () {
    return {
      title: '今天喝什么',
      path: '/pages/index/index',
      // 👇 你的封面图链接填这里
      imageUrl: 'https://636c-cloud1-1gmk580edef03ce1-1392188317.tcb.qcloud.la/batman.png?sign=b24a14e771569a009a151d04da9c0c82&t=1766493110' 
    };
  },

  // 2. 分享到朋友圈 (首页)
  onShareTimeline: function () {
    return {
      title: '今天喝什么',
      // 👇 你的朋友圈封面图填这里
      imageUrl: 'https://636c-cloud1-1gmk580edef03ce1-1392188317.tcb.qcloud.la/batman.png?sign=b24a14e771569a009a151d04da9c0c82&t=1766493110' 
    };
  }

}) // <--- 这是 Page 的结束括号