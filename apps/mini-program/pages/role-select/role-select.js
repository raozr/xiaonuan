Page({
  selectRole(e) {
    const role = e.currentTarget.dataset.role;

    if (role === 'ELDER') {
      wx.navigateTo({ url: '/pages/bind-family/bind-family' });
    } else {
      wx.navigateTo({ url: '/pages/child-login/child-login' });
    }
  },
});
