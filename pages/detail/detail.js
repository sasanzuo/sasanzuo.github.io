Page({
  data: {
    coffee: null
  },

  onLoad: function (options) {
    // 接收从首页传过来的字符串，转回对象
    if (options.coffee) {
      try {
        const item = JSON.parse(decodeURIComponent(options.coffee));
        this.setData({ coffee: item });
      } catch (e) {
        console.error('解析咖啡数据失败', e);
      }
    }
  },

  // =========================================
  // ★★★ 1. 分享给朋友 (使用 share_square 样式) ★★★
  // =========================================
  onShareAppMessage: function () {
    const bean = this.data.coffee || {};
    
    // 调用底部的工具函数，给图片加样式
    const shareImg = this.getSquareImg(bean.image);

    return {
      title: bean.name || '美味咖啡分享',
      path: `/pages/detail/detail?coffee=${encodeURIComponent(JSON.stringify(bean))}`,
      imageUrl: shareImg 
    };
  },

  // =========================================
  // ★★★ 2. 分享到朋友圈 (使用 share_square 样式) ★★★
  // =========================================
  onShareTimeline: function () {
    const bean = this.data.coffee || {};
    const shareImg = this.getSquareImg(bean.image);

    return {
      title: bean.name || '美味咖啡分享',
      query: `coffee=${encodeURIComponent(JSON.stringify(bean))}`,
      imageUrl: shareImg
    };
  },

  // =========================================
  // ★★★ 3. 工具函数：拼接腾讯云样式 ★★★
  // =========================================
  getSquareImg: function(url) {
    if (!url) return '';
    
    // 防止重复拼接
    if (url.includes('share_square')) return url;

    // 你的云端样式名称
    const styleName = 'share_square';

    // 智能判断拼接方式：
    // 如果 URL 里已经有问号(比如带签名)，必须用 &rule=样式名
    if (url.includes('?')) {
      return `${url}&rule=${styleName}`;
    }

    // 如果 URL 很干净，直接用文档建议的 /样式名
    return `${url}/${styleName}`;
  }
})