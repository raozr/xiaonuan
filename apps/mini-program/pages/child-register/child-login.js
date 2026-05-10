const app = getApp();

Page({
  data: {
    openid: '',
    sessionKey: '',
    loading: false,
    showDevFallback: false,
    showPhoneLogin: false,
    phoneInput: '',
  },

  onLoad() {
    this.fetchWechatSession();
  },

  async fetchWechatSession() {
    try {
      const loginRes = await wx.login();
      console.log('[wx.login] code:', loginRes.code);
      const res = await app.request({
        url: '/api/auth/wechat-code',
        method: 'POST',
        data: { code: loginRes.code },
      });
      console.log('[wechat-code] res:', res.statusCode, res.data);

      if (res.statusCode === 200 && res.data.success) {
        this.setData({
          openid: res.data.openid,
          sessionKey: res.data.sessionKey,
        });
      } else {
        console.warn('微信登录失败:', res.data);
        this.setData({ showPhoneLogin: true });
        wx.showToast({ title: res.data.message || '微信登录失败', icon: 'none' });
      }
    } catch (err) {
      console.error('网络错误:', err);
      this.setData({ showPhoneLogin: true });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async devLogin() {
    wx.showModal({
      title: '开发测试登录',
      content: '请输入测试手机号',
      editable: true,
      placeholderText: '13800138000',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        const phone = modalRes.content || '13800138000';
        if (!/^1[3-9]\d{9}$/.test(phone)) {
          wx.showToast({ title: '手机号格式错误', icon: 'none' });
          return;
        }

        this.setData({ loading: true });
        try {
          const res = await app.request({
            url: '/api/auth/phone-login',
            method: 'POST',
            data: { phone },
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
  },

  async onGetPhoneNumber(e) {
    console.log('[getPhoneNumber] detail:', e.detail);
    if (e.detail.errMsg.includes('fail') || e.detail.errMsg.includes('cancel')) {
      this.setData({ showPhoneLogin: true });
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

  async phoneLogin() {
    const { phoneInput } = this.data;
    if (!phoneInput || !/^1[3-9]\d{9}$/.test(phoneInput)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/auth/phone-login',
        method: 'POST',
        data: { phone: phoneInput },
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

  onPhoneInput(e) {
    this.setData({ phoneInput: e.detail.value });
  },
});
