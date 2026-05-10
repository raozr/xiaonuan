const app = getApp();

Page({
  data: {
    openid: '',
    sessionKey: '',
    loading: false,
  },

  async onLoad() {
    try {
      const loginRes = await wx.login();
      const res = await app.request({
        url: '/api/auth/wechat-code',
        method: 'POST',
        data: { code: loginRes.code },
      });

      if (res.statusCode === 200 && res.data.success) {
        this.setData({
          openid: res.data.openid,
          sessionKey: res.data.sessionKey,
        });
      } else {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async onGetPhoneNumber(e) {
    if (e.detail.errMsg.includes('fail') || e.detail.errMsg.includes('cancel')) {
      wx.showToast({ title: '需要授权手机号才能使用', icon: 'none' });
      return;
    }

    const { openid, sessionKey } = this.data;
    if (!openid || !sessionKey) {
      wx.showToast({ title: '请先完成微信登录', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/auth/login',
        method: 'POST',
        data: {
          openid,
          sessionKey,
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv,
        },
      });

      if (res.statusCode === 200 && res.data.token) {
        wx.setStorageSync('xiaonuan_token', res.data.token);
        app.globalData.token = res.data.token;
        wx.showToast({ title: '登录成功', icon: 'success' });
        wx.reLaunch({ url: '/pages/child-home/child-home' });
      } else {
        wx.showToast({ title: res.data.message || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
