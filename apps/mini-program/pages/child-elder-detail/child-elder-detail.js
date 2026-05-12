const app = getApp();

Page({
  data: {
    familyId: '',
    userInfo: null,
    familyInfo: null,
    todaySummary: null,
    showGuide: false,
    inviteCode: '',
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
        this.setData({
          familyInfo: res.data,
          showGuide: isDefaultElder,
          inviteCode: res.data.inviteCode || '',
        });
      }
    } catch (err) {
      console.error('加载家庭信息失败:', err);
    }
  },

  async loadTodaySummary() {
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

  goToSettings() {
    wx.navigateTo({ url: `/pages/child-settings/child-settings?familyId=${this.data.familyId}` });
  },

  createFamily() {
    wx.navigateTo({ url: `/pages/bind-family/bind-family?familyId=${this.data.familyId}` });
  },

  copyInviteCode() {
    const code = this.data.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      },
    });
  },

  async refreshInviteCode() {
    try {
      const res = await app.request({
        url: `/api/family/${this.data.familyId}/refresh-code`,
        method: 'POST',
        data: {},
      });
      if (res.statusCode === 200) {
        this.setData({ inviteCode: res.data.inviteCode });
        wx.showToast({ title: '邀请码已刷新', icon: 'success' });
      } else {
        wx.showToast({ title: res.data?.message || '刷新失败', icon: 'none' });
      }
    } catch (err) {
      console.error('刷新邀请码失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async unbindElder() {
    const that = this;
    wx.showModal({
      title: '解除绑定',
      content: '解除后老人端将无法继续使用，确定吗？',
      confirmColor: '#FF6B6B',
      async success(res) {
        if (res.confirm) {
          try {
            const reqRes = await app.request({
              url: `/api/family/${that.data.familyId}/bind`,
              method: 'DELETE',
            });
            if (reqRes.statusCode === 200) {
              wx.showToast({ title: '已解绑', icon: 'success' });
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              wx.showToast({ title: reqRes.data?.message || '解绑失败', icon: 'none' });
            }
          } catch (err) {
            console.error('解绑失败:', err);
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
        }
      },
    });
  },

  logout() {
    app.logout();
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  },
});
