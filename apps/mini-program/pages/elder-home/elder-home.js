const app = getApp();

Page({
  data: {
    userInfo: null,
    isListening: false,
    isSpeaking: false,
    sessionId: null,
    aiText: '',
    voiceText: '',
  },

  socketOpen: false,
  reconnectAttempts: 0,
  reconnectTimer: null,
  speakingTimer: null,
  maxReconnectAttempts: 3,

  async onLoad() {
    await this.loadUserInfo();
    this.connectSocket();
  },

  onUnload() {
    this.clearReconnectTimer();
    this.clearSpeakingTimer();
    if (this.socketOpen) {
      wx.closeSocket();
    }
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

  listenersRegistered: false,

  connectSocket() {
    const token = app.globalData.token || wx.getStorageSync('xiaonuan_token');
    const apiBase = app.globalData.apiBase || 'http://localhost:3000';
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws?token=' + token;

    wx.connectSocket({
      url: wsUrl,
    });

    if (this.listenersRegistered) return;
    this.listenersRegistered = true;

    wx.onSocketOpen(() => {
      this.socketOpen = true;
      this.reconnectAttempts = 0;
      this.sendMessage('session:create', {});
    });

    wx.onSocketMessage((res) => {
      try {
        const { type, payload } = JSON.parse(res.data);

        if (type === 'session:created') {
          this.setData({ sessionId: payload.sessionId });
        }

        if (type === 'message:ai_text') {
          this.setData({
            aiText: payload.text,
            isSpeaking: true,
          });
          this.clearSpeakingTimer();
          this.speakingTimer = setTimeout(() => {
            this.setData({
              isSpeaking: false,
              aiText: '',
            });
          }, 3000);
        }

        if (type === 'error') {
          console.error('WebSocket error:', payload.message);
        }
      } catch (err) {
        console.error('解析消息失败:', err);
      }
    });

    wx.onSocketClose(() => {
      this.socketOpen = false;
      this.scheduleReconnect();
    });

    wx.onSocketError((err) => {
      console.error('WebSocket 连接错误:', err);
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
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

  clearSpeakingTimer() {
    if (this.speakingTimer) {
      clearTimeout(this.speakingTimer);
      this.speakingTimer = null;
    }
  },

  onTouchStart() {
    this.setData({ isListening: true, voiceText: '' });
    wx.vibrateShort({ type: 'light' });
  },

  onTouchEnd() {
    this.setData({ isListening: false });
    const text = this.data.voiceText || '你好';
    if (this.data.sessionId) {
      this.sendMessage('message:voice_text', { text });
    }
  },

  logout() {
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
