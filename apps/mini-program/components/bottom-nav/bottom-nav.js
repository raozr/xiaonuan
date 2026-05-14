Component({
  properties: {
    active: {
      type: String,
      value: 'home',
    },
  },

  data: {
    tabs: [
      { key: 'home', label: '首页', icon: '🏠', url: '/pages/child-home/child-home' },
      { key: 'feed', label: '动态', icon: '📝', url: '/pages/child-feed/child-feed' },
      { key: 'voice', label: '声音', icon: '🎙️', url: '/pages/child-voice-clone/child-voice-clone' },
      { key: 'settings', label: '我的', icon: '⚙️', url: '/pages/child-settings/child-settings' },
    ],
  },

  methods: {
    onTap(e) {
      const { key, url } = e.currentTarget.dataset;
      if (key === this.properties.active) return;
      wx.reLaunch({ url });
    },
  },
});
