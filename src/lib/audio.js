
function audioBufferToWavBlob(audioBuffer) {
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const interleaved = new Float32Array(length * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    const src = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) interleaved[i * numChannels + ch] = src[i];
  }
  const pcm = new Int16Array(interleaved.length);
  for (let i = 0; i < interleaved.length; i++) {
    pcm[i] = Math.max(-32768, Math.min(32767, Math.round(interleaved[i] * 32767)));
  }
  const dataSize = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ws = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numChannels * 2, true); v.setUint16(32, numChannels * 2, true);
  v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, dataSize, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

function extractAudioChunk(audioBuffer, startSec, endSec) {
  const sr = audioBuffer.sampleRate;
  const numCh = Math.min(audioBuffer.numberOfChannels, 2);
  const startSample = Math.floor(startSec * sr);
  const endSample = Math.min(Math.ceil(endSec * sr), audioBuffer.length);
  const chunkLen = endSample - startSample;
  const chunk = new AudioBuffer({ numberOfChannels: numCh, length: chunkLen, sampleRate: sr });
  for (let ch = 0; ch < numCh; ch++) {
    chunk.getChannelData(ch).set(audioBuffer.getChannelData(ch).subarray(startSample, endSample));
  }
  return chunk;
}


export { audioBufferToWavBlob, extractAudioChunk };
