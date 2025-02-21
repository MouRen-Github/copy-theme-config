/**
 * 显示消息弹窗
 * @param {string} message - 要显示的消息
 * @param {string} type - 消息类型 ('info'|'success'|'error'|'warning'|'loading')
 * @param {number} duration - 显示持续时间(毫秒)，0表示不自动关闭
 * @returns {Object} 包含hide方法的控制对象
 */
export function showMessage(message, type = 'info', duration = 500) {
  const modal = document.getElementById('messageModal');
  const messageEl = modal.querySelector('.modal-message');
  
  messageEl.textContent = message;
  messageEl.className = 'modal-message ' + type;
  modal.classList.add('show');
  
  if (duration > 0) {
    setTimeout(() => {
      modal.classList.remove('show');
    }, duration);
  }
  
  return {
    hide: () => modal.classList.remove('show')
  };
}

/**
 * 改进的路径获取函数
 * @param {Object} obj - 要获取值的对象
 * @param {string} path - 路径字符串
 * @returns {*} 找到的值，如果路径无效则返回undefined
 */
export function getValueByPath(obj, path) {
  if (!path || typeof path !== 'string') return obj;
  
  // 预处理路径，处理 xxx.[0] 的情况
  path = path.replace(/\.\[/g, '[');
  
  // 将路径分解为标记数组
  const tokens = path.match(/[^\.\[\]]+|\[\d+\]/g) || [];
  
  let result = obj;
  for (let token of tokens) {
    // 检查当前结果是否有效
    if (result === null || result === undefined) {
      return undefined;
    }
    
    // 处理数组索引
    if (token.startsWith('[') && token.endsWith(']')) {
      const index = parseInt(token.slice(1, -1), 10);
      if (isNaN(index) || !Array.isArray(result)) {
        return undefined;
      }
      result = result[index];
    }
    // 处理对象属性
    else {
      result = result[token];
    }
  }
  
  return result;
}

/**
 * 改进的路径设置函数
 * @param {Object} obj - 要设置值的对象
 * @param {string} path - 路径字符串
 * @param {*} value - 要设置的值
 * @returns {Object} 修改后的对象
 */
export function setValueByPath(obj, path, value) {
  if (!path || typeof path !== 'string') return value;
  
  // 预处理路径，处理 xxx.[0] 的情况
  path = path.replace(/\.\[/g, '[');
  
  // 将路径分解为标记数组
  const tokens = path.match(/[^\.\[\]]+|\[\d+\]/g) || [];
  
  // 如果obj为空，初始化为空对象
  if (!obj || typeof obj !== 'object') {
    obj = {};
  }
  
  let current = obj;
  
  // 遍历到倒数第二个token
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    
    // 处理数组索引
    if (token.startsWith('[') && token.endsWith(']')) {
      const index = parseInt(token.slice(1, -1), 10);
      if (isNaN(index)) {
        throw new Error(`无效的数组索引: ${token}`);
      }
      // 如果下一层不存在或不是数组，创建数组
      if (!Array.isArray(current)) {
        current = [];
      }
      // 确保数组长度足够
      while (current.length <= index) {
        current.push({});
      }
      current = current[index];
    }
    // 处理对象属性
    else {
      // 如果下一层不存在或不是对象，创建对象
      if (!current[token] || typeof current[token] !== 'object') {
        current[token] = {};
      }
      current = current[token];
    }
  }
  
  // 设置最后一层的值
  const lastToken = tokens[tokens.length - 1];
  if (lastToken.startsWith('[') && lastToken.endsWith(']')) {
    const index = parseInt(lastToken.slice(1, -1), 10);
    if (isNaN(index)) {
      throw new Error(`无效的数组索引: ${lastToken}`);
    }
    if (!Array.isArray(current)) {
      current = [];
    }
    current[index] = value;
  } else {
    current[lastToken] = value;
  }
  
  return obj;
}

/**
 * 创建预览iframe元素
 * @param {string} url - iframe的src地址
 * @returns {HTMLIFrameElement} 创建的iframe元素
 */
export function createPreviewIframe(url) {
  const iframe = document.createElement('iframe');
  iframe.className = 'preview-frame';
  iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock';
  iframe.src = url;
  return iframe;
}

/**
 * 创建错误占位符HTML
 * @param {string} message - 错误信息
 * @returns {string} 错误占位符的HTML字符串
 */
export function createErrorPlaceholder(message) {
  return `
    <div class="preview-placeholder">
      <div>加载失败</div>
      <div style="font-size: 12px; margin-top: 8px; color: #666;">
        ${message}
      </div>
    </div>
  `;
}

/**
 * 从扩展获取主题数据
 * @param {string} url - 目标页面URL
 * @param {boolean} autoClose - 是否自动关闭新标签页
 * @returns {Promise<Object>} 主题数据
 */
export async function getThemeData(url, autoClose) {
  const response = await new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'executeScript',
      url: url,
      autoClose: autoClose
    }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });

  if (!response.success) {
    throw new Error(response.error || '获取数据失败');
  }

  return response.data;
}

/**
 * 更新主题数据
 * @param {string} apiUrl - API地址
 * @param {string} token - 访问令牌
 * @param {Object} themeJson - 要更新的主题数据
 * @returns {Promise<string>} 响应文本
 */
export async function updateTheme(apiUrl, token, themeJson) {
  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(themeJson)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const responseJson = JSON.parse(responseText);
        errorMessage = responseJson.message || responseJson.error || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      console.error('API 请求失败:', {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
        errorMessage: errorMessage
      });
      throw new Error(errorMessage);
    }

    return responseText;
  } catch (error) {
    console.error('更新主题时发生错误:', error);
    throw error;
  }
}

/**
 * 获取API数据
 * @param {string} apiUrl - API地址
 * @param {string} token - 访问令牌
 * @returns {Promise<Object>} API响应数据
 */
export async function fetchApiData(apiUrl, token) {
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
} 