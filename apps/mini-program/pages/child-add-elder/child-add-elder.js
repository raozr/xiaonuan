const app = getApp();

Page({
  data: {
    name: '',
    loading: false
  },

  onInputName(e) {
    this.setData({ name: e.detail.value });
  },

  async handleSubmit() {
    if (!this.data.name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/family',
        method: 'POST',
        data: { elderName: this.data.name }
      });
      if (res.statusCode === 201) {
        wx.showToast({ title: '添加成功' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (e) {
      wx.showToast({ title: '添加失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
