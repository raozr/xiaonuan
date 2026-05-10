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
      if (token) {
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
          return;
        }
      }

      // No valid token — try silent login via openid
      await this.silentLogin();
    } catch (err) {
      console.error('检查登录状态失败:', err);
      wx.reLaunch({ url: '/pages/role-select/role-select' });
    }
  },

  async silentLogin() {
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject,
        });
      });

      if (!loginRes.code) {
        throw new Error('wx.login 未返回 code');
      }

      const res = await this.request({
        url: '/api/auth/silent-login',
        method: 'POST',
        data: { code: loginRes.code },
      });

      if (res.statusCode === 200 && res.data.success && res.data.token) {
        wx.setStorageSync('xiaonuan_token', res.data.token);
        this.globalData.token = res.data.token;
        this.globalData.role = res.data.role;

        console.log('静默登录成功，角色:', res.data.role);

        if (res.data.role === 'ELDER') {
          wx.reLaunch({ url: '/pages/elder-home/elder-home' });
        } else {
          wx.reLaunch({ url: '/pages/child-home/child-home' });
        }
        return;
      }

      // New user — go to role-select with openid
      if (res.statusCode === 200 && res.data.needRegister && res.data.openid) {
        console.log('新用户，前往角色选择');
        wx.reLaunch({ url: '/pages/role-select/role-select?openid=' + res.data.openid });
        return;
      }

      console.log('静默登录失败，需要手动登录');
      wx.reLaunch({ url: '/pages/role-select/role-select' });
    } catch (err) {
      console.error('静默登录失败:', err);
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
