// API 连接测试工具
export async function testBackendConnection(): Promise<boolean> {
  try {
    console.log('测试后端连接...');
    
    const response = await fetch('/api/transcription/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('健康检查响应状态:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('健康检查响应数据:', data);
      return data.status === 'UP';
    }
    
    return false;
  } catch (error) {
    console.error('后端连接测试失败:', error);
    return false;
  }
}

export async function testMediaDevices(): Promise<{ supported: boolean; error?: string }> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { 
        supported: false, 
        error: '浏览器不支持媒体设备访问' 
      };
    }

    // 测试麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    
    return { supported: true };
  } catch (error) {
    let errorMessage = '未知错误';
    
    if (error instanceof Error) {
      switch (error.name) {
        case 'NotAllowedError':
          errorMessage = '麦克风权限被拒绝';
          break;
        case 'NotFoundError':
          errorMessage = '未找到麦克风设备';
          break;
        case 'NotSupportedError':
          errorMessage = '浏览器不支持录音功能';
          break;
        default:
          errorMessage = error.message;
      }
    }
    
    return { 
      supported: false, 
      error: errorMessage 
    };
  }
}