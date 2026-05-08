document.addEventListener("DOMContentLoaded", () => {
  // --- 1. 元素引用 ---
  const navItemsContainer = document.getElementById("sidebar");
  const cardGrid = document.querySelector(".grid-container");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const modal = document.getElementById("modalOverlay");
  const modalTitle = modal.querySelector("h2");
  const settingsBtn = document.getElementById("settingsBtn");
  const sortBtn = document.getElementById("sortBtn");

  // 标签输入与自定义下拉框
  const tagInput = document.getElementById("newTag");
  const tagDropdown = document.getElementById("tagDropdown");

  const addBtn = document.getElementById("addBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const saveBtn = document.getElementById("saveBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const fileInput = document.getElementById("fileInput");

  let allPrompts = [];
  let editingIndex = null;
  let sortOrder = "desc"; // "desc" = 最新在前, "asc" = 最早在前
  const DEFAULT_PROMPTS = [
    {
      name: "文章润色专家",
      tag: "writing",
      content:
        "请将下面的文本润色为更通顺、更专业的中文，同时保留原意并给出三种不同风格（正式、亲切、技术性）的改写版本。",
      isPinned: false,
    },
    {
      name: "Tailwind 助手",
      tag: "coding",
      content:
        "根据下面的 UI 描述，生成对应的 Tailwind CSS 类名与简短示例 HTML，包含响应式样式和可访问性建议。",
      isPinned: false,
    },
    {
      name: "市场文案生成器",
      tag: "marketing",
      content:
        "为一款目标用户为职场人士的时间管理工具，生成三条不同角度的产品宣传文案（简洁、情感、功能导向），并包含一句 30 字以内的广告语。",
      isPinned: false,
    },
  ];

  // --- 2. 初始化加载 ---
  chrome.storage.local.get(["myPrompts", "sortOrder"], (result) => {
    // 读取排序偏好
    sortOrder = result.sortOrder || "desc";
    updateSortButton();

    // 如果存储中没有提示词或为空数组，则写入默认示例
    if (
      !result.myPrompts ||
      !Array.isArray(result.myPrompts) ||
      result.myPrompts.length === 0
    ) {
      allPrompts = DEFAULT_PROMPTS.map((p, i) => ({
        ...p,
        createdAt: Date.now() - (DEFAULT_PROMPTS.length - i) * 60000,
      }));
      chrome.storage.local.set({ myPrompts: allPrompts }, () => {
        renderAll();
      });
    } else {
      // 数据迁移：为没有 createdAt 的旧数据补上时间戳
      allPrompts = result.myPrompts.map((p, i) => ({
        ...p,
        createdAt:
          p.createdAt || Date.now() - (result.myPrompts.length - i) * 60000,
      }));
      renderAll();
    }
  });

  // --- 3. 核心渲染与标签同步 ---
  function renderAll() {
    updateSidebarAndDropdown(); // 统一更新侧边栏和下拉框数据
    renderCards();
  }

  if (settingsBtn) {
    settingsBtn.onclick = () => {
      // 跳轉到 Chrome 官方快捷鍵設置頁面
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    };
  }

  // 排序按钮交互
  function updateSortButton() {
    if (!sortBtn) return;
    if (sortOrder === "desc") {
      sortBtn.textContent = "↓新";
      sortBtn.title = "最新优先";
    } else {
      sortBtn.textContent = "↑旧";
      sortBtn.title = "最早优先";
    }
  }

  if (sortBtn) {
    sortBtn.onclick = () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      updateSortButton();
      chrome.storage.local.set({ sortOrder });
      renderCards();
    };
  }

  /**
   * 更新侧边栏分类菜单和弹窗内的标签下拉列表
   */
  function updateSidebarAndDropdown() {
    // 提取所有唯一标签
    const tags = [
      ...new Set(
        allPrompts.map((p) => p.tag).filter((t) => t && t.trim() !== ""),
      ),
    ];

    // A. 更新弹窗内的自定义下拉框内容
    if (tags.length === 0) {
      tagDropdown.innerHTML =
        '<div style="padding: 10px; color: #94a3b8; font-size: 12px; text-align: center;">暂无已有标签</div>';
    } else {
      tagDropdown.innerHTML = tags
        .map(
          (tag) => `
                <div class="tag-option" style="padding: 10px 12px; cursor: pointer; font-size: 14px; color: #475569; transition: background 0.2s;">
                    ${tag}
                </div>
            `,
        )
        .join("");
    }

    // 为下拉选项绑定点击事件
    tagDropdown.querySelectorAll(".tag-option").forEach((option) => {
      option.onmousedown = (e) => {
        // 使用 onmousedown 确保在 onblur 之前触发
        tagInput.value = option.innerText.trim();
        tagDropdown.style.display = "none";
      };
      option.onmouseenter = () => (option.style.background = "#f1f5f9");
      option.onmouseleave = () => (option.style.background = "transparent");
    });

    // B. 更新左侧侧边栏菜单
    const currentFilter =
      document.querySelector(".nav-item.active")?.dataset.filter || "all";
    const existingLinks = navItemsContainer.querySelectorAll("a.nav-item");
    existingLinks.forEach((link) => link.remove());

    // 插入“全部”
    const allLink = createNavLink(
      "all",
      "全部提示词",
      allPrompts.length,
      currentFilter === "all",
    );
    navItemsContainer.insertBefore(
      allLink,
      document.getElementById("addTagBtn"),
    );

    // 插入动态标签
    tags.forEach((tag) => {
      const count = allPrompts.filter((p) => p.tag === tag).length;
      const tagLink = createNavLink(tag, tag, count, currentFilter === tag);
      navItemsContainer.insertBefore(
        tagLink,
        document.getElementById("addTagBtn"),
      );
    });

    // 重新绑定导航点击
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        document
          .querySelectorAll(".nav-item")
          .forEach((nav) => nav.classList.remove("active"));
        item.classList.add("active");
        renderCards();
      };
    });
  }

  function showToast(message = "已复制到剪贴板") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.style.display = "block";
    toast.style.opacity = "1";

    // 1.5秒后开始淡出
    setTimeout(() => {
      toast.style.opacity = "0";
      // 等动画结束后彻底隐藏，防止遮挡底层点击
      setTimeout(() => {
        toast.style.display = "none";
      }, 300);
    }, 1500);
  }

  // 1. 监听输入，控制清除按钮的显示/隐藏
  searchInput.addEventListener("input", () => {
    // 只有当有内容时才显示
    if (searchInput.value.trim().length > 0) {
      clearSearchBtn.style.display = "flex";
    } else {
      clearSearchBtn.style.display = "none";
    }
    renderCards();
  });

  searchInput.addEventListener("keydown", (e) => {
    // 同时也监听 Enter 和 Tab
    if (e.key === "Enter" || e.key === "Tab") {
      // 找到当前显示的第一个卡片
      const firstCard = document.querySelector(".card");
      if (firstCard) {
        firstCard.focus();
        // 阻止默认行为（防止在某些浏览器里触发其他动作）
        e.preventDefault();
      }
    }
  });

  // 2. 点击清除按钮的逻辑
  clearSearchBtn.onclick = () => {
    searchInput.value = ""; // 清空内容
    clearSearchBtn.style.display = "none"; // 隐藏自己
    searchInput.focus(); // 重新聚焦搜索框
    renderCards(); // 刷新列表显示全部
  };

  // 辅助：创建带计数的导航项
  function createNavLink(filter, text, count, isActive) {
    const a = document.createElement("a");
    a.href = "#";
    a.className = `nav-item ${isActive ? "active" : ""}`;
    a.dataset.filter = filter;
    a.style.display = "flex";
    a.style.alignItems = "center";
    a.style.justifyContent = "space-between";
    a.innerHTML = `<span>${text}</span><span style="font-size: 10px; opacity: 0.6; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 10px;">${count}</span>`;
    return a;
  }

  function renderCards() {
    const term = searchInput.value.toLowerCase().trim();
    const activeFilter =
      document.querySelector(".nav-item.active")?.dataset.filter || "all";

    cardGrid.innerHTML = "";
    const displayList = [...allPrompts]
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .sort((a, b) => {
        // 1. 置顶优先
        const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        // 2. 按创建时间排序
        return sortOrder === "desc"
          ? (b.createdAt || 0) - (a.createdAt || 0)
          : (a.createdAt || 0) - (b.createdAt || 0);
      });

    displayList.forEach((item, index) => {
      const matchesSearch =
        item.name.toLowerCase().includes(term) ||
        item.content.toLowerCase().includes(term);
      const matchesCategory =
        activeFilter === "all" || item.tag === activeFilter;

      if (matchesSearch && matchesCategory) {
        const card = document.createElement("div");
        card.className = "card";
        if (item.isPinned) {
          card.style.border = "2px solid #2563eb"; // 边框加粗到 2px
          card.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.15)"; // 增加一个淡淡的蓝色投影
          card.style.backgroundColor = "#f8faff"; // 给背景一个极淡的蓝色，与普通卡片区分
        }

        // --- 新增：让卡片可以被 Tab 键选中 ---
        card.tabIndex = 0;

        // 给卡片一个唯一的 ID，方便后续快速寻找
        card.dataset.index = index;

        // 原有的 onclick 逻辑保持不变...
        card.onclick = () => {
          /* 复制逻辑 */
        };

        // 在卡片的 onkeydown 中增加方向键支持
        card.onkeydown = (e) => {
          const cards = document.querySelectorAll(".card");
          const currentIndex = Array.from(cards).indexOf(card);

          if (e.key === "Enter") {
            card.click();
          } else if (e.key === "ArrowRight" || e.key === "Tab") {
            if (currentIndex < cards.length - 1) {
              cards[currentIndex + 1].focus();
              e.preventDefault();
            }
          } else if (e.key === "ArrowLeft") {
            if (currentIndex > 0) {
              cards[currentIndex - 1].focus();
              e.preventDefault();
            }
          }
        };

        card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <span class="card-tag">${item.tag || "默认"}</span>
                        <div style="display: flex; gap: 8px;">
                            <button class="pin-btn" data-index="${item.originalIndex}" style="border:none; background:none; cursor:pointer; color: ${item.isPinned ? "#2563eb" : "#94a3b8"};">📌</button>
                            <button class="edit-btn" data-index="${item.originalIndex}" style="border:none; background:none; cursor:pointer; color: #94a3b8;">✏️</button>
                            <button class="delete-btn" data-index="${item.originalIndex}" style="border:none; background:none; cursor:pointer; color: #94a3b8;">🗑️</button>
                        </div>
                    </div>
                    <div class="card-title">${item.name}</div>
                    <div class="card-body">${item.content}</div>
                `;

        card.onclick = (e) => {
          if (
            ["pin-btn", "edit-btn", "delete-btn"].some((cls) =>
              e.target.classList.contains(cls),
            )
          )
            return;
          navigator.clipboard.writeText(item.content).then(() => {
            card.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.2)";
            setTimeout(() => (card.style.boxShadow = ""), 500);
            showToast();

            // 可选：给卡片增加一个点击后的视觉闪烁反馈
            card.style.backgroundColor = "#e0f2fe";
            setTimeout(() => {
              card.style.backgroundColor = item.isPinned ? "#f0f7ff" : "white";
            }, 200);
          });
        };
        cardGrid.appendChild(card);
      }
    });
    attachDynamicEvents();
  }

  function attachDynamicEvents() {
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("确定删除此提示词吗？")) {
          allPrompts.splice(btn.dataset.index, 1);
          saveData();
        }
      };
    });
    document.querySelectorAll(".pin-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = btn.dataset.index;
        allPrompts[idx].isPinned = !allPrompts[idx].isPinned;
        saveData();
      };
    });
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        editingIndex = btn.dataset.index;
        const data = allPrompts[editingIndex];
        document.getElementById("newName").value = data.name;
        document.getElementById("newTag").value = data.tag;
        document.getElementById("newContent").value = data.content;
        modalTitle.innerText = "编辑提示词";
        modal.style.display = "flex";
      };
    });
  }

  // 定时记录窗口位置，防止异常关闭导致没记位
  function saveCurrentWindowPosition() {
    chrome.windows.getCurrent((win) => {
      // 只有在正常窗口状态下才记录（最大化或最小化时不记录坐标）
      if (win.state === "normal") {
        chrome.storage.local.set({
          lastWindowPos: {
            left: win.left,
            top: win.top,
            width: win.width,
            height: win.height,
          },
        });
      }
    });
  }

  // 监听窗口大小变动
  window.addEventListener("resize", saveCurrentWindowPosition);

  // 2. 新增：每 2 秒自動保存一次位置，確保拖動後也能被記錄
  setInterval(saveCurrentWindowPosition, 2000);

  // 也可以在初始化时跑一下，确保初始位置被记录
  saveCurrentWindowPosition();

  // popup.js
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "FOCUS_SEARCH") {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.focus();
        // 如果你希望唤醒时顺便清空之前的搜索内容，可以加上下面这句：
        // searchInput.value = '';
        // renderCards();
      }
    }
  });

  // --- 4. 数据操作 ---
  function saveData() {
    chrome.storage.local.set({ myPrompts: allPrompts }, () => renderAll());
  }

  saveBtn.onclick = () => {
    const name = document.getElementById("newName").value.trim();
    const tag = document.getElementById("newTag").value.trim();
    const content = document.getElementById("newContent").value.trim();

    if (!name || !content) return alert("名称和内容不能为空");

    if (editingIndex !== null) {
      allPrompts[editingIndex] = {
        ...allPrompts[editingIndex],
        name,
        tag,
        content,
      };
    } else {
      allPrompts.push({ name, tag, content, isPinned: false, createdAt: Date.now() });
    }

    modal.style.display = "none";
    saveData();
    resetForm();
  };

  function resetForm() {
    editingIndex = null;
    document.getElementById("newName").value = "";
    document.getElementById("newTag").value = "";
    document.getElementById("newContent").value = "";
    modalTitle.innerText = "新增提示词";
  }

  // --- 5. 下拉列表交互 ---
  tagInput.onfocus = () => {
    updateSidebarAndDropdown(); // 展开前确保数据最新
    tagDropdown.style.display = "block";
  };

  tagInput.onblur = () => {
    // 延迟隐藏，给点击选项留出时间
    setTimeout(() => {
      tagDropdown.style.display = "none";
    }, 200);
  };

  // --- 6. 基础 UI 事件 ---
  addBtn.onclick = () => {
    resetForm();
    modal.style.display = "flex";
  };
  cancelBtn.onclick = () => (modal.style.display = "none");
  searchInput.oninput = renderCards;

  exportBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(allPrompts, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prompts_backup.json`;
    a.click();
  };

  importBtn.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        allPrompts = JSON.parse(ev.target.result);
        saveData();
      } catch (err) {
        alert("文件解析失败");
      }
    };
    reader.readAsText(file);
  };

  // 当页面内容加载完毕后，强制搜索框获得焦点
  window.addEventListener("load", () => {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.focus();
    }
  });
});
