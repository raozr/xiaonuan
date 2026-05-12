const app = getApp();

Page({
  data: {
    familyId: '',
    userInfo: null,
    familyInfo: null,
    todaySummary: null,
    showGuide: false,
  },

  async onLoad(options) {
    if (options.familyId) {
      this.setData({ familyId: options.familyId });
    }
    this.setData({ userInfo: app.globalData.userInfo });
    await this.loadFamilyInfo();
    await this.loadTodaySummary();
  },

  async onShow() {
    if (this.data.familyId) {
      await this.loadFamilyInfo();
    }
  },

  async loadFamilyInfo() {
    try {
      const res = await app.request({
        url: `/api/family/${this.data.familyId}`,
        method: 'GET',
      });
      if (res.statusCode === 200) {
        const isDefaultElder = res.data.elder?.name === '老人';
        this.setData({ familyInfo: res.data, showGuide: isDefaultElder });
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

  dismissGuide() {
    this.setData({ showGuide: false });
  },

  goToFamily() {
    wx.navigateTo({ url: `/pages/child-settings/child-settings?familyId=${this.data.familyId}` });
  },

  goToSettings() {
    wx.navigateTo({ url: `/pages/child-settings/child-settings?familyId=${this.data.familyId}` });
  },

  createFamily() {
    // This is "Feed AI" now
    wx.navigateTo({ url: `/pages/bind-family/bind-family?familyId=${this.data.familyId}` });
  },

  logout() {
    app.logout();
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  },
});
