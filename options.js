// options.js
document.getElementById("openShortcuts").addEventListener("click", () => {
  // 跳转到 Chrome 官方的扩展快捷键管理页面
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// 可选：如果用户一进选项页就想直接跳走，可以取消注释下面这行
// chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
