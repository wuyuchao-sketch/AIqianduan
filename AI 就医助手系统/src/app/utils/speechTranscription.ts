interface TranscriptionConfig {
  userId: string;
  visitId: string;
  language?: string;
  domain?: string;
}

interface TranscriptionResult {
  status: 'SUCCESS' | 'ERROR';
  transcriptionText?: string;
  fullText?: string;
  message?: string;
  errorMessage?: string;
}

export class SpeechTranscription {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isRecording = false;

  async startRecording(): Promise<void> {
    try {
      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持录音功能，请使用现代浏览器');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // 检查 MediaRecorder 支持的格式
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      this.mediaRecorder = new MediaRecorder(stream, 
        mimeType ? { mimeType } : undefined
      );
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.analyser.fftSize = 256;

      this.mediaRecorder.start(100);
      this.isRecording = true;

    } catch (error) {
      console.error('录音启动失败:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('请允许浏览器访问麦克风权限');
        } else if (error.name === 'NotFoundError') {
          throw new Error('未找到可用的麦克风设备');
        } else if (error.name === 'NotSupportedError') {
          throw new Error('您的浏览器不支持录音功能');
        }
      }
      throw new Error(`录音失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('没有正在进行的录音'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const pcmBlob = await this.convertToPCM(audioBlob);
          
          this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
          
          this.isRecording = false;
          resolve(pcmBlob);
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  private async convertToPCM(audioBlob: Blob): Promise<Blob> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const targetSampleRate = 16000;
    const channelData = audioBuffer.getChannelData(0);
    const samples = this.resample(channelData, audioBuffer.sampleRate, targetSampleRate);
    
    const pcmData = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return new Blob([pcmData.buffer], { type: 'audio/pcm' });
  }

  private resample(buffer: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
    if (fromSampleRate === toSampleRate) return buffer;
    
    const sampleRateRatio = fromSampleRate / toSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const index = i * sampleRateRatio;
      const indexInt = Math.floor(index);
      const indexFrac = index - indexInt;
      
      if (indexInt < buffer.length - 1) {
        result[i] = buffer[indexInt] * (1 - indexFrac) + buffer[indexInt + 1] * indexFrac;
      } else {
        result[i] = buffer[indexInt] || 0;
      }
    }
    
    return result;
  }

  async transcribeAudio(audioBlob: Blob, config: TranscriptionConfig): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.pcm');
    formData.append('userId', config.userId);
    formData.append('visitId', config.visitId);
    formData.append('audioEncode', 'pcm_s16le');
    formData.append('sampleRate', '16000');
    formData.append('lang', config.language || 'autodialect');
    
    if (config.domain) {
      formData.append('pd', config.domain);
    }

    // 重试机制
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`尝试第 ${attempt} 次上传音频文件...`);
        
        const response = await fetch('/api/transcription/upload', {
          method: 'POST',
          body: formData,
          headers: {
            // 不要手动设置 Content-Type，让浏览器自动设置
          }
        });

        console.log(`响应状态: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HTTP ${response.status} 错误:`, errorText);
          throw new Error(`服务器错误 (${response.status}): ${errorText || '未知错误'}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('非 JSON 响应:', text);
          throw new Error('服务器返回了非 JSON 格式的响应');
        }

        const data = await response.json();
        console.log('转录响应数据:', data);
        
        if (data.status === 'SUCCESS') {
          return {
            status: 'SUCCESS',
            transcriptionText: data.transcriptionText || data.fullText || '',
            message: data.message
          };
        } else {
          return {
            status: 'ERROR',
            errorMessage: data.message || data.errorMessage || '转录失败'
          };
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('未知错误');
        console.error(`第 ${attempt} 次尝试失败:`, lastError.message);
        
        // 如果不是最后一次尝试，等待一段时间后重试
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    return {
      status: 'ERROR',
      errorMessage: `转录失败 (已重试 ${maxRetries} 次): ${lastError?.message || '未知错误'}`
    };
  }

  getAudioVisualizationData(): Uint8Array | null {
    if (!this.analyser || !this.isRecording) return null;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    
    return dataArray;
  }

  get recording(): boolean {
    return this.isRecording;
  }
}
