// 定义插件页面的完整 URL（替换为你自己的文件名）
const CHROME_EXTENSION_URL = chrome.runtime.getURL("index.html");

// 窗口关闭监听器：记录最后的位置和尺寸
chrome.windows.onRemoved.addListener(async (windowId) => {
  // 这里的逻辑稍微特殊：因为窗口已关闭，我们通常在窗口位置改变时实时记录，
  // 或者在创建逻辑中引用最后一次已知的合法位置。
});

// 改进后的打开窗口函数
async function openOrFocusWindow() {
  // 查找所有标签页
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((tab) => tab.url === CHROME_EXTENSION_URL);

  if (existingTab) {
    // 存在则聚焦
    chrome.windows.update(existingTab.windowId, { focused: true });
    chrome.tabs.update(existingTab.id, { active: true });

    // 新增：发送消息通知 popup 页面聚焦搜索框
    chrome.tabs.sendMessage(existingTab.id, { action: "FOCUS_SEARCH" });
  } else {
    // 不存在则创建独立窗口
    // 1. 先从存储中读取上次的位置
    chrome.storage.local.get(["lastWindowPos"], (res) => {
      const pos = res.lastWindowPos || {};

      // 2. 如果没有记录，则计算屏幕中央位置
      // 我们通过系统显示信息来动态计算
      chrome.system.display.getInfo((displays) => {
        const primary = displays[0].workArea; // 获取主显示器工作区
        const width = pos.width || 1200;
        const height = pos.height || 800;

        const left =
          pos.left ?? Math.round((primary.width - width) / 2 + primary.left);
        const top =
          pos.top ?? Math.round((primary.height - height) / 2 + primary.top);

        chrome.windows.create(
          {
            url: "index.html",
            type: "popup",
            width: width,
            height: height,
            left: left,
            top: top,
            focused: true,
          },
          (win) => {
            // 3. 窗口创建后，监听它的位置变动（可选：为了更精准记录）
            // 或者简单地在 popup.js 中定期保存
          }
        );
      });
    });
  }
}

// 确保 chrome.action 存在后再监听
if (chrome.action) {
  chrome.action.onClicked.addListener(openOrFocusWindow);
}

// 快捷键监听
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-prompt-master") {
    openOrFocusWindow();
  }
});
