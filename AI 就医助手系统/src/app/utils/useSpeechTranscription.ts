import { useState, useRef, useCallback, useEffect } from 'react';
import { SpeechTranscription } from './speechTranscription';

interface TranscriptionConfig {
  userId: string;
  visitId: string;
  language?: string;
  domain?: string;
}

export function useSpeechTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const [status, setStatus] = useState<'ready' | 'recording' | 'processing' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState('');

  const speechTranscription = useRef(new SpeechTranscription());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const visualizerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (visualizerRef.current) clearInterval(visualizerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startVisualizer = useCallback(() => {
    const bars = Array(32).fill(0);
    setVisualizerData(bars);
    
    visualizerRef.current = setInterval(() => {
      const data = speechTranscription.current.getAudioVisualizationData();
      if (data) {
        const newBars = Array(32).fill(0).map((_, index) => {
          const value = data[Math.floor(index * data.length / 32)];
          return Math.max(5, (value / 255) * 50);
        });
        setVisualizerData(newBars);
      }
    }, 50);
  }, []);

  const stopVisualizer = useCallback(() => {
    if (visualizerRef.current) {
      clearInterval(visualizerRef.current);
      visualizerRef.current = null;
    }
    setVisualizerData([]);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setStatus('recording');
      setTranscript('');
      setErrorMessage('');
      
      console.log('开始录音...');
      await speechTranscription.current.startRecording();
      setIsRecording(true);
      
      startTimer();
      startVisualizer();
      console.log('录音已开始');
    } catch (error) {
      console.error('录音启动失败:', error);
      setStatus('error');
      setIsRecording(false);
      setErrorMessage(error instanceof Error ? error.message : '录音启动失败');
    }
  }, [startTimer, startVisualizer]);

  const stopRecording = useCallback(async (config: TranscriptionConfig) => {
    try {
      console.log('停止录音并开始处理...');
      setStatus('processing');
      setIsRecording(false);
      
      stopTimer();
      stopVisualizer();
      
      const audioBlob = await speechTranscription.current.stopRecording();
      console.log('音频文件大小:', audioBlob.size, 'bytes');
      
      if (audioBlob.size === 0) {
        throw new Error('录音文件为空，请重新录制');
      }
      
      const result = await speechTranscription.current.transcribeAudio(audioBlob, config);
      
      if (result.status === 'SUCCESS' && result.transcriptionText) {
        setTranscript(result.transcriptionText);
        setStatus('ready');
        console.log('转录成功:', result.transcriptionText);
        return result.transcriptionText;
      } else {
        setStatus('error');
        const errorMsg = result.errorMessage || '转录失败，请检查网络连接或重试';
        setErrorMessage(errorMsg);
        console.error('转录失败:', errorMsg);
        return null;
      }
    } catch (error) {
      console.error('处理录音失败:', error);
      setStatus('error');
      const errorMsg = error instanceof Error ? error.message : '处理录音失败';
      setErrorMessage(errorMsg);
      setIsRecording(false);
      stopTimer();
      stopVisualizer();
      return null;
    }
  }, [stopTimer, stopVisualizer]);

  const reset = useCallback(() => {
    setStatus('ready');
    setErrorMessage('');
    setTranscript('');
    setRecordingTime(0);
    setVisualizerData([]);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    isRecording,
    transcript,
    recordingTime,
    visualizerData,
    status,
    errorMessage,
    startRecording,
    stopRecording,
    reset,
    formatTime
  };
}