const app = getApp();

Page({
  data: {
    familyId: '',
    userInfo: null,
    familyInfo: null,
    todaySummary: null,
    todayDate: '',
    elderNameFirstChar: '',
    inviteCode: '',
  },

  async onLoad(options) {
    if (options.familyId) {
      this.setData({ familyId: options.familyId });
    }
    this.setData({ userInfo: app.globalData.userInfo });
    this.formatTodayDate();
    await this.loadFamilyInfo();
    await this.loadTodaySummary();
  },

  async onShow() {
    if (this.data.familyId) {
      await this.loadFamilyInfo();
      await this.loadTodaySummary();
    }
  },

  formatTodayDate() {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    this.setData({ todayDate: `${month} ${day}, ${year}` });
  },

  async loadFamilyInfo() {
    try {
      const res = await app.request({
        url: `/api/family/${this.data.familyId}`,
        method: 'GET',
      });
      if (res.statusCode === 200) {
        const elderName = res.data.elder?.name || '老人';
        this.setData({
          familyInfo: res.data,
          elderNameFirstChar: elderName[0],
          inviteCode: res.data.inviteCode || '',
        });
      }
    } catch (err) {
      console.error('加载家庭信息失败:', err);
    }
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

  async loadTodaySummary() {
    try {
      const res = await app.request({
        url: `/api/family/${this.data.familyId}/daily-summary`,
        method: 'GET',
      });
      if (res.statusCode === 200 && res.data.success && res.data.data) {
        const data = res.data.data;
        const durationMinutes = data.duration || 0;
        const durationText = durationMinutes >= 60
          ? `${Math.floor(durationMinutes / 60)} 小时 ${durationMinutes % 60} 分钟`
          : `${durationMinutes} 分钟`;
        this.setData({
          todaySummary: {
            mood: data.mood,
            durationText,
            highlights: data.highlights || [],
            concerns: data.concerns,
          },
        });
      } else {
        this.setData({ todaySummary: null });
      }
    } catch (err) {
      console.error('加载今日状态失败:', err);
      this.setData({ todaySummary: null });
    }
  },

  goToFeed() {
    wx.navigateTo({ url: `/pages/child-feed/child-feed?familyId=${this.data.familyId}` });
  },

  goToSettings() {
    wx.navigateTo({ url: `/pages/child-settings/child-settings?familyId=${this.data.familyId}` });
  },
});
