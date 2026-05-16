// 根据小程序运行环境自动切换 API 地址
function getApiBase() {
  // release = 正式版（线上用户）
  // trial   = 体验版
  // develop = 开发版 / 开发者工具
  const env = (typeof wx !== 'undefined' && wx.getAccountInfoSync)
    ? wx.getAccountInfoSync().miniProgram.envVersion
    : 'develop';

  if (env === 'release') {
    return 'https://www.quirklabs.top/xiaonuan';
  }
  // 开发/体验版使用本地地址
  return 'http://192.168.1.31:3000';
}

App({
  globalData: {
    apiBase: getApiBase(),
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
          this.globalData.role = 'CHILD';
          console.log('已登录，跳转子女端首页');
          wx.reLaunch({ url: '/pages/child-home/child-home' });
          return;
        }
      }

      // No valid token — try silent login via openid
      await this.silentLogin();
    } catch (err) {
      console.error('检查登录状态失败:', err);
      const hasToken = wx.getStorageSync('xiaonuan_token');
      if (!hasToken) {
        wx.reLaunch({ url: '/pages/child-register/child-register' });
      }
      // 已有 token 时可能是网络抖动，保留登录状态不强制跳转
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

        console.log('静默登录成功，跳转子女端首页');
        wx.reLaunch({ url: '/pages/child-home/child-home' });
        return;
      }

      // New user — go to register with openid
      if (res.statusCode === 200 && res.data.needRegister && res.data.openid) {
        console.log('新用户，前往注册页');
        wx.reLaunch({ url: '/pages/child-register/child-register?openid=' + res.data.openid });
        return;
      }

      console.log('静默登录失败，需要手动登录');
      wx.reLaunch({ url: '/pages/child-register/child-register' });
    } catch (err) {
      console.error('静默登录失败:', err);
      const hasToken = wx.getStorageSync('xiaonuan_token');
      if (!hasToken) {
        wx.reLaunch({ url: '/pages/child-register/child-register' });
      }
      // 已有 token 时网络错误不强制跳转，保留现有状态
    }
  },

  logout() {
    wx.removeStorageSync('xiaonuan_token');
    this.globalData.token = null;
    this.globalData.role = null;
    this.globalData.userInfo = null;
  },

  request(options) {
    const { token, apiBase } = this.globalData;
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${apiBase}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        timeout: options.timeout || 60000,
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
