const app = getApp();

Page({
  data: {
    openid: '',
    nameInput: '',
    phoneInput: '',
    loading: false,
  },

  onLoad(options) {
    if (options.openid) {
      this.setData({ openid: options.openid });
    }
  },

  onNameInput(e) {
    this.setData({ nameInput: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phoneInput: e.detail.value });
  },

  async register() {
    const { nameInput, phoneInput } = this.data;

    if (!nameInput.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    if (!phoneInput || !/^1[3-9]\d{9}$/.test(phoneInput)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const loginRes = await wx.login();
      const res = await app.request({
        url: '/api/auth/register',
        method: 'POST',
        data: {
          code: loginRes.code,
          role: 'CHILD',
          name: nameInput.trim(),
          phone: phoneInput.trim(),
        },
      });

      if (res.statusCode === 200 && res.data.token) {
        wx.setStorageSync('xiaonuan_token', res.data.token);
        app.globalData.token = res.data.token;
        app.globalData.role = 'CHILD';
        wx.showToast({ title: '注册成功', icon: 'success' });
        wx.reLaunch({ url: '/pages/child-home/child-home' });
      } else {
        wx.showToast({
          title: res.data?.message || '注册失败',
          icon: 'none',
        });
      }
    } catch (err) {
      console.error('注册失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
