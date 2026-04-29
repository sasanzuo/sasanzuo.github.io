App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        // 你的环境ID (从截图看是对的)
        env: 'cloud1-1gmk580edef03ce1', 
        traceUser: true,
      })
    }
  }
})