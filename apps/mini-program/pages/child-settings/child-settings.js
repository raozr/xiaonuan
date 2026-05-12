const app = getApp();

const AGE_RANGE = Array.from({ length: 71 }, (_, i) => 50 + i);
const RELATIONSHIPS = ['女儿', '儿子', '儿媳', '女婿', '其他'];
const DIALECTS = ['普通话', '四川话', '广东话', '上海话', '东北话', '其他'];

Page({
  data: {
    familyId: '',
    elderName: '',
    elderAge: null,
    elderDialect: '',
    elderHobbies: '',
    elderHealthNotes: '',
    elderTopicsToAvoid: '',
    elderGreetingPreference: '',
    childName: '',
    childRelationship: '',
    childCustomNotes: '',
    inviteCode: '',
    familyMembers: [],
    loading: false,

    ageRange: AGE_RANGE,
    relationships: RELATIONSHIPS,
    dialects: DIALECTS,
  },

  async onLoad(options) {
    if (options.familyId) {
      this.setData({ familyId: options.familyId });
      await this.loadSettings();
    }
  },

  async loadSettings() {
    try {
      const res = await app.request({
        url: `/api/family/${this.data.familyId}`,
        method: 'GET',
      });

      if (res.statusCode === 200 && res.data) {
        const family = res.data;
        const elder = family.elder;
        const children = family.children || [];
        const me = children.find((c) => c.userId === app.globalData.userInfo?.id) || children[0] || {};

        this.setData({
          elderName: elder?.name || '',
          elderAge: elder?.age || null,
          elderDialect: elder?.dialect || '',
          elderHobbies: elder?.hobbies || '',
          elderHealthNotes: elder?.healthNotes || '',
          elderTopicsToAvoid: elder?.topicsToAvoid || '',
          elderGreetingPreference: elder?.greetingPreference || '',
          childName: app.globalData.userInfo?.name || me?.name || '',
          childRelationship: me?.relationshipToElder || '',
          childCustomNotes: me?.customNotes || '',
          inviteCode: family?.inviteCode || '',
          familyMembers: children || [],
        });
      }
    } catch (err) {
      console.error('加载设置失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onElderNameInput(e) {
    this.setData({ elderName: e.detail.value });
  },

  onElderAgeChange(e) {
    const index = e.detail.value;
    this.setData({ elderAge: AGE_RANGE[index] });
  },

  onElderDialectChange(e) {
    const index = e.detail.value;
    this.setData({ elderDialect: DIALECTS[index] });
  },

  onElderHobbiesInput(e) {
    this.setData({ elderHobbies: e.detail.value });
  },

  onElderHealthNotesInput(e) {
    this.setData({ elderHealthNotes: e.detail.value });
  },

  onElderTopicsToAvoidInput(e) {
    this.setData({ elderTopicsToAvoid: e.detail.value });
  },

  onElderGreetingPreferenceInput(e) {
    this.setData({ elderGreetingPreference: e.detail.value });
  },

  onChildNameInput(e) {
    this.setData({ childName: e.detail.value });
  },

  onChildRelationshipChange(e) {
    const index = e.detail.value;
    this.setData({ childRelationship: RELATIONSHIPS[index] });
  },

  onChildCustomNotesInput(e) {
    this.setData({ childCustomNotes: e.detail.value });
  },

  async save() {
    const { elderName, elderAge, childName, familyId } = this.data;

    if (!elderName.trim()) {
      wx.showToast({ title: '请输入老人姓名', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '保存中' });

    try {
      const elderRes = await app.request({
        url: `/api/family/${familyId}/elder`,
        method: 'PUT',
        data: {
          name: elderName.trim(),
          age: elderAge,
          dialect: this.data.elderDialect || undefined,
          hobbies: this.data.elderHobbies || undefined,
          healthNotes: this.data.elderHealthNotes || undefined,
          topicsToAvoid: this.data.elderTopicsToAvoid || undefined,
          greetingPreference: this.data.elderGreetingPreference || undefined,
        },
      });

      const meRes = await app.request({
        url: '/api/me',
        method: 'PUT',
        data: {
          name: childName.trim() || undefined,
        },
      });

      if (elderRes.statusCode === 200 && meRes.statusCode === 200) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        wx.navigateBack();
      } else {
        wx.showToast({ title: elderRes.data?.message || meRes.data?.message || '保存失败', icon: 'none' });
      }
    } catch (err) {
      console.error('保存设置失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  copyInviteCode() {
    const code = this.data.inviteCode;
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      },
    });
  },

  async refreshInviteCode() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: `/api/family/${this.data.familyId}/refresh-code`,
        method: 'POST',
        data: {},
      });
      if (res.statusCode === 200) {
        this.setData({ inviteCode: res.data.inviteCode });
        wx.showToast({ title: '邀请码已刷新', icon: 'success' });
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

  goBack() {
    wx.navigateBack();
  },
});
