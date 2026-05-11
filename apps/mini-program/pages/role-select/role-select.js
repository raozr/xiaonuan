Page({
  data: {
    openid: '',
  },

  onLoad(options) {
    if (options.openid) {
      this.setData({ openid: options.openid });
    }
  },

  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    const { openid } = this.data;

    if (role === 'ELDER') {
      wx.navigateTo({ url: `/pages/bind-family/bind-family?openid=${openid}&mode=ELDER` });
    } else {
      wx.navigateTo({ url: `/pages/child-register/child-register?openid=${openid}` });
    }
  },
});
