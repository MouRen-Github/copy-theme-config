// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('pages/main.html')
  });
});

// 在页面环境中执行的函数
function getPageData() {
  return new Promise((resolve) => {
    let data = null;
    let timeoutId = null;
    
    // 检查数据的函数
    function checkData() {
      try {
        // 按优先级尝试不同的获取方式
        if (window._theme) {
          data = window._theme;
        } else {
          // 遍历window对象查找可能的theme数据
          for (let key in window) {
            try {
              if (key.toLowerCase().includes('_theme') && window[key] && typeof window[key] === 'object') {
                data = window[key];
                break;
              }
            } catch (e) {
              // 忽略访问错误
              continue;
            }
          }
        }
        
        // 验证数据有效性
        if (data && typeof data === 'object') {
          console.log('找到主题数据:', data);
          clearTimeout(timeoutId);
          resolve(data);
          return true;
        }
      } catch (error) {
        console.error('检查数据时出错:', error);
      }
      return false;
    }

    // 使用 MutationObserver 监听DOM变化
    const observer = new MutationObserver(() => {
      if (checkData()) {
        observer.disconnect();
      }
    });

    // 开始观察
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    // 立即检查一次
    if (!checkData()) {
      // 如果没有立即找到，设置一个超时
      timeoutId = setTimeout(() => {
        observer.disconnect();
        console.log('数据获取超时');
        resolve(null);
      }, 5000); // 5秒超时
    }
  });
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'executeScript') {
    // 创建新标签页
    chrome.tabs.create({ url: request.url, active: false }, async (tab) => {
      try {
        // 等待页面加载完成
        await new Promise(resolve => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              // 给页面一点额外时间加载JS
              setTimeout(resolve, 500);
            }
          });
        });

        // 执行脚本获取数据
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: getPageData,
          world: 'MAIN'
        });

        const data = results[0].result;
        console.log('执行脚本获取的数据：', data);
        
        // 根据配置决定是否关闭标签页
        if (request.autoClose) {
          chrome.tabs.remove(tab.id);
        }
        
        // 发送数据
        sendResponse({ 
          success: true, 
          data: data,
          tabId: tab.id
        });
      } catch (error) {
        console.error('执行脚本失败：', error);
        // 发生错误时也根据配置决定是否关闭标签页
        if (request.autoClose) {
          chrome.tabs.remove(tab.id);
        }
        sendResponse({ 
          success: false, 
          error: error.message,
          tabId: tab.id
        });
      }
    });
    return true;
  }
}); 