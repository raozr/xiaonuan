Component({
  properties: {
    active: {
      type: String,
      value: 'overview',
    },
    familyId: {
      type: String,
      value: '',
    },
  },

  data: {
    tabs: [
      { key: 'overview', label: '陪伴', icon: '☀️', url: '/pages/child-elder-detail/child-elder-detail' },
      { key: 'feed', label: '动态', icon: '📝', url: '/pages/child-feed/child-feed' },
      { key: 'voice', label: '声音', icon: '🎙️', url: '/pages/child-voice-clone/child-voice-clone' },
      { key: 'settings', label: '我的', icon: '⚙️', url: '/pages/child-settings/child-settings' },
    ],
  },

  methods: {
    onTap(e) {
      const { key, url } = e.currentTarget.dataset;
      if (key === this.properties.active) return;
      const familyId = this.properties.familyId;
      const targetUrl = familyId ? `${url}?familyId=${familyId}` : url;
      wx.redirectTo({ url: targetUrl });
    },
  },
});
