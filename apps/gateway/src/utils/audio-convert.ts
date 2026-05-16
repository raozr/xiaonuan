import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';

// ffmpeg-static is optional; prefer system ffmpeg via env var or PATH
let ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    ffmpegPath = ffmpegStatic;
  }
} catch {
  // ffmpeg-static not installed, use system ffmpeg
}

export async function convertM4aToWav(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const ffmpeg: ChildProcessWithoutNullStreams = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-f', 'wav',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      'pipe:1',
    ]);

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', () => {
      // ffmpeg writes progress info to stderr; ignore unless process fails
    });

    ffmpeg.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    ffmpeg.on('error', (err: Error) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });

    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}
