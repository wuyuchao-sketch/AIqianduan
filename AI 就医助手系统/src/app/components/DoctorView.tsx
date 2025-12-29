import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { 
  Search,
  Mic,
  StopCircle,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  User,
  QrCode,
  Sparkles,
  Download
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SpeechTranscription } from '../utils/speechTranscription';
import { MedicalSummaryPanel } from './MedicalSummaryPanel';
import { medicalSummaryAPI } from '../utils/medicalAPI';

interface DoctorViewProps {
  accessibilityMode: boolean;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  checkInTime: Date;
  chiefComplaint: string;
  severity: 'low' | 'medium' | 'high';
  summary: {
    chiefComplaint: string;
    duration: string;
    severity: string;
    medications: string[];
    additionalNotes: string;
    symptoms: string;
  };
}

interface ConsultationRecord {
  patientId: string;
  patientName: string;
  transcript: string;
  timestamp: Date;
  generatedSummary?: string;
}

interface MedicalSummary {
  summaryId: string;
  visitId: string;
  content: string;
  status: 'generating' | 'completed' | 'error';
  timestamp: Date;
  isStreaming?: boolean;
}

export function DoctorView({ accessibilityMode }: DoctorViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [consultationTranscript, setConsultationTranscript] = useState('');
  const [consultationRecords, setConsultationRecords] = useState<ConsultationRecord[]>([]);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const [patients] = useState<Patient[]>([
    {
      id: '1',
      name: '张明远',
      age: 68,
      gender: '男',
      checkInTime: new Date('2024-12-14T09:15:00'),
      chiefComplaint: '头痛伴恶心',
      severity: 'medium',
      summary: {
        chiefComplaint: '头痛伴恶心',
        duration: '3天',
        severity: '中度（影响睡眠）',
        medications: ['布洛芬 1片'],
        additionalNotes: '右侧太阳穴疼痛，发热37.5°C',
        symptoms: '我最近三天一直头疼，特别是右边太阳穴那里，一阵一阵的疼，疼起来的时候还有点恶心想吐。昨天晚上疼得睡不着觉，吃了一片布洛芬，好了一点。我还有点发烧，体温大概37.5度左右。'
      }
    },
    {
      id: '2',
      name: '汤魏诚',
      age: 22,
      gender: '男',
      checkInTime: new Date('2024-12-14T09:30:00'),
      chiefComplaint: '咳嗽、咽痛',
      severity: 'low',
      summary: {
        chiefComplaint: '咳嗽伴咽痛',
        duration: '5天',
        severity: '轻度',
        medications: ['蜂蜜水'],
        additionalNotes: '干咳为主，无发热，咽部红肿',
        symptoms: '喉咙痛了差不多5天了，开始只是有点干痒，现在吞咽的时候会疼。这两天开始咳嗽，是干咳，没有痰。没有发烧，就是嗓子不舒服。'
      }
    },
    {
      id: '3',
      name: '李红梅',
      age: 45,
      gender: '女',
      checkInTime: new Date('2024-12-14T10:00:00'),
      chiefComplaint: '胃痛、反酸',
      severity: 'medium',
      summary: {
        chiefComplaint: '胃痛伴反酸',
        duration: '1周',
        severity: '中度（饭后加重）',
        medications: ['奥美拉唑 20mg'],
        additionalNotes: '空腹及夜间疼痛明显，进食后缓解',
        symptoms: '胃一直不太舒服，特别是吃完饭以后会疼，还经常反酸水，晚上睡觉的时候也会疼醒。已经吃了一周的奥美拉唑了，好像效果不是很明显。'
      }
    }
  ]);

  const filteredPatients = patients.filter(patient => 
    patient.name.includes(searchQuery) || 
    patient.chiefComplaint.includes(searchQuery)
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'high': return '紧急';
      case 'medium': return '中等';
      case 'low': return '轻症';
      default: return '未知';
    }
  };

  // 模拟扫码获取患者信息
  const scanPatientQRCode = () => {
    if (patients.length > 0) {
      setSelectedPatient(patients[0]);
    }
  };

  // 真实语音问诊记录
  const startConsultationRecording = async () => {
    try {
      setTranscriptionStatus('recording');
      setConsultationTranscript('');
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

  const stopConsultationRecording = async () => {
    try {
      setTranscriptionStatus('processing');
      setIsRecording(false);
      
      stopTimer();
      stopVisualizer();
      
      const audioBlob = await speechTranscription.current.stopRecording();
      
      const result = await speechTranscription.current.transcribeAudio(audioBlob, {
        userId: 'doctor_001',
        visitId: selectedPatient ? `visit_${selectedPatient.id}_${Date.now()}` : `visit_${Date.now()}`,
        language: 'autodialect',
        domain: 'medical'
      });
      
      if (result.status === 'SUCCESS' && result.transcriptionText) {
        setConsultationTranscript(result.transcriptionText);
        setTranscriptionStatus('ready');
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

  // 测试API接口
  const testAPIConnection = async () => {
    try {
      const summaries = await medicalSummaryAPI.getAllSummaries();
      
      alert(`API连接测试成功！\n病历总结数量: ${summaries.length}`);
    } catch (error) {
      alert(`API连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const generateMedicalRecord = () => {
    if (!selectedPatient || !consultationTranscript) return;

    const summary = `【病历摘要】
患者姓名：${selectedPatient.name}
性别年龄：${selectedPatient.gender} ${selectedPatient.age}岁
就诊时间：${new Date().toLocaleString('zh-CN')}

主诉：${selectedPatient.summary.chiefComplaint}
病史：${selectedPatient.summary.symptoms}

现病史：
- 症状持续时间：${selectedPatient.summary.duration}
- 严重程度：${selectedPatient.summary.severity}
- 已用药物：${selectedPatient.summary.medications.join('、')}
- 补充说明：${selectedPatient.summary.additionalNotes}

问诊记录：
${consultationTranscript}

初步诊断：偏头痛可能，需进一步检查排除器质性病变
处理方案：
1. 完善头颅CT检查
2. 予以非甾体类抗炎药对症治疗
3. 注意休息，避免劳累
4. 如症状加重请及时复诊

医生签名：王医生
日期：${new Date().toLocaleDateString('zh-CN')}`;

    const newRecord: ConsultationRecord = {
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      transcript: consultationTranscript,
      timestamp: new Date(),
      generatedSummary: summary
    };

    setConsultationRecords([newRecord, ...consultationRecords]);
    alert('病历总结已生成！');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* 左侧：患者列表 */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-6 h-6 text-blue-600" />
              <h2>待诊患者</h2>
            </div>

            {/* 搜索框 */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索患者姓名或症状"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* 扫码功能 */}
            <Button 
              onClick={scanPatientQRCode}
              variant="outline" 
              className="w-full mb-4 gap-2"
            >
              <QrCode className="w-4 h-4" />
              扫描患者就诊码
            </Button>

            {/* API测试按钮 */}
            <Button 
              onClick={testAPIConnection}
              variant="outline" 
              className="w-full mb-4 gap-2"
            >
              <Sparkles className="w-4 h-4" />
              测试API连接
            </Button>

            {/* 患者列表 */}
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`
                      border rounded-lg p-4 cursor-pointer transition-all
                      ${selectedPatient?.id === patient.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={accessibilityMode ? 'text-lg' : ''}>
                        {patient.name}
                      </span>
                      <Badge variant={getSeverityColor(patient.severity)}>
                        {getSeverityText(patient.severity)}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{patient.gender} · {patient.age}岁</p>
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {patient.checkInTime.toLocaleTimeString('zh-CN', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                      <p className="text-gray-900">{patient.chiefComplaint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* 中间和右侧：患者详情与问诊 */}
        <div className="md:col-span-2 space-y-6">
          {selectedPatient ? (
            <>
              {/* 患者病情摘要 */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h2>AI 病情摘要</h2>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      导入HIS系统
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">患者信息</p>
                      <p className={accessibilityMode ? 'text-lg' : ''}>
                        {selectedPatient.name} · {selectedPatient.gender} · {selectedPatient.age}岁
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">就诊时间</p>
                      <p className={accessibilityMode ? 'text-lg' : ''}>
                        {selectedPatient.checkInTime.toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">主诉</p>
                      <p className={accessibilityMode ? 'text-lg' : ''}>
                        {selectedPatient.summary.chiefComplaint}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">持续时间</p>
                      <p className={accessibilityMode ? 'text-lg' : ''}>
                        {selectedPatient.summary.duration}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">严重程度</p>
                      <p className={accessibilityMode ? 'text-lg' : ''}>
                        {selectedPatient.summary.severity}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">已用药物</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPatient.summary.medications.map((med, idx) => (
                          <Badge key={idx} variant="secondary">{med}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-gray-600 mb-1">补充说明</p>
                    <p className={`${accessibilityMode ? 'text-lg' : ''} text-gray-700`}>
                      {selectedPatient.summary.additionalNotes}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-gray-600 mb-1">患者原始描述</p>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className={`${accessibilityMode ? 'text-lg' : ''} text-gray-700`}>
                        {selectedPatient.summary.symptoms}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-green-900">AI 可信度评估：高</p>
                      <p className="text-green-700">
                        症状描述完整，时间线清晰，包含关键信息（体温、用药记录）
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* AI 病例总结面板 */}
              <Card className="p-6">
                <MedicalSummaryPanel 
                  patientId={selectedPatient.id}
                  patientName={selectedPatient.name}
                  accessibilityMode={accessibilityMode}
                  onSummaryGenerated={(summary) => {
                    console.log('病例总结生成完成:', summary);
                  }}
                />
              </Card>

              {/* 问诊记录 */}
              <Card className="p-6">
                <Tabs defaultValue="recording">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="recording">语音问诊</TabsTrigger>
                    <TabsTrigger value="records">
                      历史记录
                      {consultationRecords.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {consultationRecords.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="recording" className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Mic className="w-6 h-6 text-blue-600" />
                      <h3>语音问诊记录</h3>
                    </div>

                    {/* 录音区域 */}
                    <div className={`
                      border-2 rounded-lg p-6 transition-all
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
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Mic className="w-8 h-8 text-red-500 animate-pulse" />
                            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-75" />
                          </div>
                          <div className="flex-1">
                            <p className="text-red-600">正在录音...</p>
                            <p className="text-sm text-gray-600">
                              系统正在记录您与患者的对话
                            </p>
                            <div className="text-lg font-bold text-red-600 mt-1">
                              {formatTime(recordingTime)}
                            </div>
                          </div>
                        </div>
                      ) : transcriptionStatus === 'processing' ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <div>
                            <p className="text-blue-600">正在处理音频...</p>
                            <p className="text-sm text-gray-600">
                              AI正在转录问诊对话
                            </p>
                          </div>
                        </div>
                      ) : transcriptionStatus === 'error' ? (
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                          <div>
                            <p className="text-red-600">录音失败</p>
                            <p className="text-sm text-gray-600">{errorMessage}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Mic className="w-8 h-8 text-gray-400" />
                          <div>
                            <p className="text-gray-600">点击开始录制问诊对话</p>
                            <p className="text-sm text-gray-500">
                              AI 将自动生成结构化病历摘要
                            </p>
                          </div>
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

                    {/* 实时转写 */}
                    {consultationTranscript && (
                      <div className="border rounded-lg p-4 bg-white">
                        <p className="text-sm text-gray-600 mb-2">实时转写：</p>
                        <ScrollArea className="h-[200px]">
                          <pre className={`${accessibilityMode ? 'text-lg' : ''} whitespace-pre-wrap`}>
                            {consultationTranscript}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}

                    {/* 控制按钮 */}
                    <div className="flex gap-3">
                      {!isRecording && transcriptionStatus !== 'processing' ? (
                        <Button 
                          onClick={startConsultationRecording}
                          className="gap-2"
                          disabled={transcriptionStatus === 'error'}
                        >
                          <Mic className="w-4 h-4" />
                          开始问诊录音
                        </Button>
                      ) : isRecording ? (
                        <Button 
                          onClick={stopConsultationRecording}
                          variant="destructive"
                          className="gap-2"
                        >
                          <StopCircle className="w-4 h-4" />
                          停止录音
                        </Button>
                      ) : null}
                      
                      {consultationTranscript && !isRecording && transcriptionStatus === 'ready' && (
                        <Button 
                          onClick={generateMedicalRecord}
                          className="gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          AI 生成病历总结
                        </Button>
                      )}
                      
                      {transcriptionStatus === 'error' && (
                        <Button 
                          onClick={() => {
                            setTranscriptionStatus('ready');
                            setErrorMessage('');
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          重新开始
                        </Button>
                      )}
                    </div>

                    {consultationTranscript && !isRecording && transcriptionStatus === 'ready' && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-green-900 mb-1">
                            语音转录完成
                          </p>
                          <p className="text-sm text-green-700">
                            点击"AI 生成病历总结"按钮，系统将自动生成结构化病历
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="records" className="space-y-4">
                    {consultationRecords.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>暂无问诊记录</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                          {consultationRecords.map((record, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p>{record.patientName}</p>
                                  <p className="text-sm text-gray-500">
                                    {record.timestamp.toLocaleString('zh-CN')}
                                  </p>
                                </div>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <Download className="w-3 h-3" />
                                  导出
                                </Button>
                              </div>

                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full">
                                    查看完整病历
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>病历总结</DialogTitle>
                                  </DialogHeader>
                                  <ScrollArea className="h-[500px]">
                                    <pre className="whitespace-pre-wrap text-sm">
                                      {record.generatedSummary}
                                    </pre>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="mb-2">请选择患者</h3>
              <p className="text-gray-600">
                从左侧列表选择患者或扫描患者就诊码
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
