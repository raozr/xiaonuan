const app = getApp();

Page({
  data: {
    families: [],
    loading: true
  },

  onShow() {
    this.fetchFamilies();
  },

  async fetchFamilies() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/family',
        method: 'GET'
      });
      if (res.data) {
        this.setData({ families: res.data });
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToAddElder() {
    wx.navigateTo({
      url: '/pages/child-add-elder/child-add-elder'
    });
  },

  goToDetail(e) {
    const familyId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/child-elder-detail/child-elder-detail?familyId=${familyId}`
    });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确认退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          wx.reLaunch({ url: '/pages/role-select/role-select' });
        }
      }
    });
  }
});
