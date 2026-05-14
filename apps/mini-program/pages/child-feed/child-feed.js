const app = getApp();

Page({
  data: {
    familyId: '',
    inputMode: 'text',
    textContent: '',
    canSend: false,
    isRecording: false,
    feeds: [],
  },

  recorderManager: null,

  async onLoad(options) {
    let familyId = options.familyId || '';
    if (!familyId) {
      try {
        const res = await app.request({ url: '/api/family', method: 'GET' });
        if (res.statusCode === 200 && res.data && res.data.length > 0) {
          familyId = res.data[0].id;
        }
      } catch (e) {
        console.error('获取家庭列表失败:', e);
      }
    }
    this.setData({ familyId });
    this.initRecorder();
    if (familyId) {
      this.loadFeeds();
    }
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStart(() => {
      this.setData({ isRecording: true });
    });
    this.recorderManager.onStop((res) => {
      this.setData({ isRecording: false });
      this.uploadVoice(res.tempFilePath);
    });
    this.recorderManager.onError((err) => {
      console.error('录音错误:', err);
      this.setData({ isRecording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  switchMode(e) {
    this.setData({ inputMode: e.currentTarget.dataset.mode });
  },

  onTextInput(e) {
    const textContent = e.detail.value;
    this.setData({ textContent, canSend: textContent.trim().length > 0 });
  },

  async sendText() {
    const { familyId, textContent } = this.data;
    const content = textContent.trim();
    if (!content) return;

    wx.showLoading({ title: '发送中' });
    try {
      const res = await app.request({
        url: `/api/family/${familyId}/feeds`,
        method: 'POST',
        data: { type: 'TEXT', content },
      });
      wx.hideLoading();
      if (res.statusCode === 201 && res.data.success) {
        wx.showToast({ title: '发送成功', icon: 'success' });
        this.setData({ textContent: '', canSend: false });
        await this.loadFeeds();
      } else {
        wx.showToast({ title: res.data?.message || '发送失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('发送失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  startRecord() {
    if (this.data.isRecording) {
      console.log('[Voice] already recording, skip');
      return;
    }
    try {
      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      });
    } catch (err) {
      console.error('[Voice] start record error:', err);
      wx.showToast({ title: '录音启动失败', icon: 'none' });
    }
  },

  stopRecord() {
    if (!this.data.isRecording) {
      console.log('[Voice] not recording, skip stop');
      return;
    }
    this.recorderManager.stop();
  },

  async uploadVoice(filePath) {
    const { familyId } = this.data;
    wx.showLoading({ title: '处理中' });

    try {
      const fs = wx.getFileSystemManager();
      const base64 = fs.readFileSync(filePath, 'base64');

      const res = await app.request({
        url: `/api/family/${familyId}/feeds`,
        method: 'POST',
        data: { type: 'VOICE', audioBase64: base64 },
      });

      wx.hideLoading();
      if (res.statusCode === 201 && res.data.success) {
        wx.showToast({ title: '发送成功', icon: 'success' });
        await this.loadFeeds();
      } else {
        wx.showToast({ title: res.data?.message || '发送失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('语音上传失败:', err);
      wx.showToast({ title: '语音发送失败', icon: 'none' });
    }
  },

  async loadFeeds() {
    const { familyId } = this.data;
    try {
      const res = await app.request({
        url: `/api/family/${familyId}/feeds`,
        method: 'GET',
      });
      if (res.statusCode === 200 && res.data.success) {
        const feeds = (res.data.data || []).map((f) => ({
          ...f,
          createdAt: this.formatTime(f.createdAt),
        }));
        this.setData({ feeds });
      }
    } catch (err) {
      console.error('加载历史失败:', err);
    }
  },

  formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    if (days < 7) return `${days} 天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  goBack() {
    wx.navigateBack();
  },
});
