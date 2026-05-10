import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { decryptWechatData } from './wechat.js';

describe('decryptWechatData', () => {
  const appid = 'wx_test_appid';

  function createEncryptedData(payload: object, sessionKey: string, iv: string) {
    const key = Buffer.from(sessionKey, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const cipher = crypto.createCipheriv('aes-128-cbc', key, ivBuffer);
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  it('should decrypt valid wechat data', () => {
    const sessionKey = Buffer.from('1234567890123456').toString('base64');
    const iv = Buffer.from('abcdefghijklmnop').toString('base64');
    const payload = {
      phoneNumber: '13800138000',
      purePhoneNumber: '13800138000',
      countryCode: '86',
      watermark: { timestamp: 1234567890, appid },
    };
    const encryptedData = createEncryptedData(payload, sessionKey, iv);

    // Temporarily override WECHAT_APPID for watermark check
    const originalAppid = process.env.WECHAT_APPID;
    process.env.WECHAT_APPID = appid;

    try {
      const result = decryptWechatData(sessionKey, encryptedData, iv);
      expect(result.phoneNumber).toBe('13800138000');
      expect(result.purePhoneNumber).toBe('13800138000');
      expect(result.countryCode).toBe('86');
    } finally {
      process.env.WECHAT_APPID = originalAppid;
    }
  });

  it('should throw on invalid sessionKey length', () => {
    const badKey = Buffer.from('short').toString('base64');
    const iv = Buffer.from('abcdefghijklmnop').toString('base64');

    expect(() => decryptWechatData(badKey, 'any', iv)).toThrow('sessionKey 长度错误');
  });

  it('should throw on watermark mismatch', () => {
    const sessionKey = Buffer.from('1234567890123456').toString('base64');
    const iv = Buffer.from('abcdefghijklmnop').toString('base64');
    const payload = {
      phoneNumber: '13800138000',
      watermark: { timestamp: 1234567890, appid: 'wrong_appid' },
    };
    const encryptedData = createEncryptedData(payload, sessionKey, iv);

    const originalAppid = process.env.WECHAT_APPID;
    process.env.WECHAT_APPID = appid;

    try {
      expect(() => decryptWechatData(sessionKey, encryptedData, iv)).toThrow('水印验证失败');
    } finally {
      process.env.WECHAT_APPID = originalAppid;
    }
  });

  it('should throw on tampered data', () => {
    const sessionKey = Buffer.from('1234567890123456').toString('base64');
    const iv = Buffer.from('abcdefghijklmnop').toString('base64');

    expect(() => decryptWechatData(sessionKey, 'dGVzdA==', iv)).toThrow();
  });
});
