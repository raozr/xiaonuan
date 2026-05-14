const app = getApp();

Page({
  data: {
    familyId: '',
    clones: [],
    activeVoiceId: '',
    samples: [],
    isRecording: false,
    loading: false,
    currentPromptIndex: 0,
    prompts: [
      '大家好，我是小暖的家人。平时我最喜欢做的事情，就是在阳光明媚的下午，泡一杯热茶，坐在窗边看看窗外的风景。生活很美好，希望每一天都能开开心心的。',
      '一二三四五，上山打老虎。老虎没打着，打到小松鼠。松鼠有几只，让我数一数。数来又数去，一二三四五。这段童谣节奏轻快，非常适合练习不同的音调和语速。',
      '亲爱的，最近天气变凉了，一定要记得多穿点衣服，别感冒了。不管工作多忙，都要记得按时吃饭。我们都很想你，盼着你早点回家团聚。',
    ],
  },

  recorderManager: null,

  changePrompt() {
    const next = (this.data.currentPromptIndex + 1) % this.data.prompts.length;
    this.setData({ currentPromptIndex: next });
  },

  async onLoad(options) {
    let familyId = options?.familyId || '';
    if (!familyId) {
      familyId = await this.resolveFamilyId();
    }
    if (familyId) {
      this.setData({ familyId });
      await this.loadClones();
    }
  },

  async onShow() {
    if (this.data.familyId) {
      await this.loadClones();
    }
  },

  async resolveFamilyId() {
    try {
      const res = await app.request({ url: '/api/family', method: 'GET' });
      if (res.statusCode === 200 && res.data && res.data.length > 0) {
        return res.data[0].id;
      }
    } catch (e) {
      console.error('获取家庭列表失败:', e);
    }
    return '';
  },

  async loadClones() {
    try {
      const res = await app.request({
        url: `/api/voice-clone/family/${this.data.familyId}`,
        method: 'GET',
      });
      if (res.statusCode === 200 && res.data.success) {
        this.setData({
          clones: res.data.data || [],
          activeVoiceId: res.data.activeVoiceId || '',
        });
      }
    } catch (e) {
      console.error('加载音色列表失败:', e);
    }
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStart(() => {
      this.setData({ isRecording: true });
    });
    this.recorderManager.onStop((res) => {
      this.setData({ isRecording: false });
      this.addSample(res.tempFilePath);
    });
    this.recorderManager.onError((err) => {
      console.error('录音错误:', err);
      this.setData({ isRecording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  startRecord() {
    if (this.data.isRecording) return;
    if (!this.recorderManager) this.initRecorder();
    this.recorderManager.start({
      duration: 30000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    });
  },

  stopRecord() {
    if (!this.data.isRecording) return;
    this.recorderManager.stop();
  },

  addSample(filePath) {
    const fs = wx.getFileSystemManager();
    try {
      const base64 = fs.readFileSync(filePath, 'base64');
      const samples = this.data.samples.concat({ filePath, base64 });
      if (samples.length > 3) {
        wx.showToast({ title: '最多3条样本', icon: 'none' });
        return;
      }
      this.setData({ samples });
    } catch (e) {
      console.error('读取录音失败:', e);
      wx.showToast({ title: '读取录音失败', icon: 'none' });
    }
  },

  removeSample(e) {
    const index = e.currentTarget.dataset.index;
    const samples = this.data.samples.filter((_, i) => i !== index);
    this.setData({ samples });
  },

  async createClone() {
    const { familyId, samples } = this.data;
    if (!familyId) {
      wx.showToast({ title: '未选择家庭', icon: 'none' });
      return;
    }
    if (samples.length === 0) {
      wx.showToast({ title: '请先录制样本', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '复刻中...' });

    try {
      const res = await app.request({
        url: '/api/voice-clone',
        method: 'POST',
        data: {
          familyId,
          samples: samples.map((s, i) => ({
            filename: `sample_${i + 1}.mp3`,
            base64: s.base64,
          })),
        },
      });
      wx.hideLoading();
      if (res.statusCode === 201 && res.data.success) {
        wx.showToast({ title: '复刻成功', icon: 'success' });
        this.setData({ samples: [] });
        await this.loadClones();
      } else {
        wx.showToast({ title: res.data?.message || '复刻失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('复刻失败:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async activateClone(e) {
    const voiceId = e.currentTarget.dataset.voiceId;
    try {
      const res = await app.request({
        url: `/api/voice-clone/${voiceId}/activate`,
        method: 'POST',
      });
      if (res.statusCode === 200 && res.data.success) {
        wx.showToast({ title: '已激活', icon: 'success' });
        await this.loadClones();
      } else {
        wx.showToast({ title: res.data?.message || '激活失败', icon: 'none' });
      }
    } catch (e) {
      console.error('激活失败:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async deactivateClone(e) {
    const voiceId = e.currentTarget.dataset.voiceId;
    try {
      const res = await app.request({
        url: `/api/voice-clone/${voiceId}/deactivate`,
        method: 'POST',
      });
      if (res.statusCode === 200 && res.data.success) {
        wx.showToast({ title: '已取消激活', icon: 'success' });
        await this.loadClones();
      } else {
        wx.showToast({ title: res.data?.message || '操作失败', icon: 'none' });
      }
    } catch (e) {
      console.error('取消激活失败:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  async deleteClone(e) {
    const voiceId = e.currentTarget.dataset.voiceId;
    const res = await wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
    });
    if (!res.confirm) return;

    try {
      const delRes = await app.request({
        url: `/api/voice-clone/${voiceId}`,
        method: 'DELETE',
      });
      if (delRes.statusCode === 200 && delRes.data.success) {
        wx.showToast({ title: '已删除', icon: 'success' });
        await this.loadClones();
      } else {
        wx.showToast({ title: delRes.data?.message || '删除失败', icon: 'none' });
      }
    } catch (e) {
      console.error('删除失败:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },
});
