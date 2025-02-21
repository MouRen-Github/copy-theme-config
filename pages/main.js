import {
  showMessage,
  getValueByPath,
  setValueByPath,
  createPreviewIframe,
  createErrorPlaceholder,
  getThemeData,
  updateTheme,
  fetchApiData
} from '../utils/common.js';

document.addEventListener('DOMContentLoaded', function() {
  
  // 获取常用DOM元素
  const elements = {
    urlInput: document.getElementById('urlInput'),
    jsonPathInput: document.getElementById('jsonPathInput'),
    apiUrlInput: document.getElementById('apiUrlInput'),
    tokenInput: document.getElementById('tokenInput'),
    autoCloseCheckbox: document.getElementById('autoCloseTab'),
    resultDiv: document.getElementById('result'),
    previewContainer: document.getElementById('previewContainer'),
    themeDataTextarea: document.getElementById('themeData'),
    modifiedApiData: document.getElementById('modifiedApiData'),
    verifyBtn: document.getElementById('verifyBtn'),
    updateBtn: document.getElementById('updateBtn'),
    getApiDataBtn: document.getElementById('getApiDataBtn')
  };

  // 获取锁按钮
  const tokenLockBtn = document.getElementById('tokenLockBtn');
  const tokenInput = elements.tokenInput;

  // 初始化锁状态
  let isTokenLocked = false;

  // 从存储中获取锁状态和令牌
  chrome.storage.local.get(['isTokenLocked', 'lockedToken'], (result) => {
    if (result.isTokenLocked) {
      isTokenLocked = true;
      tokenInput.value = result.lockedToken || '';
      tokenInput.readOnly = true;
      tokenLockBtn.querySelector('.lock-icon').textContent = '🔒';
    } else {
      tokenInput.readOnly = false;
      tokenLockBtn.querySelector('.lock-icon').textContent = '🔓';
    }
  });

  // 锁按钮点击事件
  tokenLockBtn.addEventListener('click', () => {
    isTokenLocked = !isTokenLocked;
    
    if (isTokenLocked) {
      // 锁定状态
      tokenInput.readOnly = true;
      tokenLockBtn.classList.add('locked');
      tokenLockBtn.querySelector('.lock-icon').textContent = '🔒';
      // 保存到存储
      chrome.storage.local.set({
        isTokenLocked: true,
        lockedToken: tokenInput.value
      });
    } else {
      // 解锁状态
      tokenInput.readOnly = false;
      tokenLockBtn.classList.remove('locked');
      tokenLockBtn.querySelector('.lock-icon').textContent = '🔓';
      // 清除存储
      chrome.storage.local.remove(['isTokenLocked', 'lockedToken']);
    }
  });

  // 验证URL按钮点击事件
  elements.verifyBtn.addEventListener('click', handleVerifyClick);
  
  // 更新按钮点击事件
  elements.updateBtn.addEventListener('click', handleUpdateClick);
  
  // 获取API数据按钮点击事件
  elements.getApiDataBtn.addEventListener('click', handleGetApiDataClick);

  // 获取解析按钮和输入框
  const parseCurlBtn = document.getElementById('parseCurlBtn');
  const apiUrlInput = document.getElementById('apiUrlInput');

  // 监听输入框变化
  apiUrlInput.addEventListener('input', () => {
    // 检查输入内容是否包含cURL特征
    const isCurl = apiUrlInput.value.trim().startsWith('curl ');
    parseCurlBtn.disabled = !isCurl;
  });

  // 解析cURL按钮点击事件
  parseCurlBtn.addEventListener('click', () => {
    try {
      const curlCommand = apiUrlInput.value.trim();
      const { url, authorization } = parseCurl(curlCommand);
      
      // 回填数据
      apiUrlInput.value = url;
      if (authorization) {
        tokenInput.value = authorization;
        // 自动锁定token
        if (!isTokenLocked) {
          tokenLockBtn.click();
        }
      }
      
      // 添加成功状态
      parseCurlBtn.classList.add('active');
      setTimeout(() => parseCurlBtn.classList.remove('active'), 2000);
      
      showMessage('✓ cURL解析成功', 'success');
    } catch (error) {
      showMessage(`✕ ${error.message}`, 'error');
    }
  });

  // cURL解析函数
  function parseCurl(curlCommand) {
    // 将多行命令合并为单行
    curlCommand = curlCommand.replace(/\s*\\\s*/g, ' ').trim();
    
    if (!curlCommand.startsWith('curl ')) {
      throw new Error('无效的cURL命令');
    }

    // 提取URL
    const urlMatch = curlCommand.match(/(https?:\/\/[^\s'"]+)/);
    if (!urlMatch) {
      throw new Error('无法解析URL');
    }
    const url = urlMatch[0];

    // 改进的Authorization头提取
    let authorization = null;
    const authMatch = curlCommand.match(/-H\s*['"]Authorization:\s*(Bearer\s+[^\s'"]+)/i);
    if (authMatch) {
      authorization = authMatch[1].replace(/^Bearer\s*/i, '');
    }

    return { url, authorization };
  }

  // 验证URL处理函数
  async function handleVerifyClick() {
    const { 
      urlInput, jsonPathInput, apiUrlInput, autoCloseCheckbox,
      resultDiv, previewContainer, themeDataTextarea 
    } = elements;
    
    const url = urlInput.value.trim();
    const jsonPath = jsonPathInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    const autoClose = autoCloseCheckbox.checked;

    // 输入验证
    if (!url || !apiUrl) {
      showMessage(url ? '请输入API请求地址' : '请输入URL', 'error');
      return;
    }

    const messageBox = showMessage('正在验证并加载页面，请稍候...', 'loading', 0);
    themeDataTextarea.value = '加载中...';
    previewContainer.innerHTML = '';

    try {
      // 创建预览iframe
      const iframe = createPreviewIframe(url);
      previewContainer.appendChild(iframe);

      // 获取数据
      const data = await getThemeData(url, autoClose);
      
      // 处理数据
      if (data) {
        const pathData = jsonPath ? getValueByPath(data, jsonPath) : data;
        if (pathData !== undefined) {
          themeDataTextarea.value = JSON.stringify(pathData, null, 2);
          messageBox.hide();
          showMessage('✓ 页面加载成功', 'success');
        } else {
          throw new Error(`未找到路径 "${jsonPath}" 对应的数据`);
        }
      } else {
        throw new Error('未找到主题数据');
      }
    } catch (error) {
      console.error('验证过程出错:', error);
      messageBox.hide();
      showMessage(`✕ ${error.message}`, 'error');
      themeDataTextarea.value = error.message;
      
      // 显示错误占位
      previewContainer.innerHTML = createErrorPlaceholder(error.message);
    }
  }

  // 更新主题处理函数
  async function handleUpdateClick() {
    const { apiUrlInput, tokenInput, modifiedApiData } = elements;
    
    const apiUrl = apiUrlInput.value.trim();
    const token = tokenInput.value.trim();
    const themeData = modifiedApiData.value.trim();

    // 输入验证
    if (!apiUrl || !token || !themeData) {
      showMessage(
        !apiUrl ? '请输入API请求地址' :
        !token ? '请输入访问令牌' :
        '没有可更新的主题数据',
        'error'
      );
      return;
    }

    const messageBox = showMessage('正在更新主题数据...', 'loading', 0);

    try {
      // 解析JSON数据
      const themeJson = JSON.parse(themeData);

      // 验证主题数据格式
      if (!isValidThemeData(themeJson)) {
        throw new Error('主题数据格式无效');
      }

      // 发送更新请求
      const response = await updateTheme(apiUrl, token, themeJson);
      
      messageBox.hide();
      showMessage('✓ 主题更新成功', 'success');
    } catch (error) {
      console.error('更新主题时出错:', error);
      messageBox.hide();
      showMessage(`✕ ${error.message}`, 'error');
    }
  }

  // 验证主题数据格式的函数
  function isValidThemeData(themeJson) {
    // 根据 API 的预期格式进行验证
    // 例如，检查是否包含必要的字段
    return themeJson && typeof themeJson === 'object';
  }

  // 获取API数据处理函数
  async function handleGetApiDataClick() {
    const { 
      apiUrlInput, tokenInput, jsonPathInput, 
      themeDataTextarea, modifiedApiData 
    } = elements;
    
    const apiUrl = apiUrlInput.value.trim();
    const token = tokenInput.value.trim();
    const jsonPath = jsonPathInput.value.trim();
   

    if (!apiUrl || !token) {
      showMessage(!apiUrl ? '请输入API请求地址' : '请输入访问令牌', 'error');
      return;
    }

    const messageBox = showMessage('正在获取API数据...', 'loading', 0);

    try {
      // 获取API数据
      const apiData = await fetchApiData(apiUrl, token);
      
      // 获取Theme数据
      const themeValue = themeDataTextarea.value.trim() 
        ? JSON.parse(themeDataTextarea.value) 
        : null;

      if (!themeValue) {
        throw new Error('请先获取Theme数据');
      }

      let newJson = themeValue;

      // 创建API数据的副本并更新
      const modifiedData = JSON.parse(JSON.stringify(apiData));
      if (jsonPath) {
        newJson = setValueByPath(modifiedData, jsonPath, themeValue);
      }

      // 更新显示
      modifiedApiData.value = JSON.stringify(newJson, null, 2);
      
      messageBox.hide();
      showMessage('✓ API数据获取并修改成功', 'success');
    } catch (error) {
      console.error('获取或修改API数据时出错:', error);
      messageBox.hide();
      showMessage(`✕ ${error.message}`, 'error');
    }
  }
});
