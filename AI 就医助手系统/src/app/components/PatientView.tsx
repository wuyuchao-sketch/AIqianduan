import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { 
  Mic, 
  StopCircle, 
  FileText, 
  Shield, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Settings,
  QrCode,
  Volume2,
  Type,
  Contrast
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { SpeechTranscription } from '../utils/speechTranscription';

interface PatientViewProps {
  accessibilityMode: boolean;
  setAccessibilityMode: (mode: boolean) => void;
}

interface SymptomRecord {
  id: string;
  timestamp: Date;
  symptoms: string;
  summary: {
    chiefComplaint: string;
    duration: string;
    severity: string;
    medications: string[];
    additionalNotes: string;
  };
}

interface DataAccessLog {
  id: string;
  timestamp: Date;
  accessor: string;
  purpose: string;
  dataType: string;
}

export function PatientView({ accessibilityMode, setAccessibilityMode }: PatientViewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [records, setRecords] = useState<SymptomRecord[]>([]);
  const [dataLogs, setDataLogs] = useState<DataAccessLog[]>([
    {
      id: '1',
      timestamp: new Date('2024-12-10T09:30:00'),
      accessor: '王医生',
      purpose: '门诊问诊',
      dataType: '病情摘要'
    },
    {
      id: '2',
      timestamp: new Date('2024-12-08T14:15:00'),
      accessor: '李医生',
      purpose: '复诊查看',
      dataType: '就诊记录'
    }
  ]);
  const [dataConsent, setDataConsent] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>([]);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'ready' | 'recording' | 'processing' | 'error'>('ready');
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

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startVisualizer = () => {
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
  };

  const stopVisualizer = () => {
    if (visualizerRef.current) {
      clearInterval(visualizerRef.current);
      visualizerRef.current = null;
    }
    setVisualizerData([]);
  };

  const startRecording = async () => {
    try {
      setTranscriptionStatus('recording');
      setCurrentTranscript('');
      setErrorMessage('');
      
      await speechTranscription.current.startRecording();
      setIsRecording(true);
      
      startTimer();
      startVisualizer();
    } catch (error) {
      setTranscriptionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '录音启动失败');
    }
  };

  const stopRecording = async () => {
    try {
      setTranscriptionStatus('processing');
      setIsRecording(false);
      
      stopTimer();
      stopVisualizer();
      
      const audioBlob = await speechTranscription.current.stopRecording();
      
      const result = await speechTranscription.current.transcribeAudio(audioBlob, {
        userId: 'patient_001',
        visitId: `visit_${Date.now()}`,
        language: 'autodialect',
        domain: 'medical'
      });
      
      if (result.status === 'SUCCESS' && result.transcriptionText) {
        setCurrentTranscript(result.transcriptionText);
        setTranscriptionStatus('ready');
        
        // 生成结构化摘要
        const newRecord: SymptomRecord = {
          id: Date.now().toString(),
          timestamp: new Date(),
          symptoms: result.transcriptionText,
          summary: {
            chiefComplaint: '待AI分析',
            duration: '待AI分析',
            severity: '待AI分析',
            medications: [],
            additionalNotes: '语音转录完成，等待AI分析'
          }
        };
        
        setRecords([newRecord, ...records]);
      } else {
        setTranscriptionStatus('error');
        setErrorMessage(result.errorMessage || '转录失败');
      }
    } catch (error) {
      setTranscriptionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '处理录音失败');
      setIsRecording(false);
      stopTimer();
      stopVisualizer();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateQRCode = () => {
    alert('已生成就诊二维码，医生扫描后可查看您的病情摘要');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* 左侧：语音问诊 */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 无障碍设置卡片 */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                <h2>无障碍设置</h2>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Type className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label htmlFor="large-text">大字模式</Label>
                    <p className="text-sm text-gray-500">适合老年用户阅读</p>
                  </div>
                </div>
                <Switch 
                  id="large-text"
                  checked={accessibilityMode}
                  onCheckedChange={setAccessibilityMode}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Contrast className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label>高对比度界面</Label>
                    <p className="text-sm text-gray-500">增强视觉辨识度</p>
                  </div>
                </div>
                <Badge variant="outline">已启用</Badge>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label>语音播报</Label>
                    <p className="text-sm text-gray-500">朗读界面内容</p>
                  </div>
                </div>
                <Badge variant="outline">已启用</Badge>
              </div>
            </div>
          </Card>

          {/* 语音问诊卡片 */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Mic className="w-6 h-6 text-blue-600" />
              <h2>语音描述症状</h2>
            </div>

            {/* 语音录制区域 */}
            <div className="mb-6">
              <div className={`
                border-2 rounded-lg p-8 text-center transition-all
                ${isRecording 
                  ? 'border-red-500 bg-red-50' 
                  : transcriptionStatus === 'processing'
                  ? 'border-blue-500 bg-blue-50'
                  : transcriptionStatus === 'error'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 bg-gray-50'
                }
              `}>
                {isRecording ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="relative">
                        <Mic className="w-16 h-16 text-red-500 animate-pulse" />
                        <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-75" />
                      </div>
                    </div>
                    <p className="text-red-600">正在录音中...</p>
                    <p className="text-sm text-gray-600">请清晰描述您的症状</p>
                    <div className="text-2xl font-bold text-red-600">
                      {formatTime(recordingTime)}
                    </div>
                  </div>
                ) : transcriptionStatus === 'processing' ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-blue-600">正在处理音频...</p>
                    <p className="text-sm text-gray-600">AI正在转录您的语音</p>
                  </div>
                ) : transcriptionStatus === 'error' ? (
                  <div className="space-y-4">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <p className="text-red-600">录音失败</p>
                    <p className="text-sm text-gray-600">{errorMessage}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Mic className="w-16 h-16 text-gray-400 mx-auto" />
                    <p className="text-gray-600">点击下方按钮开始语音描述</p>
                    <p className="text-sm text-gray-500">系统支持普通话及多种方言识别</p>
                  </div>
                )}
              </div>

              {/* 音频可视化 */}
              {isRecording && visualizerData.length > 0 && (
                <div className="flex justify-center items-end h-16 mt-4 gap-1">
                  {visualizerData.map((height, index) => (
                    <div
                      key={index}
                      className="w-1 bg-red-500 rounded-sm transition-all duration-100"
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>
              )}

              {/* 实时转写文本 */}
              {currentTranscript && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">实时转写：</p>
                  <p className={accessibilityMode ? 'text-lg' : ''}>{currentTranscript}</p>
                </div>
              )}

              {/* 录音控制按钮 */}
              <div className="flex gap-3 mt-6 justify-center">
                {!isRecording && transcriptionStatus !== 'processing' ? (
                  <Button 
                    onClick={startRecording}
                    size="lg"
                    className="gap-2"
                    disabled={transcriptionStatus === 'error'}
                  >
                    <Mic className="w-5 h-5" />
                    开始录音
                  </Button>
                ) : isRecording ? (
                  <Button 
                    onClick={stopRecording}
                    size="lg"
                    variant="destructive"
                    className="gap-2"
                  >
                    <StopCircle className="w-5 h-5" />
                    停止录音
                  </Button>
                ) : null}
                
                {transcriptionStatus === 'error' && (
                  <Button 
                    onClick={() => {
                      setTranscriptionStatus('ready');
                      setErrorMessage('');
                    }}
                    size="lg"
                    variant="outline"
                    className="gap-2"
                  >
                    重新开始
                  </Button>
                )}
              </div>
            </div>

            {/* 语音确认提示 */}
            {currentTranscript && !isRecording && transcriptionStatus === 'ready' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-green-900 mb-2">语音转录完成</p>
                  <p className="text-sm text-green-700">
                    系统已成功转录您的语音描述，请确认信息准确性
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* 病情摘要列表 */}
          {records.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
                <h2>病情摘要</h2>
              </div>

              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-500">
                        {record.timestamp.toLocaleString('zh-CN')}
                      </span>
                      <Badge variant="outline">
                        语音转录
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">主诉</p>
                        <p className={accessibilityMode ? 'text-lg' : ''}>
                          {record.summary.chiefComplaint}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">持续时间</p>
                          <p className={accessibilityMode ? 'text-lg' : ''}>
                            {record.summary.duration}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">严重程度</p>
                          <p className={accessibilityMode ? 'text-lg' : ''}>
                            {record.summary.severity}
                          </p>
                        </div>
                      </div>
                      
                      {record.summary.medications.length > 0 && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">已用药物</p>
                          <div className="flex flex-wrap gap-1">
                            {record.summary.medications.map((med, idx) => (
                              <Badge key={idx} variant="secondary">{med}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">补充说明</p>
                        <p className={accessibilityMode ? 'text-lg' : ''}>
                          {record.summary.additionalNotes}
                        </p>
                      </div>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full">
                            查看完整语音转录
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>完整语音转录</DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="h-[400px]">
                            <div className="p-4">
                              <p className={`${accessibilityMode ? 'text-lg' : ''} whitespace-pre-wrap`}>
                                {record.symptoms}
                              </p>
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* 右侧：隐私控制 */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2>隐私设置</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="data-consent">数据共享授权</Label>
                  <p className="text-sm text-gray-500">允许医生查看病情摘要</p>
                </div>
                <Switch 
                  id="data-consent"
                  checked={dataConsent}
                  onCheckedChange={setDataConsent}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">语音数据</span>
                  {dataConsent ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">病情摘要</span>
                  {dataConsent ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">就诊记录</span>
                  {dataConsent ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-6 h-6 text-blue-600" />
              <h2>就诊二维码</h2>
            </div>

            <div className="text-center space-y-4">
              <div className="w-32 h-32 mx-auto bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <QrCode className="w-16 h-16 text-gray-400" />
              </div>
              
              <Button 
                onClick={generateQRCode}
                className="w-full gap-2"
              >
                <QrCode className="w-4 h-4" />
                生成就诊码
              </Button>
              
              <p className="text-sm text-gray-500">
                医生扫描此码可快速获取您的病情摘要
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
              <h2>数据访问记录</h2>
            </div>

            <div className="space-y-3">
              {dataLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className={accessibilityMode ? 'text-lg' : ''}>
                      {log.accessor} - {log.purpose}
                    </p>
                    <p className="text-sm text-gray-500">
                      {log.timestamp.toLocaleString('zh-CN')} · {log.dataType}
                    </p>
                  </div>
                  <Badge variant="outline">已授权</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
