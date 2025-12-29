import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Sparkles,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Download
} from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { medicalSummaryAPI, MedicalSummaryResponse } from '../utils/medicalAPI';

interface MedicalSummaryPanelProps {
  patientId: string;
  patientName: string;
  accessibilityMode: boolean;
  onSummaryGenerated?: (summary: any) => void;
}

type MedicalSummary = MedicalSummaryResponse;

export function MedicalSummaryPanel({ 
  patientId, 
  patientName, 
  accessibilityMode,
  onSummaryGenerated 
}: MedicalSummaryPanelProps) {
  const [summary, setSummary] = useState<MedicalSummary | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamContent, setStreamContent] = useState('');

  const visitId = 'visit_001';
  const doctorId = 'doctor_001';

  // 获取病历总结
  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await medicalSummaryAPI.getSummaryByVisit(visitId);
      setSummary(data);
      onSummaryGenerated?.(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        setSummary(null);
      } else {
        setError(err instanceof Error ? err.message : '获取病历总结失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 生成病历总结（流式）
  const generateSummary = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setStreamContent('');

      // 调用流式生成接口
      const response = await medicalSummaryAPI.generateSummaryStream(visitId, doctorId, patientId);

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.event === 'message') {
                setStreamContent(prev => prev + (data.content || ''));
              } else if (data.event === 'completed') {
                // 生成完成，重新获取病历总结
                setTimeout(() => fetchSummary(), 1000);
                break;
              } else if (data.event === 'error') {
                throw new Error(data.message || '生成失败');
              }
            } catch (parseError) {
              console.warn('解析SSE数据失败:', parseError);
            }
          }
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '生成病历总结失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 组件加载时尝试获取现有总结
  useEffect(() => {
    fetchSummary();
  }, [patientId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          <h3>AI 病例总结</h3>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchSummary}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {summary && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-red-900">错误</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>加载中...</span>
        </div>
      )}

      {!summary && !isLoading && !error && (
        <Card className="p-6 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h4 className="mb-2">暂无病例总结</h4>
          <p className="text-gray-600 mb-4">
            为患者 {patientName} 生成AI病例总结
          </p>
          <Button 
            onClick={generateSummary}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                生成病例总结
              </>
            )}
          </Button>
        </Card>
      )}

      {isGenerating && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <div>
              <p className="text-purple-600">AI正在生成病例总结...</p>
              <p className="text-sm text-gray-600">
                分析患者症状、病史和用药情况
              </p>
            </div>
          </div>
          
          {streamContent && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">实时生成内容：</p>
              <ScrollArea className="h-[200px]">
                <pre className={`${accessibilityMode ? 'text-lg' : ''} whitespace-pre-wrap`}>
                  {streamContent}
                </pre>
              </ScrollArea>
            </div>
          )}
        </Card>
      )}

      {summary && !isGenerating && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-600">病例总结已生成</span>
            <Badge variant="secondary">
              {new Date(summary.createdAt).toLocaleString('zh-CN')}
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">症状详情</h4>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className={accessibilityMode ? 'text-lg' : ''}>
                  {summary.symptomDetails}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">生命体征</h4>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className={accessibilityMode ? 'text-lg' : ''}>
                  {summary.vitalSigns}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">既往病史</h4>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className={accessibilityMode ? 'text-lg' : ''}>
                  {summary.pastMedicalHistory}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">当前用药</h4>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className={accessibilityMode ? 'text-lg' : ''}>
                  {summary.currentMedications}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={generateSummary}
                variant="outline"
                disabled={isGenerating}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新生成
              </Button>
              <Button 
                variant="default"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                导入HIS系统
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}