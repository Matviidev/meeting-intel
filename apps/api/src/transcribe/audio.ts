import { spawn } from 'node:child_process';

export const SAMPLE_RATE = 16_000;
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.mp4'];

export class AudioDecodeError extends Error {}

export function isAudioFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

export function decodeAudio(input: Buffer, ffmpegPath = 'ffmpeg'): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-f',
      'f32le',
      'pipe:1',
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    proc.stdin.on('error', () => undefined);
    proc.on('error', (e) => reject(new AudioDecodeError(`Could not start ffmpeg: ${e.message}`)));
    proc.on('close', (code) => {
      const pcm = Buffer.concat(out);
      if (code !== 0 || pcm.byteLength < 4) {
        const reason = Buffer.concat(err).toString('utf8').trim().split('\n').at(-1);
        return reject(
          new AudioDecodeError(`Could not decode the audio file${reason ? `: ${reason}` : '.'}`),
        );
      }
      const samples = new Float32Array(pcm.byteLength >> 2);
      new Uint8Array(samples.buffer).set(pcm.subarray(0, samples.byteLength));
      resolve(samples);
    });
    proc.stdin.end(input);
  });
}
