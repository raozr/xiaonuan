Component({
  properties: {
    active: {
      type: String,
      value: 'home',
    },
    familyId: {
      type: String,
      value: '',
    },
  },

  methods: {
    onHomeTap() {
      if (this.data.active === 'home') return;
      wx.navigateBack();
    },

    onHistoryTap() {
      if (this.data.active === 'history') return;
      wx.navigateTo({
        url: `/pages/child-feed/child-feed?familyId=${this.data.familyId}`,
      });
    },

    onSettingsTap() {
      if (this.data.active === 'settings') return;
      wx.navigateTo({
        url: `/pages/child-settings/child-settings?familyId=${this.data.familyId}`,
      });
    },
  },
});
