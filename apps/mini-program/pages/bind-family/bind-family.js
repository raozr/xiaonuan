const app = getApp();

Page({
  data: {
    mode: 'CHILD',
    hasFamily: false,
    family: null,
    elderName: '',
    elderAge: '',
    elderDialect: '',
    inviteCode: '',
    loading: false,
  },

  async onShow() {
    const token = app.globalData.token || wx.getStorageSync('xiaonuan_token');
    if (!token) {
      this.setData({ mode: 'ELDER' });
      return;
    }
    await this.loadFamily();
  },

  async loadFamily() {
    try {
      const res = await app.request({
        url: '/api/family',
        method: 'GET',
      });
      if (res.statusCode === 200 && res.data) {
        this.setData({
          hasFamily: true,
          family: res.data,
        });
      } else {
        this.setData({ hasFamily: false, family: null });
      }
    } catch (err) {
      console.error('加载家庭信息失败:', err);
      this.setData({ hasFamily: false, family: null });
    }
  },

  onElderNameInput(e) {
    this.setData({ elderName: e.detail.value });
  },

  onElderAgeInput(e) {
    this.setData({ elderAge: e.detail.value });
  },

  onElderDialectInput(e) {
    this.setData({ elderDialect: e.detail.value });
  },

  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value });
  },

  async createFamily() {
    const { elderName, elderAge, elderDialect } = this.data;
    if (!elderName.trim()) {
      wx.showToast({ title: '请输入老人姓名', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/family',
        method: 'POST',
        data: {
          elderName: elderName.trim(),
          elderAge: elderAge ? parseInt(elderAge, 10) : undefined,
          elderDialect: elderDialect.trim() || undefined,
        },
      });

      if (res.statusCode === 201) {
        wx.showToast({ title: '家庭创建成功', icon: 'success' });
        this.setData({
          hasFamily: true,
          family: res.data,
          elderName: '',
          elderAge: '',
          elderDialect: '',
        });
      } else {
        wx.showToast({ title: res.data?.message || '创建失败', icon: 'none' });
      }
    } catch (err) {
      console.error('创建家庭失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async refreshInviteCode() {
    const { family } = this.data;
    if (!family) return;

    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/family/invite-code',
        method: 'POST',
        data: { familyId: family.id },
      });

      if (res.statusCode === 200) {
        wx.showToast({ title: '邀请码已刷新', icon: 'success' });
        this.setData({
          'family.inviteCode': res.data.inviteCode,
          'family.inviteCodeExpiresAt': res.data.inviteCodeExpiresAt,
        });
      } else {
        wx.showToast({ title: res.data?.message || '刷新失败', icon: 'none' });
      }
    } catch (err) {
      console.error('刷新邀请码失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  copyInviteCode() {
    const code = this.data.family?.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      },
    });
  },

  async bindElder() {
    const { inviteCode } = this.data;
    if (!inviteCode || inviteCode.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const sysInfo = wx.getSystemInfoSync();
      const res = await app.request({
        url: '/api/family/bind',
        method: 'POST',
        data: {
          inviteCode: inviteCode.trim(),
          deviceId: sysInfo.deviceId || `mp-${Date.now()}`,
        },
      });

      if (res.statusCode === 200 && res.data.token) {
        wx.setStorageSync('xiaonuan_token', res.data.token);
        app.globalData.token = res.data.token;
        app.globalData.role = 'ELDER';
        wx.showToast({ title: '绑定成功', icon: 'success' });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/elder-home/elder-home' });
        }, 1000);
      } else {
        wx.showToast({ title: res.data?.message || '绑定失败', icon: 'none' });
      }
    } catch (err) {
      console.error('绑定失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
