const app = getApp();

Page({
  data: {
    userInfo: null,
    familyInfo: null,
    todaySummary: null,
  },

  async onLoad() {
    this.setData({ userInfo: app.globalData.userInfo });
    await this.loadFamilyInfo();
    await this.loadTodaySummary();
  },

  async loadFamilyInfo() {
    try {
      const res = await app.request({
        url: '/api/family',
        method: 'GET',
      });
      if (res.statusCode === 200) {
        this.setData({ familyInfo: res.data });
      }
    } catch (err) {
      console.error('加载家庭信息失败:', err);
    }
  },

  async loadTodaySummary() {
    // P0 MVP: 静态展示，后续接入真实数据
    this.setData({
      todaySummary: {
        mood: '开心',
        duration: '约 40 分钟',
        topics: 3,
        highlights: [
          '聊了大儿子下周回家的事',
          '回忆了杭州旅游的往事',
          '说腰今天好多了',
        ],
      },
    });
  },

  createFamily() {
    wx.navigateTo({ url: '/pages/bind-family/bind-family' });
  },

  logout() {
    wx.removeStorageSync('xiaonuan_token');
    app.globalData.token = null;
    app.globalData.userInfo = null;
    app.globalData.role = null;
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  },
});
