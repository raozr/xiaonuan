App({
  globalData: {
    apiBase: 'http://localhost:3000',
    token: null,
    role: null,
    userInfo: null,
    familyInfo: null,
  },

  onLaunch() {
    console.log('小暖启动');
    this.checkLoginStatus();
  },

  async checkLoginStatus() {
    try {
      const token = wx.getStorageSync('xiaonuan_token');
      if (!token) {
        console.log('未登录，跳转到身份选择');
        wx.reLaunch({ url: '/pages/role-select/role-select' });
        return;
      }

      this.globalData.token = token;
      const res = await this.request({
        url: '/api/me',
        method: 'GET',
      });

      if (res.statusCode === 200) {
        this.globalData.userInfo = res.data;
        this.globalData.role = res.data.role;
        console.log('已登录，角色:', res.data.role);

        if (res.data.role === 'ELDER') {
          wx.reLaunch({ url: '/pages/elder-home/elder-home' });
        } else {
          wx.reLaunch({ url: '/pages/child-home/child-home' });
        }
      } else {
        console.log('token 失效，重新登录');
        wx.removeStorageSync('xiaonuan_token');
        wx.reLaunch({ url: '/pages/role-select/role-select' });
      }
    } catch (err) {
      console.error('检查登录状态失败:', err);
      wx.reLaunch({ url: '/pages/role-select/role-select' });
    }
  },

  request(options) {
    const { token, apiBase } = this.globalData;
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${apiBase}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        timeout: options.timeout || 10000,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        success: resolve,
        fail: reject,
      });
    });
  },
});
