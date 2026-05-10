const app = getApp();

Page({
  data: {
    userInfo: null,
    isListening: false,
    isSpeaking: false,
  },

  async onLoad() {
    await this.loadUserInfo();
  },

  async loadUserInfo() {
    try {
      const res = await app.request({
        url: '/api/me',
        method: 'GET',
      });
      if (res.statusCode === 200) {
        this.setData({ userInfo: res.data });
      }
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  },

  onTouchStart() {
    this.setData({ isListening: true });
    wx.vibrateShort({ type: 'light' });
  },

  onTouchEnd() {
    this.setData({ isListening: false });
    // TODO: send voice data to gateway
  },

  logout() {
    wx.removeStorageSync('xiaonuan_token');
    app.globalData.token = null;
    app.globalData.role = null;
    app.globalData.userInfo = null;
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  },
});
