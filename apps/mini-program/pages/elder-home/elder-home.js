const app = getApp();

Page({
  data: {
    userInfo: null,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    sessionId: null,
    aiReplyText: '',
    recognizedText: '',
    waveHeights: [20, 35, 50, 30, 15],
  },

  socketOpen: false,
  reconnectAttempts: 0,
  reconnectTimer: null,
  waveTimer: null,
  recorderManager: null,
  innerAudioContext: null,
  isRecording: false,
  listenersRegistered: false,

  async onLoad() {
    await this.loadUserInfo();
    this.connectSocket();
    this.initRecorder();
  },

  onUnload() {
    this.clearReconnectTimer();
    this.stopWaveAnimation();
    this.destroyAudio();
    if (this.socketOpen) {
      wx.closeSocket();
    }
  },

  initRecorder() {
    this.recorderManager = wx.getRecorderManager();

    this.recorderManager.onStart(() => {
      console.log('[录音] 已开始');
    });

    this.recorderManager.onStop((res) => {
      console.log('[录音] 已停止', res);
      this.handleRecordingStop(res);
    });

    this.recorderManager.onError((err) => {
      console.error('[录音] 错误:', err);
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ isListening: false, isProcessing: false });
      this.stopWaveAnimation();
    });
  },

  async loadUserInfo() {
    try {
      const res = await app.request({
        url: '/api/me',
        method: 'GET',
      });
      if (res.statusCode === 200) {
        this.setData({ userInfo: res.data });
      }
    } catch (err) {
      console.error('加载用户信息失败:', err);
    }
  },

  connectSocket() {
    const token = app.globalData.token || wx.getStorageSync('xiaonuan_token');
    const apiBase = app.globalData.apiBase || 'http://localhost:3000';
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws?token=' + token;

    console.log('[WebSocket] 连接地址:', wsUrl);

    wx.connectSocket({ url: wsUrl });

    if (this.listenersRegistered) return;
    this.listenersRegistered = true;

    wx.onSocketOpen(() => {
      console.log('[WebSocket] 已连接');
      this.socketOpen = true;
      this.reconnectAttempts = 0;
      this.sendMessage('session:create', {});
    });

    wx.onSocketMessage((res) => {
      try {
        const { type, payload } = JSON.parse(res.data);
        console.log('[WebSocket] 收到消息:', type, payload);

        if (type === 'session:created') {
          this.setData({ sessionId: payload.sessionId });
          console.log('[WebSocket] session 已创建:', payload.sessionId);
        }

        if (type === 'message:ai_text') {
          this.setData({
            aiReplyText: payload.text,
            isSpeaking: true,
            isProcessing: false,
          });
          this.synthesizeAndPlay(payload.text);
        }

        if (type === 'error') {
          console.error('[WebSocket] 服务端错误:', payload.message);
          wx.showToast({ title: payload.message || '服务错误', icon: 'none' });
          this.setData({ isProcessing: false, isSpeaking: false });
          this.stopWaveAnimation();
        }
      } catch (err) {
        console.error('[WebSocket] 解析消息失败:', err);
      }
    });

    wx.onSocketClose(() => {
      console.log('[WebSocket] 连接已关闭');
      this.socketOpen = false;
      this.scheduleReconnect();
    });

    wx.onSocketError((err) => {
      console.error('[WebSocket] 连接错误:', err);
      this.socketOpen = false;
      this.scheduleReconnect();
    });
  },

  sendMessage(type, payload) {
    if (!this.socketOpen) return;
    wx.sendSocketMessage({
      data: JSON.stringify({ type, payload, timestamp: Date.now() }),
    });
  },

  scheduleReconnect() {
    if (this.reconnectAttempts >= 3) {
      console.log('已达到最大重连次数，停止重连');
      return;
    }
    this.clearReconnectTimer();
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connectSocket();
    }, delay);
  },

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  },

  // ===== 录音交互 =====

  onTouchStart() {
    if (this.isRecording) return;
    this.isRecording = true;

    this.setData({
      isListening: true,
      isProcessing: false,
      recognizedText: '',
      aiReplyText: '',
    });

    wx.vibrateShort({ type: 'light' });
    this.startWaveAnimation();

    this.recorderManager.start({
      format: 'wav',
      sampleRate: 16000,
      numberOfChannels: 1,
      duration: 30000,
    });
  },

  onTouchEnd() {
    if (!this.isRecording) return;
    this.isRecording = false;

    this.setData({ isListening: false });
    this.stopWaveAnimation();
    this.recorderManager.stop();
  },

  async handleRecordingStop(res) {
    const { tempFilePath, duration } = res;

    if (duration < 500) {
      wx.showToast({ title: '说话时间太短', icon: 'none' });
      this.setData({ isProcessing: false });
      return;
    }

    this.setData({ isProcessing: true });

    try {
      const audioBase64 = await this.readFileBase64(tempFilePath);
      const asrRes = await app.request({
        url: '/api/asr/transcribe',
        method: 'POST',
        timeout: 30000,
        data: { audioBase64, format: 'wav' },
      });

      if (asrRes.statusCode === 200 && asrRes.data.success) {
        const text = asrRes.data.text;
        this.setData({ recognizedText: text });
        this.sendMessage('message:voice_text', { text });
      } else {
        const msg = asrRes.data?.message || '语音识别失败';
        wx.showToast({ title: msg, icon: 'none' });
        this.setData({ isProcessing: false });
      }
    } catch (err) {
      console.error('[语音识别] 失败:', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ isProcessing: false });
    }
  },

  readFileBase64(filePath) {
    return new Promise((resolve, reject) => {
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: (err) => reject(err),
      });
    });
  },

  // ===== 打断 =====

  onInterrupt() {
    this.destroyAudio();
    this.stopWaveAnimation();
    this.setData({
      isSpeaking: false,
      isProcessing: false,
      aiReplyText: '',
    });
  },

  // ===== 音波动画 =====

  startWaveAnimation() {
    this.stopWaveAnimation();
    this.waveTimer = setInterval(() => {
      const heights = Array.from(
        { length: 5 },
        () => Math.floor(Math.random() * 60) + 10
      );
      this.setData({ waveHeights: heights });
    }, 150);
  },

  stopWaveAnimation() {
    if (this.waveTimer) {
      clearInterval(this.waveTimer);
      this.waveTimer = null;
    }
    this.setData({ waveHeights: [20, 35, 50, 30, 15] });
  },

  // ===== TTS 与播放 =====

  async synthesizeAndPlay(text) {
    try {
      const apiRes = await app.request({
        url: '/api/tts/synthesize',
        method: 'POST',
        timeout: 15000,
        data: { text },
      });

      if (apiRes.statusCode === 200 && apiRes.data.success) {
        this.playAudio(apiRes.data.audioUrl);
      } else {
        const msg = apiRes.data?.message || '语音合成失败';
        wx.showToast({ title: msg, icon: 'none' });
        this.setData({ isSpeaking: false });
        this.stopWaveAnimation();
      }
    } catch (err) {
      console.error('[TTS] 请求失败:', err);
      wx.showToast({ title: '语音合成失败', icon: 'none' });
      this.setData({ isSpeaking: false });
      this.stopWaveAnimation();
    }
  },

  playAudio(audioUrl) {
    this.destroyAudio();

    const apiBase = app.globalData.apiBase || 'http://localhost:3000';
    const src = audioUrl.startsWith('http') ? audioUrl : apiBase + audioUrl;

    console.log('[音频] 播放:', src);

    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.obeyMuteSwitch = false;
    this.innerAudioContext.src = src;

    this.innerAudioContext.onPlay(() => {
      console.log('[音频] 开始播放');
      this.setData({ isSpeaking: true, isProcessing: false });
      this.startWaveAnimation();
    });

    this.innerAudioContext.onEnded(() => {
      console.log('[音频] 播放结束');
      this.setData({ isSpeaking: false });
      this.stopWaveAnimation();
      this.destroyAudio();
    });

    this.innerAudioContext.onError((err) => {
      console.error('[音频] 播放错误:', err);
      this.setData({ isSpeaking: false });
      this.stopWaveAnimation();
      this.destroyAudio();
    });

    this.innerAudioContext.play();
  },

  destroyAudio() {
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
    }
  },

  // ===== 导航 =====

  goToHistory() {
    wx.showToast({ title: '历史记录即将上线', icon: 'none' });
  },

  // ===== 退出 =====

  logout() {
    this.destroyAudio();
    this.stopWaveAnimation();
    wx.removeStorageSync('xiaonuan_token');
    app.globalData.token = null;
    app.globalData.role = null;
    app.globalData.userInfo = null;
    if (this.socketOpen) {
      wx.closeSocket();
    }
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  },
});
