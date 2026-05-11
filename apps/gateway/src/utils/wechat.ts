import crypto from 'crypto';

const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';

export async function getSessionByCode(
  code: string,
): Promise<{ openid: string; session_key: string }> {
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', WECHAT_APPID);
  url.searchParams.set('secret', WECHAT_SECRET);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  console.log('[wechat] requesting:', url.toString().replace(WECHAT_SECRET, '***'));

  const res = await fetch(url.toString());
  const data = (await res.json()) as Record<string, unknown>;

  console.log('[wechat] response:', JSON.stringify(data));

  if (data.errcode) {
    throw new Error(String(data.errmsg) || '微信接口调用失败');
  }

  if (!data.openid || !data.session_key) {
    throw new Error('微信接口返回异常');
  }

  return {
    openid: String(data.openid),
    session_key: String(data.session_key),
  };
}

export function decryptWechatData(
  sessionKey: string,
  encryptedData: string,
  iv: string,
): Record<string, unknown> {
  const key = Buffer.from(sessionKey, 'base64');
  const encrypted = Buffer.from(encryptedData, 'base64');
  const ivBuffer = Buffer.from(iv, 'base64');

  if (key.length !== 16) {
    throw new Error('sessionKey 长度错误');
  }

  const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuffer);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  const text = decrypted.toString('utf8');
  const result = JSON.parse(text) as Record<string, unknown>;

  // Verify watermark
  const watermark = result.watermark as Record<string, unknown> | undefined;
  if (!watermark || watermark.appid !== process.env.WECHAT_APPID) {
    throw new Error('水印验证失败');
  }

  return result;
}
