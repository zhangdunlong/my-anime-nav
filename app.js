
// ===== 站点图标（favicon）配置 =====
// 留空（默认）：直接使用目标站点自身的 /favicon.ico，不依赖任何第三方服务。
// 如果你自建了 favicon 反向代理，按模板填进来即可，例如：
//   var FAVICON_PROXY = 'https://favicon.example.com/s2/favicons?domain={domain}&sz={size}';
var FAVICON_PROXY = '';

// ===== 站点数据（示例）=====
// 下面是仅用于演示的示例数据，请替换成你自己的收藏。
// 结构：{ 分类名: [ { name, url, desc } ] }
var SITES_DATA = {
  "⭐ 常用": [
    {"name":"GitHub","url":"https://github.com","desc":"全球最大的代码托管与协作平台"},
    {"name":"MDN Web Docs","url":"https://developer.mozilla.org","desc":"Web 标准与浏览器 API 权威文档"},
    {"name":"Cloudflare Dashboard","url":"https://dash.cloudflare.com","desc":"域名、DNS 与边缘网络控制台"},
    {"name":"DeepSeek","url":"https://www.deepseek.com","desc":"深度求索 · AI 对话与开放平台"},
    {"name":"Stack Overflow","url":"https://stackoverflow.com","desc":"全球程序员问答社区"}
  ],
  "开发工具": [
    {"name":"Visual Studio Code","url":"https://code.visualstudio.com","desc":"微软开源的跨平台代码编辑器"},
    {"name":"npm","url":"https://www.npmjs.com","desc":"JavaScript 包管理器与包仓库"},
    {"name":"Docker Hub","url":"https://hub.docker.com","desc":"容器镜像仓库"},
    {"name":"DevDocs","url":"https://devdocs.io","desc":"聚合式 API 文档速查工具"},
    {"name":"Can I use","url":"https://caniuse.com","desc":"浏览器特性兼容性查询"}
  ],
  "设计资源": [
    {"name":"Figma","url":"https://www.figma.com","desc":"在线协作界面设计工具"},
    {"name":"Dribbble","url":"https://dribbble.com","desc":"设计师作品社区"},
    {"name":"Google Fonts","url":"https://fonts.google.com","desc":"免费开源字体库"},
    {"name":"Unsplash","url":"https://unsplash.com","desc":"免费高清图片素材"},
    {"name":"Iconify","url":"https://icon-sets.iconify.design","desc":"海量开源图标集合"}
  ],
  "学习平台": [
    {"name":"中国大学 MOOC","url":"https://www.icourse163.org","desc":"国家精品课程在线学习平台"},
    {"name":"菜鸟教程","url":"https://www.runoob.com","desc":"编程入门教程"},
    {"name":"freeCodeCamp","url":"https://www.freecodecamp.org","desc":"免费编程学习社区"},
    {"name":"Coursera","url":"https://www.coursera.org","desc":"全球名校在线课程"},
    {"name":"廖雪峰的官方网站","url":"https://liaoxuefeng.com","desc":"Python / Java / Git 中文教程"}
  ],
  "新闻资讯": [
    {"name":"Hacker News","url":"https://news.ycombinator.com","desc":"技术创业资讯社区"},
    {"name":"少数派","url":"https://sspai.com","desc":"高效工作与数字生活"},
    {"name":"36氪","url":"https://36kr.com","desc":"科技商业资讯"},
    {"name":"阮一峰的网络日志","url":"https://www.ruanyifeng.com/blog","desc":"技术随笔与科技周刊"},
    {"name":"掘金","url":"https://juejin.cn","desc":"面向开发者的中文技术社区"}
  ],
  "在线工具": [
    {"name":"JSON 在线解析","url":"https://www.json.cn","desc":"JSON 格式化与校验"},
    {"name":"regex101","url":"https://regex101.com","desc":"正则表达式在线调试"},
    {"name":"TinyPNG","url":"https://tinypng.com","desc":"图片无损压缩"},
    {"name":"Carbon","url":"https://carbon.now.sh","desc":"代码截图美化"},
    {"name":"Excalidraw","url":"https://excalidraw.com","desc":"手绘风格白板绘图"}
  ]
};

// ===== 渲染引擎 =====
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function render() {
  var categories = Object.keys(SITES_DATA);
  var totalSites = 0;
  
  // 渲染侧边栏
  var menuHtml = '<ul class="sidebar-menu">';
  categories.forEach(function(cat, i) {
    menuHtml += '<li data-action="scrollToCategory" data-idx="' + i + '"><span class="menu-icon">📂</span>' + escapeHtml(cat) + '</li>';
  });
  menuHtml += '</ul>';
  document.getElementById('sidebarMenu').innerHTML = menuHtml;
  
  // 渲染主内容
  var contentHtml = '';
  categories.forEach(function(cat, ci) {
    var sites = SITES_DATA[cat];
    if (!sites || !sites.length) return;
    totalSites += sites.length;
    
    contentHtml += '<section class="category-section" id="cat-' + ci + '">';
    contentHtml += '<h2 class="category-title"><span class="tag-icon">🏷</span>' + escapeHtml(cat) + '</h2>';
    contentHtml += '<div class="sites-grid">';
    
    sites.forEach(function(site, si) {
      var delay = (ci * 30 + si) * 0.02;
      var domain = '';
      try { domain = (new URL(site.url)).hostname; } catch(e) {}
      var favicon = getFaviconUrl(site.url, 64);
      var adminAttr = _isAdmin ? ' data-admin-cat="' + escapeHtml(cat) + '" data-admin-idx="' + si + '"' : '';
      var catEnc = encodeURIComponent(cat);
      
      contentHtml += (_isAdmin
        ? '<div class="site-card admin-mode"' + adminAttr + ' style="position:relative;border:1px dashed #d8b4fe;border-radius:12px;padding:8px 12px;cursor:pointer;animation-delay:' + delay + 's">'
        : '<a class="site-card" href="' + escapeHtml(site.url) + '" target="_blank" style="animation-delay:' + delay + 's">'
      ) +
        '<img class="site-icon" loading="lazy" src="' + favicon + '" onerror="this.onerror=null;this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2280%22%3E%F0%9F%8C%90%3C/text%3E%3C/svg%3E\';" alt="">' +
        '<div class="site-info">' +
        '<div class="site-name">' + escapeHtml(site.name) + '</div>' +
        '<div class="site-desc">' + escapeHtml(site.desc) + '</div>' +
        '</div>' +
        '<span class="site-arrow">›</span>' +
        (_isAdmin
          ? '<div class="admin-card-actions" style="position:absolute;top:4px;right:4px;display:flex;gap:4px;align-items:center;">' +
            '<a href="' + escapeHtml(site.url) + '" target="_blank" data-action="linkClick" style="color:#a855c7;text-decoration:none;font-size:12px;padding:2px 4px;">🔗</a>' +
            '<span data-action="startMainInlineEdit" data-ci="' + ci + '" data-si="' + si + '" style="background:#ec4899;color:#fff;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;">✏️</span>' +
            '<span data-action="delSiteMain" data-cat="' + catEnc + '" data-idx="' + si + '" style="background:#ef4444;color:#fff;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;">🗑️</span>' +
          '</div>'
          : ''
        ) +
        (_isAdmin ? '</div>' : '</a>');
    });
    
    contentHtml += '</div></section>';
  });
  
  document.getElementById('contentArea').innerHTML = contentHtml;
  document.getElementById('headerSubtitle').textContent = '共 ' + categories.length + ' 个分类，' + totalSites + ' 个站点';
  
  // 隐藏加载动画
  setTimeout(function() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }, 300);
}

// ===== 滚动到分类 =====
function scrollToCategory(index) {
  var el = document.getElementById('cat-' + index);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // 移动端关闭侧边栏
  document.getElementById('sidebar').classList.remove('open');
}

// ===== 主页内联编辑（登录后的主页卡片）=====
function startMainInlineEdit(cardEl, catIdx, siteIdx) {
  var cat = Object.keys(SITES_DATA)[catIdx];
  if (!cat) return;
  var site = SITES_DATA[cat] && SITES_DATA[cat][siteIdx];
  if (!site || cardEl.querySelector('.inline-edit-form')) return;
  // 替换卡片内容为编辑表单
  var origHtml = cardEl.innerHTML;
  cardEl.innerHTML =
    '<div class="inline-edit-form" style="padding:6px;display:flex;flex-direction:column;gap:6px;">' +
      '<input id="mie_name" value="' + escapeHtml(site.name) + '" placeholder="名称" style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;outline:none;box-sizing:border-box;width:100%;">' +
      '<input id="mie_desc" value="' + escapeHtml(site.desc || '') + '" placeholder="描述" style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;outline:none;box-sizing:border-box;width:100%;">' +
      '<input id="mie_url" value="' + escapeHtml(site.url) + '" placeholder="网址" style="padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;outline:none;box-sizing:border-box;width:100%;">' +
      '<div style="display:flex;gap:6px;justify-content:flex-end;">' +
        '<button data-action="saveMainInlineEdit" data-cat-idx="' + catIdx + '" data-site-idx="' + siteIdx + '" style="padding:4px 12px;border:none;border-radius:6px;background:linear-gradient(135deg,#ec4899,#a855c7);color:#fff;cursor:pointer;font-size:11px;">💾 保存</button>' +
        '<button data-action="cancelMainInlineEdit" data-cat-idx="' + catIdx + '" data-site-idx="' + siteIdx + '" style="padding:4px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#666;cursor:pointer;font-size:11px;">✕</button>' +
      '</div>' +
    '</div>';
}

function saveMainInlineEdit(btn, catIdx, siteIdx) {
  var cat = Object.keys(SITES_DATA)[catIdx];
  if (!cat) return;
  var data = loadAdminSites();
  var adminSite = data[cat] && data[cat][siteIdx];
  if (!adminSite) return;
  var name = (document.getElementById('mie_name') && document.getElementById('mie_name').value.trim()) || '';
  var desc = (document.getElementById('mie_desc') && document.getElementById('mie_desc').value.trim()) || '';
  var url = (document.getElementById('mie_url') && document.getElementById('mie_url').value.trim()) || '';
  if (!url) { alert('网址不能为空'); return; }
  if (!/^https?:\/\//i.test(url)) { alert('URL必须以 http:// 或 https:// 开头'); return; }
  adminSite.name = name || url;
  adminSite.desc = desc;
  adminSite.url = url;
  saveAdminSites(data);
  mergeToRender();
  render();
  showToast('✅ 已保存');
}

function cancelMainInlineEdit(btn, catIdx, siteIdx) {
  mergeToRender();
  render();
}

// ===== 搜索 =====
var _searchDebounce = null;
var _searchResults = null;
var _searchMode = 'local'; // 'local' | 'google'

// 切换搜索模式
function switchSearchMode(mode) {
  _searchMode = mode;
  document.getElementById('tabLocal').classList.toggle('active', mode === 'local');
  document.getElementById('tabGoogle').classList.toggle('active', mode === 'google');
  var input = document.getElementById('searchInput');
  if (mode === 'local') {
    input.placeholder = '搜索本站书签... (Ctrl+K)';
    localSearch();
  } else {
    input.placeholder = '输入关键词，按 Enter 用 Google 搜索... (Ctrl+K)';
    closeSearchResults();
  }
  input.focus();
}

function closeSearchResults() {
  if (_searchResults) { _searchResults.remove(); _searchResults = null; }
}

// 搜索框 Enter 键处理
function onSearchKeyDown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (_searchMode === 'google') {
    doSearch();
    return;
  }
  // local 模式：有结果就打开第一个，没有就回退到 Google
  if (_searchResults && _searchResults.querySelector('a')) {
    _searchResults.querySelector('a').click();
  } else {
    doSearch();
  }
}

// 搜索按钮点击
function onSearchButtonClick() {
  var q = document.getElementById('searchInput').value.trim();
  if (!q) { document.getElementById('searchInput').focus(); return; }
  if (_searchMode === 'google') {
    doSearch();
    return;
  }
  // local 模式：有结果打开第一个，没有回退 Google
  if (_searchResults && _searchResults.querySelector('a')) {
    _searchResults.querySelector('a').click();
  } else {
    doSearch();
  }
}

function doSearch() {
  var q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
}

// 本地站点搜索（输入时实时过滤）
function localSearch() {
  var q = document.getElementById('searchInput').value.trim().toLowerCase();
  // 移除旧的结果区
  if (_searchResults) { _searchResults.remove(); _searchResults = null; }
  if (!q || q.length < 1) return;

  var matches = [];
  var cats = Object.keys(SITES_DATA);
  for (var ci = 0; ci < cats.length; ci++) {
    var sites = SITES_DATA[cats[ci]];
    if (!sites) continue;
    for (var si = 0; si < sites.length; si++) {
      var s = sites[si];
      if (s.name.toLowerCase().indexOf(q) >= 0 || (s.desc || '').toLowerCase().indexOf(q) >= 0 || s.url.toLowerCase().indexOf(q) >= 0) {
        matches.push({ cat: cats[ci], ci: ci, si: si, site: s });
        if (matches.length >= 20) break;
      }
    }
    if (matches.length >= 20) break;
  }

  // 创建搜索结果浮层
  _searchResults = document.createElement('div');
  _searchResults.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#fff;border-radius:0 0 16px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.15);max-height:400px;overflow-y:auto;z-index:200;';
  
  if (matches.length === 0) {
    // 无匹配结果提示
    var emptyItem = document.createElement('div');
    emptyItem.style.cssText = 'padding:16px;text-align:center;font-size:13px;color:#999;';
    emptyItem.innerHTML = '本站未找到 <b style="color:#666;">' + escapeHtml(document.getElementById('searchInput').value.trim()) + '</b><br>按 Enter 用 Google 搜索';
    _searchResults.appendChild(emptyItem);
  } else {
    matches.forEach(function(m) {
      var item = document.createElement('a');
      item.href = m.site.url;
      item.target = '_blank';
      item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #f3f4f6;text-decoration:none;color:#333;transition:background 0.15s;';
      item.onmouseenter = function() { this.style.background = '#fdf2f8'; };
      item.onmouseleave = function() { this.style.background = ''; };
      
      var domain = '';
      try { domain = new URL(m.site.url).hostname; } catch(e) {}
      
      item.innerHTML =
        '<img src="' + getFaviconUrl(m.site.url, 32) + '" style="width:24px;height:24px;border-radius:4px;flex-shrink:0;" loading="lazy">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(m.site.name) + '</div>' +
          '<div style="font-size:11px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(m.cat) + ' · ' + escapeHtml(m.site.desc || '') + '</div>' +
        '</div>';
      _searchResults.appendChild(item);
    });

    // 底部提示
    var hint = document.createElement('div');
    hint.style.cssText = 'padding:8px 16px;text-align:center;font-size:12px;color:#bbb;border-top:1px solid #f3f4f6;';
    hint.textContent = '按 Enter 打开第一个结果';
    _searchResults.appendChild(hint);
  }

  var searchBox = document.querySelector('.search-box');
  searchBox.style.position = 'relative';
  searchBox.appendChild(_searchResults);
}

// 点击外部关闭搜索结果
document.addEventListener('click', function(e) {
  if (_searchResults && !e.target.closest('.search-box')) {
    _searchResults.remove();
    _searchResults = null;
  }
});

// ===== 移动端侧边栏切换 =====
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ===== 回到顶部按钮 =====
window.addEventListener('scroll', function() {
  var btn = document.getElementById('backToTop');
  if (window.scrollY > 300) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
});

// ===== Ctrl+K 快捷键聚焦搜索 =====
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    var input = document.getElementById('searchInput');
    if (input) { input.focus(); input.select(); }
  }
  if (e.key === 'Escape') {
    if (_searchResults) { _searchResults.remove(); _searchResults = null; }
    var input = document.getElementById('searchInput');
    if (input) input.blur();
  }
});

// ===== 后台管理 =====
var ADMIN_STORAGE_KEY = 'anime_nav_sites_v2';
var ADMIN_TOKEN_KEY = 'anime_nav_token';
var ADMIN_CAT_ORDER_KEY = 'anime_nav_cat_order';
var _isAdmin = false; // 是否已登录（控制主页是否显示编辑按钮）

// ===== 云端 API 地址（必须在启动代码前定义）=====
var CLOUD_API = '/api/data';

// ===== 启动 =====
// 图标兜底：站点没有 /favicon.ico（或返回的不是图片）时，统一换成站点自己的默认图标。
// 用捕获阶段的 error 事件委托实现，避免内联 onerror 被 CSP 拦掉。
document.addEventListener('error', function (e) {
  var t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && !t.dataset.fb) {
    t.dataset.fb = '1';
    t.src = 'assets/images/favicon.svg';
  }
}, true);

// 先用本地/默认数据渲染（秒开），然后异步从云端拉取更新
mergeToRender();
render();
syncFromCloud();

// ===== 认证：token-based（密码不在前端存储） =====

// --- Login ---
function showLogin() {
  document.getElementById('loginModal').style.display = 'flex';
  document.getElementById('adminPwd').value = '';
  document.getElementById('loginError').style.display = 'none';
  setTimeout(function() { document.getElementById('adminPwd').focus(); }, 100);
}
function closeLogin() {
  document.getElementById('loginModal').style.display = 'none';
}
function togglePwdVisibility() {
  var input = document.getElementById('adminPwd');
  var toggle = document.getElementById('pwdToggle');
  if (input.type === 'password') {
    input.type = 'text';
    toggle.textContent = '🙈';
  } else {
    input.type = 'password';
    toggle.textContent = '👁️';
  }
}
function doLogin(btn) {
  var password = document.getElementById('adminPwd').value;
  if (!password) {
    document.getElementById('loginError').style.display = 'block';
    return;
  }
  if (btn) { btn.textContent = '登录中...'; btn.disabled = true; }

  fetch(CLOUD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', password: password })
  }).then(function(r) { return r.json(); }).then(function(resp) {
    if (btn) { btn.textContent = '登录'; btn.disabled = false; }
    if (resp.success && resp.token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, resp.token);
      document.getElementById('adminPwd').value = '';
      closeLogin();
      _isAdmin = true;
      refreshAdminMode();
    } else {
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginError').textContent = resp.error || '登录失败';
    }
  }).catch(function() {
    if (btn) { btn.textContent = '登录'; btn.disabled = false; }
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginError').textContent = '网络错误，请重试';
  });
}

// 登录后切换管理模式（不打开弹窗，直接在主页编辑）
function refreshAdminMode() {
  var entryBtn = document.getElementById('adminEntryBtn');
  var advBtn = document.getElementById('advancedAdminBtn');
  if (_isAdmin) {
    entryBtn.textContent = '🔓 退出管理';
    advBtn.style.display = '';
  } else {
    entryBtn.textContent = '⚙️ 管理';
    advBtn.style.display = 'none';
  }
  mergeToRender();
  render();
  showToast(_isAdmin ? '🔓 管理模式已开启，点击卡片即可编辑' : '🔒 已退出管理');
}

function toggleAdminMode() {
  if (_isAdmin) {
    // 退出管理 → 销毁 token
    var token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      // 异步通知后端销毁 session（不阻塞 UI）
      fetch(CLOUD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', token: token })
      }).catch(function() {});
    }
    _isAdmin = false;
  } else {
    showLogin();
    return;
  }
  refreshAdminMode();
}

// --- Data layer: stores per-category objects ---
function loadAdminSites() {
  try {
    var stored = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch(e) {}
  // Default: flatten SITES_DATA into category object
  return flattenToCategories(SITES_DATA);
}
function saveAdminSites(data) {
  try {
    // 自动备份旧数据，防止意外丢失
    var current = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (current) {
      localStorage.setItem(ADMIN_STORAGE_KEY + '_backup', current);
    }
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data));
    // 推送至云端（异步，不影响本地保存）
    syncToCloud(data);
  } catch(e) {}
}
function restoreFromBackup() {
  var backup = localStorage.getItem(ADMIN_STORAGE_KEY + '_backup');
  if (!backup) {
    alert('没有可用的备份数据');
    return;
  }
  if (!confirm('确定从备份恢复？当前数据将被覆盖。')) return;
  try {
    var parsed = JSON.parse(backup);
    if (parsed && typeof parsed === 'object') {
      localStorage.setItem(ADMIN_STORAGE_KEY, backup);
      showToast('✅ 已从备份恢复');
      renderAdminTable();
      renderCategoryManager();
    } else {
      alert('备份数据格式异常');
    }
  } catch(e) {
    alert('恢复失败：备份数据损坏');
  }
}

// --- 导出/导入/重置数据 ---
function exportData() {
  var data = loadAdminSites();
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'nav_backup_' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 备份已下载');
}
function importData(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var parsed = JSON.parse(e.target.result);
      if (parsed && typeof parsed === 'object') {
        // 安全检查：校验所有URL不包含危险协议
        var hasDanger = false;
        for (var cat in parsed) {
          if (Array.isArray(parsed[cat])) {
            parsed[cat].forEach(function(s) {
              if (s.url && !/^https?:\/\//i.test(s.url)) hasDanger = true;
              if (s.img && s.img !== '' && !/^https?:\/\//i.test(s.img) && s.img.indexOf('data:image/') !== 0) hasDanger = true;
            });
          }
        }
        if (hasDanger) {
          alert('导入失败：数据中包含不安全的URL');
          return;
        }
        if (!confirm('导入将覆盖当前所有数据，确定继续？')) return;
        saveAdminSites(parsed);
        showToast('📤 导入成功');
        renderAdminTable();
        renderCategoryManager();
      } else {
        alert('文件格式不正确');
      }
    } catch(err) {
      alert('JSON解析失败：' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
function resetData() {
  if (!confirm('⚠️ 确定重置所有数据？自定义的站点、分类、密码都将丢失！')) return;
  if (!confirm('再次确认：此操作不可撤销！')) return;
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  localStorage.removeItem(ADMIN_CAT_ORDER_KEY);
  localStorage.removeItem(ADMIN_STORAGE_KEY + '_backup');
  showToast('🔄 已重置为默认数据');
  mergeToRender();
  render();
  if (document.getElementById('adminPanel').style.display === 'block') {
    renderAdminTable();
    renderCategoryManager();
  }
}
function flattenToCategories(obj) {
  var result = {};
  for (var cat in obj) {
    result[cat] = obj[cat].map(function(s) {
      return { name: s.name, url: s.url, desc: s.desc || s.name, img: '', customImg: false };
    });
  }
  return result;
}

// --- Merge localStorage data back into SITES_DATA for rendering ---
function mergeToRender() {
  var adminData = loadAdminSites();
  var catOrder = getCategoryOrder();
  var merged = {};
  var cats = catOrder || Object.keys(adminData);
  // Add missing categories
  Object.keys(adminData).forEach(function(c) {
    if (cats.indexOf(c) === -1) cats.push(c);
  });
  cats.forEach(function(cat) {
    if (adminData[cat] && adminData[cat].length > 0) {
      merged[cat] = adminData[cat].map(function(s) {
        return { name: s.name, url: s.url, desc: s.desc || s.name };
      });
    }
  });
  // Update global SITES_DATA for render()
  SITES_DATA = merged;
}

// --- Category order ---
function getCategoryOrder() {
  try {
    var order = localStorage.getItem(ADMIN_CAT_ORDER_KEY);
    if (order) return JSON.parse(order);
  } catch(e) {}
  return null;
}
function saveCategoryOrder(order) {
  localStorage.setItem(ADMIN_CAT_ORDER_KEY, JSON.stringify(order));
}

// --- Admin Panel ---
function showAdminTab(tab) {
  document.getElementById('adminSitesSection').style.display = tab === 'sites' ? 'block' : 'none';
  document.getElementById('adminCategoriesSection').style.display = tab === 'categories' ? 'block' : 'none';
  document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.textContent.includes(tab === 'sites' ? '网站' : '分类'));
  });
}
function openAdmin() {
  document.getElementById('adminPanel').style.display = 'block';
  refreshAdminView();
  renderCategoryManager();
  // 打开后台时自动从云端拉取最新数据
  syncFromCloud();
}
function closeAdmin() {
  document.getElementById('adminPanel').style.display = 'none';
  // 关闭详细面板后保持管理模式
  if (_isAdmin) {
    refreshAdminMode(); // 刷新主页，显示编辑控件
  } else {
    mergeToRender();
    render();
  }
}

// --- 管理视图切换（表格/卡片）---
var _adminViewMode = 'table'; // 'table' | 'card'

function toggleAdminView() {
  var btn = document.getElementById('viewToggleBtn');
  if (_adminViewMode === 'table') {
    _adminViewMode = 'card';
    btn.textContent = '📋 表格模式';
  } else {
    _adminViewMode = 'table';
    btn.textContent = '📇 卡片模式';
  }
  refreshAdminView();
}

function refreshAdminView() {
  if (_adminViewMode === 'table') {
    document.getElementById('adminTableView').style.display = '';
    document.getElementById('adminCardView').style.display = 'none';
    renderAdminTable();
  } else {
    document.getElementById('adminTableView').style.display = 'none';
    document.getElementById('adminCardView').style.display = '';
    renderAdminCards();
  }
}

// --- 卡片模式渲染（含拖拽排序） ---
var _dragSiteData = null;

function renderAdminCards() {
  var data = loadAdminSites();
  var kw = (document.getElementById('adminSearch').value || '').trim().toLowerCase();
  var catOrder = getCategoryOrder() || Object.keys(data);
  var allCats = Object.keys(data);
  allCats.forEach(function(c) { if (catOrder.indexOf(c) === -1) catOrder.push(c); });

  var grid = document.getElementById('adminCardGrid');
  var html = '';
  var hasAny = false;
  // 用自增ID追踪每个卡片
  var cardId = 0;

  catOrder.forEach(function(cat) {
    var sites = data[cat];
    if (!sites || !sites.length) return;
    // 分类标题（不可拖拽）
    html += '<div class="cat-header" style="grid-column:1/-1;font-size:14px;font-weight:700;color:#7c3aed;padding:8px 4px 0;border-top:2px solid #f3e8ff;margin-top:8px;">📁 ' + esc(cat) + ' (' + sites.length + ')</div>';
    sites.forEach(function(s, idx) {
      if (kw && !(s.name.toLowerCase().includes(kw) || s.url.toLowerCase().includes(kw))) return;
      hasAny = true;
      var favicon = getFaviconUrl(s.url);
      var iconSrc = esc(s.img || favicon);
      var cid = 'sc-' + (cardId++);
      html += '<div id="' + cid + '" data-card-cat="' + esc(cat) + '" data-card-idx="' + idx + '" style="background:#fff;border:1px solid #f3f4f6;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);transition:box-shadow 0.2s,opacity 0.2s;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<img src="' + iconSrc + '" style="width:36px;height:36px;border-radius:8px;object-fit:contain;background:#f9fafb;flex-shrink:0;" onerror="this.src=\'' + esc(favicon) + '\'">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + esc(s.name) + '">' + esc(s.name) + '</div>' +
            (s.desc ? '<div style="font-size:11px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">' + esc(s.desc) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div style="font-size:11px;color:#ec4899;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><a href="' + esc(s.url) + '" target="_blank" style="color:#a855c7;">' + esc(s.url.substring(0, 60)) + (s.url.length > 60 ? '...' : '') + '</a></div>' +
        '<div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid #f3f4f6;padding-top:8px;">' +
          '<button data-action="openEdit" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" style="padding:5px 12px;border:none;border-radius:6px;background:#ec4899;color:#fff;cursor:pointer;font-size:11px;">✏️ 编辑</button>' +
          '<button data-action="delSite" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" style="padding:5px 12px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-size:11px;">🗑️ 删除</button>' +
          '<button data-action="moveSite" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" data-dir="-1" style="padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#666;cursor:pointer;font-size:12px;">↑</button>' +
          '<button data-action="moveSite" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" data-dir="1" style="padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#666;cursor:pointer;font-size:12px;">↓</button>' +
        '</div></div>';
    });
  });

  if (!hasAny) {
    html = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9ca3af;font-size:14px;">' + (kw ? '未找到匹配的网站' : '暂无站点') + '</div>';
  }
  grid.innerHTML = html;

  // 卡片点击 → 内联编辑
  grid.querySelectorAll('[data-card-cat]').forEach(function(card) {
    if (card.classList.contains('cat-header')) return;
    card.addEventListener('click', function(e) {
      if (e.target.closest('button') || e.target.closest('a')) return;
      if (card.querySelector('input')) return;
      startInlineEdit(card);
    });
  });
}

var _dragSiteData = null;
var _editingOrigData = null;

function startInlineEdit(card) {
  if (_editingOrigData) cancelInlineEdit(card);
  var cat = card.dataset.cardCat;
  var idx = parseInt(card.dataset.cardIdx);
  var data = loadAdminSites();
  var site = data[cat] && data[cat][idx];
  if (!site) return;
  _editingOrigData = { cat: cat, idx: idx, name: site.name, url: site.url, desc: site.desc || '' };
  // 替换卡片内容为内联编辑表单
  card.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">' +
      '<img src="' + esc(site.img || getFaviconUrl(site.url)) + '" style="width:32px;height:32px;border-radius:6px;object-fit:contain;" onerror="this.style.display=\'none\'">' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:4px;">' +
        '<input id="ie_name" value="' + esc(site.name) + '" placeholder="名称" style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;outline:none;">' +
        '<input id="ie_desc" value="' + esc(site.desc || '') + '" placeholder="描述" style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;outline:none;">' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;align-items:center;">' +
      '<span style="font-size:11px;color:#999;flex-shrink:0;">🔗</span>' +
      '<input id="ie_url" value="' + esc(site.url) + '" style="flex:1;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:11px;outline:none;">' +
    '</div>' +
    '<div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid #f3f4f6;padding-top:8px;">' +
      '<button data-action="saveInlineEdit" style="padding:5px 14px;border:none;border-radius:6px;background:linear-gradient(135deg,#ec4899,#a855c7);color:#fff;cursor:pointer;font-size:11px;">💾 保存</button>' +
      '<button data-action="cancelInlineEdit" style="padding:5px 14px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#666;cursor:pointer;font-size:11px;">✕ 取消</button>' +
    '</div>';
  card.draggable = false;
  // 聚焦名称输入
  setTimeout(function() { document.getElementById('ie_name') && document.getElementById('ie_name').focus(); }, 50);
}

function saveInlineEdit(btn) {
  var card = btn.closest('[data-card-cat]');
  if (!card || !_editingOrigData) return;
  var cat = _editingOrigData.cat;
  var idx = _editingOrigData.idx;
  var data = loadAdminSites();
  var site = data[cat] && data[cat][idx];
  if (!site) return;
  var name = (document.getElementById('ie_name') && document.getElementById('ie_name').value.trim()) || '';
  var desc = (document.getElementById('ie_desc') && document.getElementById('ie_desc').value.trim()) || '';
  var url = (document.getElementById('ie_url') && document.getElementById('ie_url').value.trim()) || '';
  if (!url) { alert('网址不能为空'); return; }
  if (!/^https?:\/\//i.test(url)) { alert('URL必须以 http:// 或 https:// 开头'); return; }
  var changed = (name !== site.name || desc !== (site.desc || '') || url !== site.url);
  if (changed) {
    site.name = name || url;
    site.desc = desc;
    site.url = url;
    saveAdminSites(data);
    showToast('✅ 已保存');
  }
  _editingOrigData = null;
  renderAdminCards();
}

function cancelInlineEdit(btn) {
  _editingOrigData = null;
  renderAdminCards();
}

function onSiteDragStart(e) {
  _dragSiteData = { cat: this.dataset.cardCat, idx: parseInt(this.dataset.cardIdx) };
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}
function onSiteDragOver(e) {
  e.preventDefault();
  this.style.boxShadow = '0 0 0 2px #a855c7';
}
function onSiteDrop(e) {
  e.preventDefault();
  this.style.boxShadow = '';
  if (!_dragSiteData) return;
  var toCat = this.dataset.cardCat;
  var toIdx = parseInt(this.dataset.cardIdx);
  if (_dragSiteData.cat === toCat && _dragSiteData.idx === toIdx) return;
  var data = loadAdminSites();
  // 从原位置移除
  var fromCat = _dragSiteData.cat;
  var fromIdx = _dragSiteData.idx;
  if (!data[fromCat] || !data[toCat]) return;
  var item = data[fromCat].splice(fromIdx, 1)[0];
  if (!item) return;
  // 计算目标索引（如果拖拽到原分类后面的位置，删除已导致后续索引-1）
  var targetIdx = toIdx;
  if (fromCat === toCat && fromIdx < toIdx) targetIdx--;
  // 插入到目标位置
  data[toCat].splice(targetIdx, 0, item);
  // 清理空分类
  if (data[fromCat].length === 0) delete data[fromCat];
  saveAdminSites(data);
  renderAdminCards();
  showToast('排序已更新');
}
function onSiteDragEnd(e) {
  this.style.opacity = '';
  document.querySelectorAll('#adminCardGrid [draggable="true"]').forEach(function(el) {
    el.style.boxShadow = '';
  });
  _dragSiteData = null;
}

// --- Render table grouped by category ---
function renderAdminTable(filter) {
  // 卡片模式下重定向到卡片渲染
  if (_adminViewMode === 'card') { renderAdminCards(); return; }
  var data = loadAdminSites();
  var kw = (filter || document.getElementById('adminSearch').value || '').trim().toLowerCase();
  
  // Determine category order
  var catOrder = getCategoryOrder() || Object.keys(data);
  var allCats = Object.keys(data);
  allCats.forEach(function(c) { if (catOrder.indexOf(c) === -1) catOrder.push(c); });
  
  var tbody = document.getElementById('adminTableBody');
  var hasAny = false;
  var html = '';
  
  catOrder.forEach(function(cat) {
    var sites = data[cat];
    if (!sites || !sites.length) return;
    
    // Category header row
    html += '<tr style="background:#f3e8ff;"><td colspan="5" style="padding:8px 10px;font-weight:700;color:#7c3aed;">📁 ' + esc(cat) + ' (' + sites.length + ')</td></tr>';
    
    sites.forEach(function(s, idx) {
      if (kw && !(s.name.toLowerCase().includes(kw) || s.url.toLowerCase().includes(kw))) return;
      hasAny = true;
      var favicon = getFaviconUrl(s.url);
      html += '<tr style="border-bottom:1px solid #f3f4f6;">' +
        '<td style="padding:8px 10px;color:#9ca3af;font-size:11px;">' + (idx+1) + '</td>' +
        '<td style="padding:8px 10px;width:32px;"><img src="' + esc(s.img || favicon) + '" style="width:24px;height:24px;border-radius:4px;object-fit:cover;" onerror="this.src=\'' + esc(favicon) + '\'"></td>' +
        '<td style="padding:8px 10px;"><strong>' + esc(s.name) + '</strong></td>' +
        '<td style="padding:8px 10px;"><a href="' + esc(s.url) + '" target="_blank" style="color:#ec4899;font-size:11px;">' + esc(s.url.substring(0, 50)) + (s.url.length > 50 ? '...' : '') + '</a></td>' +
        '<td style="padding:8px 10px;text-align:center;white-space:nowrap;">' +
          '<button data-action="openEditByData" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" style="padding:4px 8px;border:none;border-radius:6px;background:#ec4899;color:#fff;cursor:pointer;font-size:11px;margin-right:2px;">✏️</button>' +
          '<button data-action="delSiteByData" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" style="padding:4px 8px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-size:11px;margin-right:2px;">🗑️</button>' +
          (!kw ? '<button data-action="moveSiteDirect" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" data-dir="-1" style="padding:4px 6px;border:none;border-radius:6px;background:#f3f4f6;color:#666;cursor:pointer;font-size:11px;margin-right:2px;">↑</button>' +
                 '<button data-action="moveSiteDirect" data-cat="' + encodeURIComponent(cat) + '" data-idx="' + idx + '" data-dir="1" style="padding:4px 6px;border:none;border-radius:6px;background:#f3f4f6;color:#666;cursor:pointer;font-size:11px;">↓</button>' : '') +
        '</td></tr>';
    });
  });
  
  if (!hasAny && !kw) {
    html = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af;">暂无站点</td></tr>';
  } else if (!hasAny && kw) {
    html = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af;">未找到匹配的网站</td></tr>';
  }
  tbody.innerHTML = html;
}

// --- Add/Edit site ---
function openEdit(cat, idx) {
  var data = loadAdminSites();
  var isNew = (idx === undefined);
  var site = {};
  var currentCat = cat || '';
  
  if (!isNew && data[currentCat] && data[currentCat][idx]) {
    site = data[currentCat][idx];
  }
  
  // Build category options
  var cats = Object.keys(data);
  var catOpts = cats.map(function(c) {
    return '<option value="' + esc(c) + '"' + (c === currentCat ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
  catOpts += '<option value="__new__">+ 新建分类</option>';
  
  document.getElementById('editTitle').textContent = isNew ? '➕ 添加站点' : '✏️ 编辑站点';
  document.getElementById('editId').value = (isNew ? '' : currentCat + '|' + idx);
  document.getElementById('editCatSelect').innerHTML =
    '<select id="editCat" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin-bottom:12px;box-sizing:border-box;">' + catOpts + '</select>';
  document.getElementById('editName').value = site.name || '';
  document.getElementById('editUrl').value = site.url || '';
  document.getElementById('editDesc').value = site.desc || '';
  document.getElementById('editIconUrl').value = site.img || '';
  // 安全设置图标预览：用 createElement 代替 innerHTML，防止 XSS
  var preview = document.getElementById('editIconPreview');
  preview.innerHTML = '';
  if (site.img && /^https?:\/\//i.test(site.img)) {
    var img = document.createElement('img');
    img.src = site.img;
    img.style.cssText = 'width:32px;height:32px;border-radius:4px;margin-left:8px;';
    preview.appendChild(img);
  }
  
  document.getElementById('editModal').style.display = 'flex';
}

function closeEdit() {
  document.getElementById('editModal').style.display = 'none';
}

function handleIconUpload(input) {
  var file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('图标文件不能超过 2MB');
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    var base64 = e.target.result;
    document.getElementById('editIconUrl').value = base64;
    // 安全设置图标预览：使用 DOM API 避免 innerHTML XSS 风险
    var preview = document.getElementById('editIconPreview');
    preview.innerHTML = '';
    var img = document.createElement('img');
    img.src = base64;
    img.style.cssText = 'width:32px;height:32px;border-radius:4px;margin-left:8px;';
    preview.appendChild(img);
  };
  reader.readAsDataURL(file);
}

// --- 自动抓取网站元数据 ---
var _fetchMetaTimer = null;
function autoFetchMeta() {
  if (_fetchMetaTimer) clearTimeout(_fetchMetaTimer);
  var url = document.getElementById('editUrl').value.trim();
  if (!url || url.indexOf('http') !== 0) return;
  var statusEl = document.getElementById('fetchMetaStatus');
  statusEl.style.display = 'inline';
  statusEl.textContent = '⏳';
  _fetchMetaTimer = setTimeout(function() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/fetch-meta?url=' + encodeURIComponent(url), true);
    xhr.onload = function() {
      statusEl.style.display = 'none';
      if (xhr.status !== 200) return;
      try {
        var resp = JSON.parse(xhr.responseText);
        var nameInput = document.getElementById('editName');
        var descInput = document.getElementById('editDesc');
        if (resp.title && !nameInput.value.trim()) nameInput.value = resp.title;
        if (resp.description && !descInput.value.trim()) descInput.value = resp.description;
        if (resp.title) statusEl.textContent = '✅';
      } catch(e) {}
    };
    xhr.onerror = function() { statusEl.style.display = 'none'; };
    xhr.send();
  }, 800);
}

function saveEdit() {
  var catSelect = document.getElementById('editCat');
  var cat = catSelect.value;
  var name = document.getElementById('editName').value.trim();
  var url = document.getElementById('editUrl').value.trim();
  var desc = document.getElementById('editDesc').value.trim();
  var icon = document.getElementById('editIconUrl').value.trim();
  
  if (!url) { alert('请输入网址'); return; }
  if (!name) name = url;
  
  // Validate URL — 防止 javascript: 等危险协议
  if (!/^https?:\/\//i.test(url)) {
    alert('URL必须以 http:// 或 https:// 开头');
    return;
  }
  try {
    new URL(url);
  } catch(e) {
    alert('URL格式不正确');
    return;
  }
  
  // Create new category if needed
  var data = loadAdminSites();
  if (cat === '__new__') {
    var newCat = prompt('请输入新分类名称：');
    if (!newCat) return;
    cat = newCat;
    if (!data[cat]) data[cat] = [];
  } else if (!data[cat]) {
    data[cat] = [];
  }
  
  var idStr = document.getElementById('editId').value;
  if (idStr) {
    // Edit existing: always remove old entry first
    var parts = idStr.split('|');
    var oldCat = parts[0];
    var oldIdx = parseInt(parts[1]);
    if (data[oldCat] && data[oldCat][oldIdx]) {
      data[oldCat].splice(oldIdx, 1);
      if (data[oldCat].length === 0) delete data[oldCat];
    }
    data[cat].push({ name: name, url: url, desc: desc || name, img: icon, customImg: !!icon });
  } else {
    // Add new
    data[cat].push({ name: name, url: url, desc: desc || name, img: icon, customImg: !!icon });
  }
  
  saveAdminSites(data);
  closeEdit();
  renderAdminTable();
  renderCategoryManager();
  showToast('保存成功！');
}

function delSite(cat, idx) {
  var _sites = (loadAdminSites()[cat] || []);
  var _siteName = _sites[idx] ? _sites[idx].name : '';
  if (!confirm('确定删除 "' + _siteName + '" ?')) return;
  var data = loadAdminSites();
  data[cat].splice(parseInt(idx), 1);
  if (data[cat].length === 0) delete data[cat];
  saveAdminSites(data);
  renderAdminTable();
  renderCategoryManager();
  showToast('已删除');
}

// --- Bridge functions for data-attribute based clicks ---
function openEditByData(btn) {
  openEdit(decodeURIComponent(btn.dataset.cat), parseInt(btn.dataset.idx));
}
function delSiteByData(btn) {
  delSite(decodeURIComponent(btn.dataset.cat), parseInt(btn.dataset.idx));
}

// --- 站点排序 ---
function moveSite(catEncoded, idx, direction) {
  var cat = decodeURIComponent(catEncoded);
  var data = loadAdminSites();
  var sites = data[cat];
  if (!sites || sites.length < 2) return;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= sites.length) return;
  // 交换位置
  var tmp = sites[idx];
  sites[idx] = sites[newIdx];
  sites[newIdx] = tmp;
  saveAdminSites(data);
  renderAdminTable();
  showToast('排序已更新');
}

// --- Category Manager ---
function renderCategoryManager() {
  var container = document.getElementById('adminCatOrder');
  if (!container) return;
  var data = loadAdminSites();
  var cats = Object.keys(data);
  var order = getCategoryOrder() || cats.slice();
  cats.forEach(function(c) { if (order.indexOf(c) === -1) order.push(c); });
  
  var html = '<div class="cat-list">';
  order.forEach(function(cat) {
    if (!data[cat]) return;
    html += '<div class="cat-item" draggable="true" data-cat="' + esc(cat) + '">' +
      '<span class="cat-drag">⠿</span>' +
      '<span class="cat-name">' + esc(cat) + '</span>' +
      '<span class="cat-count">(' + data[cat].length + ')</span>' +
      '<button data-action="renameCategory" data-cat="' + encodeURIComponent(cat) + '" class="btn-ren-cat" title="重命名分类">✏️</button>' +
      '<button data-action="deleteCategory" data-cat="' + encodeURIComponent(cat) + '" class="btn-del-cat" title="删除分类">✕</button>' +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  
  // Bind drag events
  container.querySelectorAll('.cat-item').forEach(function(item) {
    item.addEventListener('dragstart', onCatDragStart);
    item.addEventListener('dragover', onCatDragOver);
    item.addEventListener('drop', onCatDrop);
    item.addEventListener('dragend', onCatDragEnd);
  });
}

var _dragCat = null;
function onCatDragStart(e) {
  _dragCat = this.dataset.cat;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onCatDragOver(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}
function onCatDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (_dragCat === this.dataset.cat) return;
  var data = loadAdminSites();
  var cats = Object.keys(data);
  var order = getCategoryOrder() || cats.slice();
  var fromIdx = order.indexOf(_dragCat);
  var toIdx = order.indexOf(this.dataset.cat);
  if (fromIdx >= 0 && toIdx >= 0) {
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, _dragCat);
    saveCategoryOrder(order);
    renderCategoryManager();
    showToast('分类顺序已更新');
  }
}
function onCatDragEnd() {
  document.querySelectorAll('.cat-item').forEach(function(el) {
    el.classList.remove('dragging', 'drag-over');
  });
  _dragCat = null;
}

function addCategory() {
  var name = prompt('请输入新分类名称：');
  if (!name) return;
  var data = loadAdminSites();
  if (data[name]) { alert('分类已存在'); return; }
  data[name] = [];
  saveAdminSites(data);
  renderCategoryManager();
  showToast('分类已创建');
}

function deleteCategory(cat) {
  if (!confirm('确定删除分类 "' + cat + '" 及其所有站点？')) return;
  var data = loadAdminSites();
  delete data[cat];
  saveAdminSites(data);
  // 清理分类顺序缓存中的死引用
  var order = getCategoryOrder();
  if (order) {
    var idx = order.indexOf(cat);
    if (idx > -1) {
      order.splice(idx, 1);
      saveCategoryOrder(order);
    }
  }
  renderCategoryManager();
  showToast('分类已删除');
}

function renameCategory(oldName) {
  var newName = prompt('请输入新的分类名称：', oldName);
  if (newName === null) return;
  newName = newName.trim();
  if (!newName) { showToast('分类名称不能为空'); return; }
  if (newName === oldName) return;
  var data = loadAdminSites();
  if (data[newName]) { alert('分类名「' + newName + '」已存在，请换个名字'); return; }
  // 保留站点数据，替换 key
  data[newName] = data[oldName];
  delete data[oldName];
  saveAdminSites(data);
  // 更新分类顺序
  var order = getCategoryOrder();
  if (order) {
    var idx = order.indexOf(oldName);
    if (idx > -1) order[idx] = newName;
    saveCategoryOrder(order);
  }
  renderCategoryManager();
  mergeToRender();
  render();
  showToast('已重命名「' + oldName + '」→「' + newName + '」');
}

// --- Utility ---
// 站点图标地址：默认取目标站点自身的 /favicon.ico（无第三方依赖）；
// 配置了 FAVICON_PROXY 模板时走自建代理。
function getFaviconUrl(url, size) {
  size = size || 64;
  var domain = '';
  try { domain = new URL(url).hostname; } catch (e) { return ''; }
  if (FAVICON_PROXY) {
    return FAVICON_PROXY.replace('{domain}', domain).replace('{size}', size);
  }
  try { return new URL(url).origin + '/favicon.ico'; } catch (e) { return ''; }
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function showToast(msg) {
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;z-index:99999;animation:fadeIn .3s;';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 2500);
}

// --- Change Password ---
function changePwd() {
  var token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) {
    showToast('⚠️ 请先登录管理账号');
    return;
  }
  var current = prompt('请输入当前密码：');
  if (current === null) return;
  var newPwd = prompt('请输入新密码：');
  if (newPwd === null || newPwd === '') return;
  if (newPwd.length < 4) {
    alert('密码长度至少 4 位');
    return;
  }
  var confirmPwd = prompt('请再次输入新密码：');
  if (confirmPwd !== newPwd) {
    alert('两次密码不一致！');
    return;
  }
  fetch(CLOUD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'changePassword',
      token: token,
      currentPassword: current,
      newPassword: newPwd
    })
  }).then(function(r) { return r.json(); }).then(function(resp) {
    if (resp.success) {
      showToast('✅ 密码修改成功！请重新登录');
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      _isAdmin = false;
      refreshAdminMode();
    } else {
      showToast('⚠️ 修改失败: ' + (resp.error || '未知错误'));
    }
  }).catch(function() {
    showToast('⚠️ 网络错误，请重试');
  });
}

// ===== 云端同步 =====
var _syncing = false;

function syncToCloud(data) {
  if (_syncing) return;
  if (!data) data = loadAdminSites();
  var token = localStorage.getItem(ADMIN_TOKEN_KEY);
  var btn = document.getElementById('syncBtn');
  if (!token) {
    showToast('⚠️ 请先登录管理账号（点击⚙️管理）');
    if (btn) btn.textContent = '☁️ 同步';
    return;
  }
  var catOrder = getCategoryOrder();
  var payload = { token: token, data: data };
  if (catOrder) payload.catOrder = catOrder;

  if (btn) btn.textContent = '☁️ 同步中...';

  fetch(CLOUD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); }).then(function(resp) {
    _syncing = false;
    if (btn) btn.textContent = '☁️ 同步';
    if (resp.success) {
      updateCloudStatusBar(true);
      showToast('☁️ 已同步到云端');
    } else if (resp.error) {
      showToast('⚠️ 同步失败: ' + resp.error);
      if (resp.error.indexOf('未登录') !== -1 || resp.error.indexOf('会话') !== -1) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        _isAdmin = false;
        refreshAdminMode();
      }
    }
  }).catch(function() {
    _syncing = false;
    if (btn) btn.textContent = '☁️ 同步';
    showToast('⚠️ 网络请求失败，请检查网络连接');
  });
  _syncing = true;
}

function syncFromCloud() {
  fetch(CLOUD_API).then(function(r) {
    if (!r.ok) { fallbackRender(); return; }
    return r.json();
  }).then(function(resp) {
    if (!resp || !resp.sites || typeof resp.sites !== 'object' || Object.keys(resp.sites).length === 0) {
      fallbackRender();
      return;
    }
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(resp.sites));
    if (resp.catOrder) {
      localStorage.setItem(ADMIN_CAT_ORDER_KEY, JSON.stringify(resp.catOrder));
    }
    mergeToRender();
    render();
    updateCloudStatusBar(true);
    showToast('☁️ 已加载云端数据');
    if (document.getElementById('adminPanel').style.display === 'block') {
      renderAdminTable();
      renderCategoryManager();
    }
  }).catch(function() {
    fallbackRender();
  });
}
function fallbackRender() {
  mergeToRender();
  render();
}

// 手动从云端拉取（刷新管理面板，不重新渲染主页面）
function syncPullFromCloud() {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', CLOUD_API, true);
  xhr.onload = function() {
    if (xhr.status !== 200) {
      showToast('⚠️ 拉取失败，状态码: ' + xhr.status);
      return;
    }
    try {
      var resp = JSON.parse(xhr.responseText);
      if (!resp.sites || Object.keys(resp.sites).length === 0) {
        showToast('☁️ 云端暂无数据');
        return;
      }
      // 覆盖本地数据
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(resp.sites));
      if (resp.catOrder) {
        localStorage.setItem(ADMIN_CAT_ORDER_KEY, JSON.stringify(resp.catOrder));
      }
      // 刷新管理面板
      renderAdminTable();
      renderCategoryManager();
      // 刷新主页面
      mergeToRender();
      render();
      updateCloudStatusBar(true);
      showToast('☁️ 已从云端拉取 ' + Object.keys(resp.sites).length + ' 个分类');
    } catch(e) {
      showToast('⚠️ 数据解析失败: ' + e.message);
    }
  };
  xhr.onerror = function() {
    showToast('⚠️ 网络请求失败，请检查网络连接');
  };
  xhr.send();
}

function updateCloudStatusBar(hasData) {
  var bar = document.getElementById('cloudStatusBar');
  if (!bar) return;
  if (hasData) {
    bar.innerHTML = '✅ 云端已同步 · 更换浏览器后会自动加载';
    bar.style.background = '#dcfce7';
    bar.style.color = '#166534';
  } else {
    bar.innerHTML = '☁️ 暂无云端数据，修改后点击「同步」上传';
    bar.style.background = '#fef3c7';
    bar.style.color = '#92400e';
  }
}

// ===== IP 信息浮窗 =====
var _ipw = { loaded: false };

function toggleIPWidget() {
  var w = document.getElementById('ipWidget');
  w.classList.toggle('open');
  if (!w.classList.contains('open')) return;
  if (!_ipw.loaded) { _ipw.loaded = true; ipwTestLatency(); ipwQuerySources(); }
}

function ipwInit() {
  ipwGetMainIP();
  ipwTestLatency();
  ipwQuerySources();
}

function ipwGetMainIP() {
  fetch('/api/ip').then(function(r){ return r.json(); }).then(function(data){
    var dot = document.getElementById('ipWidgetDot');
    var text = document.getElementById('ipWidgetText');
    var mainEl = document.getElementById('ipwMainIP');
    var tagsEl = document.getElementById('ipwMainTags');

    if (data.ip && data.ip !== 'unknown') {
      dot.className = 'ip-dot online';
      text.textContent = data.ip + (data.city ? ' · ' + data.city : '');
      mainEl.textContent = data.ip;
      mainEl.setAttribute('data-priv', 'ip');

      var tags = '';
      if (data.country) tags += '<span class="ipw-tag loc">' + esc(data.country) + (data.city ? ' / ' + esc(data.city) : '') + '</span>';
      if (data.asOrganization) tags += '<span class="ipw-tag isp">' + esc(data.asOrganization) + '</span>';
      if (data.asn) tags += '<span class="ipw-tag asn">' + esc(data.asn) + '</span>';
      if (data.colo) tags += '<span class="ipw-tag colo">CF ' + esc(data.colo) + '</span>';
      tagsEl.innerHTML = tags;

      var isV6 = data.ip.indexOf(':') >= 0;
      if (isV6) {
        document.getElementById('ipwIPv6').textContent = data.ip;
        document.getElementById('ipwIPv6Info').innerHTML = esc((data.country||'') + ' ' + (data.city||'')) + '<br>' + esc(data.asOrganization||'') + (data.asn ? ' (' + esc(data.asn) + ')' : '');
        document.getElementById('ipwIPv6').setAttribute('data-priv','ip');
        document.getElementById('ipwIPv6Info').setAttribute('data-priv','ip');
        document.getElementById('ipwIPv4').textContent = '不适用';
        document.getElementById('ipwIPv4Info').textContent = '当前网络无 IPv4';
      } else {
        document.getElementById('ipwIPv4').textContent = data.ip;
        document.getElementById('ipwIPv4Info').innerHTML = esc((data.country||'') + ' ' + (data.city||'')) + '<br>' + esc(data.asOrganization||'') + (data.asn ? ' (' + esc(data.asn) + ')' : '');
        document.getElementById('ipwIPv4').setAttribute('data-priv','ip');
        document.getElementById('ipwIPv4Info').setAttribute('data-priv','ip');
      }
    } else {
      dot.className = 'ip-dot';
      dot.style.background = '#ef4444';
      text.textContent = 'IP 获取失败';
      mainEl.textContent = '无法获取 IP';
    }
    ipwDetectSecondary();
  }).catch(function(){
    document.getElementById('ipWidgetDot').style.background = '#ef4444';
    document.getElementById('ipWidgetText').textContent = 'IP 获取失败';
  });
}

function ipwDetectSecondary() {
  // IPv4
  if (document.getElementById('ipwIPv4').textContent === '检测中...' || document.getElementById('ipwIPv4').textContent === '不适用') {
    fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){
      if (d.ip && d.ip.indexOf('.') >= 0 && d.ip.indexOf(':') < 0) {
        document.getElementById('ipwIPv4').textContent = d.ip;
        document.getElementById('ipwIPv4').setAttribute('data-priv','ip');
        fetch('https://ip-api.com/json/' + d.ip + '?fields=country,regionName,city,isp,as').then(function(r){return r.json();}).then(function(info){
          if (info.status === 'success') {
            document.getElementById('ipwIPv4Info').innerHTML = esc(info.country+' '+info.regionName+' '+info.city) + '<br>' + esc(info.isp) + (info.as?' ('+esc(info.as)+')':'');
            document.getElementById('ipwIPv4Info').setAttribute('data-priv','ip');
          }
        }).catch(function(){});
      }
    }).catch(function(){});
  }
  // IPv6
  fetch('https://api6.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){
    if (d.ip && d.ip.indexOf(':') >= 0) {
      if (document.getElementById('ipwIPv6').textContent === '检测中...') {
        document.getElementById('ipwIPv6').textContent = d.ip;
        document.getElementById('ipwIPv6').setAttribute('data-priv','ip');
        fetch('https://ip-api.com/json/' + d.ip + '?fields=country,regionName,city,isp,as').then(function(r){return r.json();}).then(function(info){
          if (info.status === 'success') {
            document.getElementById('ipwIPv6Info').innerHTML = esc(info.country+' '+info.regionName+' '+info.city) + '<br>' + esc(info.isp) + (info.as?' ('+esc(info.as)+')':'');
            document.getElementById('ipwIPv6Info').setAttribute('data-priv','ip');
          }
        }).catch(function(){});
      }
    } else {
      if (document.getElementById('ipwIPv6').textContent === '检测中...') {
        document.getElementById('ipwIPv6').textContent = '不适用';
        document.getElementById('ipwIPv6Info').textContent = '无 IPv6 连接';
      }
    }
  }).catch(function(){
    if (document.getElementById('ipwIPv6').textContent === '检测中...') {
      document.getElementById('ipwIPv6').textContent = '不适用';
      document.getElementById('ipwIPv6Info').textContent = '无 IPv6 连接';
    }
  });
}

var _ipwPingTargets = [
  { name: '百度', tag: 'domestic', url: 'https://www.baidu.com/favicon.ico' },
  { name: '淘宝', tag: 'domestic', url: 'https://www.taobao.com/favicon.ico' },
  { name: 'B站', tag: 'domestic', url: 'https://www.bilibili.com/favicon.ico' },
  { name: '微博', tag: 'domestic', url: 'https://weibo.com/favicon.ico' },
  { name: '抖音', tag: 'domestic', url: 'https://www.douyin.com/favicon.ico' },
  { name: '微信', tag: 'domestic', url: 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico' },
  { name: '京东', tag: 'domestic', url: 'https://www.jd.com/favicon.ico' },
  { name: '知乎', tag: 'domestic', url: 'https://static.zhihu.com/heifetz/favicon.ico' },
  { name: 'GitHub', tag: 'intl', url: 'https://github.githubassets.com/favicons/favicon.svg' },
  { name: 'CF', tag: 'intl', url: 'https://www.cloudflare.com/favicon.ico' },
  { name: 'jsDelivr', tag: 'intl', url: 'https://cdn.jsdelivr.net/favicon.ico' },
  { name: 'Google', tag: 'intl', url: 'https://www.google.com/favicon.ico' }
];

function ipwTestLatency() {
  var grid = document.getElementById('ipwPingGrid');
  grid.innerHTML = '';
  _ipwPingTargets.forEach(function(t){
    var item = document.createElement('div');
    item.className = 'ipw-ping-item testing';
    item.setAttribute('data-priv', t.tag);
    item.innerHTML = '<div class="ipw-ping-name">' + t.name + '</div><div class="ipw-ping-val testing">...</div>';
    grid.appendChild(item);

    var img = new Image();
    var start = performance.now();
    var done = false;
    var timer = setTimeout(function(){ if(!done){done=true; ipwPingDone(item,'timeout');} }, 8000);
    img.onload = function(){ if(!done){done=true;clearTimeout(timer);ipwPingDone(item, Math.round(performance.now()-start));} };
    img.onerror = function(){ if(!done){done=true;clearTimeout(timer);ipwPingDone(item, Math.round(performance.now()-start));} };
    img.src = t.url + '?_t=' + Date.now() + Math.random();
  });
}

function ipwPingDone(item, val) {
  var el = item.querySelector('.ipw-ping-val');
  item.classList.remove('testing');
  item.classList.add('done');
  if (val === 'timeout') {
    el.className = 'ipw-ping-val timeout';
    el.textContent = '超时';
  } else {
    el.className = 'ipw-ping-val';
    if (val < 100) el.classList.add('good');
    else if (val < 300) el.classList.add('ok');
    else el.classList.add('bad');
    el.innerHTML = val + '<span class="ipw-ping-ms">ms</span>';
  }
}

var _ipwSources = [
  { name: '本站CF', type: 'domestic', fetch: function(){ return fetch('/api/ip').then(function(r){return r.json();}).then(function(d){return {ip:d.ip, loc:(d.country||'')+' '+(d.city||''), isp:d.asOrganization};}); } },
  { name: 'CF Trace', type: 'intl', fetch: function(){ return fetch('/cdn-cgi/trace').then(function(r){return r.text();}).then(function(t){ var ip='',loc=''; t.split('\n').forEach(function(l){ if(l.indexOf('ip=')===0)ip=l.substring(3); if(l.indexOf('loc=')===0)loc=l.substring(4); }); return {ip:ip,loc:loc,isp:'CF'}; }); } },
  { name: 'ipify4', type: 'intl', fetch: function(){ return fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){return {ip:d.ip,loc:'',isp:''};}); } },
  { name: 'ipify6', type: 'intl', fetch: function(){ return fetch('https://api6.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){return {ip:d.ip,loc:'',isp:''};}).catch(function(){return {ip:'无IPv6',loc:'',isp:''};}); } }
];

function ipwQuerySources() {
  var grid = document.getElementById('ipwSources');
  grid.innerHTML = '';
  _ipwSources.forEach(function(s){
    var item = document.createElement('div');
    item.className = 'ipw-source';
    item.setAttribute('data-priv', s.type);
    item.innerHTML = '<div class="ipw-source-name">' + s.name + '</div><div class="ipw-source-loading">...</div>';
    grid.appendChild(item);
    s.fetch().then(function(r){
      item.innerHTML = '<div class="ipw-source-name">' + s.name + '</div><div class="ipw-source-ip">' + esc(r.ip||'N/A') + '</div><div class="ipw-source-loc">' + esc(r.loc||'') + (r.isp?' · '+esc(r.isp):'') + '</div>';
    }).catch(function(){
      item.innerHTML = '<div class="ipw-source-name">' + s.name + '</div><div class="ipw-source-ip" style="color:#ef4444;font-size:10px">失败</div>';
    });
  });
}

// 点击浮窗外关闭
document.addEventListener('click', function(e){
  var w = document.getElementById('ipWidget');
  if (w.classList.contains('open') && !w.contains(e.target)) {
    w.classList.remove('open');
  }
});

// 页面加载后自动检测 IP（显示在角落药丸条）
ipwGetMainIP();

// ===== 事件委托系统（替代 inline onclick，CSP 安全） =====
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.dataset.action;

  switch (action) {
    // --- 静态 HTML 按钮 ---
    case 'toggleSidebar': toggleSidebar(); break;
    case 'switchSearchMode': switchSearchMode(el.dataset.mode); break;
    case 'onSearchButtonClick': onSearchButtonClick(); break;
    case 'scrollToTop': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'toggleIPWidget': toggleIPWidget(); break;
    case 'ipwTestLatency': ipwTestLatency(); break;
    case 'ipwQuerySources': ipwQuerySources(); break;
    case 'showLogin': showLogin(); break;
    case 'adminEntryClick': _isAdmin ? toggleAdminMode() : showLogin(); break;
    case 'openAdmin': openAdmin(); break;
    case 'togglePwdVisibility': togglePwdVisibility(); break;
    case 'closeLogin': closeLogin(); break;
    case 'doLogin': doLogin(el); break;
    case 'closeAdmin': closeAdmin(); break;
    case 'showAdminTab': showAdminTab(el.dataset.tab); break;
    case 'exportData': exportData(); break;
    case 'importClick': document.getElementById('importFile').click(); break;
    case 'restoreFromBackup': restoreFromBackup(); break;
    case 'resetData': resetData(); break;
    case 'changePwd': changePwd(); break;
    case 'syncPullFromCloud': syncPullFromCloud(); break;
    case 'syncToCloud': syncToCloud(); break;
    case 'openEdit':
      // 静态按钮（无参数）或管理表格按钮（有 data-cat 和 data-idx）
      if (el.dataset.cat !== undefined) {
        openEdit(decodeURIComponent(el.dataset.cat), parseInt(el.dataset.idx));
      } else {
        openEdit();
      }
      break;
    case 'toggleAdminView': toggleAdminView(); break;
    case 'addCategory': addCategory(); break;
    case 'closeEdit': closeEdit(); break;
    case 'saveEdit': saveEdit(); break;

    // --- JS 生成的动态按钮 ---
    case 'scrollToCategory': scrollToCategory(parseInt(el.dataset.idx)); break;
    case 'linkClick': e.stopPropagation(); break;
    case 'startMainInlineEdit':
      e.stopPropagation();
      startMainInlineEdit(el.parentElement.parentElement, parseInt(el.dataset.ci), parseInt(el.dataset.si));
      break;
    case 'delSiteMain':
      e.stopPropagation();
      delSite(decodeURIComponent(el.dataset.cat), parseInt(el.dataset.idx));
      mergeToRender(); render();
      break;
    case 'saveMainInlineEdit':
      saveMainInlineEdit(el, parseInt(el.dataset.catIdx), parseInt(el.dataset.siteIdx));
      break;
    case 'cancelMainInlineEdit':
      cancelMainInlineEdit(el, parseInt(el.dataset.catIdx), parseInt(el.dataset.siteIdx));
      break;
    case 'delSite':
      delSite(decodeURIComponent(el.dataset.cat), parseInt(el.dataset.idx));
      break;
    case 'moveSite':
      moveSite(decodeURIComponent(el.dataset.cat), parseInt(el.dataset.idx), parseInt(el.dataset.dir));
      break;
    case 'saveInlineEdit': saveInlineEdit(el); break;
    case 'cancelInlineEdit': cancelInlineEdit(el); break;
    case 'openEditByData': openEditByData(el); break;
    case 'delSiteByData': delSiteByData(el); break;
    case 'moveSiteDirect':
      moveSite(el.dataset.cat, parseInt(el.dataset.idx), parseInt(el.dataset.dir));
      break;
    case 'renameCategory': renameCategory(decodeURIComponent(el.dataset.cat)); break;
    case 'deleteCategory': deleteCategory(decodeURIComponent(el.dataset.cat)); break;
  }
});

// 登录回车键处理
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.dataset.action === 'loginOnEnter') {
    doLogin(e.target.closest('button') || e.target);
  }
});

// --- 内联事件处理器迁移（CSP script-src 'self' 兼容） ---

// 搜索框 input + keydown
(function() {
  var si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('input', function() {
      clearTimeout(_searchDebounce);
      if (_searchMode === 'local') {
        _searchDebounce = setTimeout(localSearch, 200);
      } else {
        closeSearchResults();
      }
    });
    si.addEventListener('keydown', function(e) {
      onSearchKeyDown(e);
    });
  }
})();

// 管理按钮 hover 效果
(function() {
  var btn = document.getElementById('adminEntryBtn');
  if (btn) {
    btn.addEventListener('mouseenter', function() { this.style.transform = 'scale(1.05)'; });
    btn.addEventListener('mouseleave', function() { this.style.transform = 'scale(1)'; });
  }
})();

// 导入文件 change
(function() {
  var el = document.getElementById('importFile');
  if (el) el.addEventListener('change', importData);
})();

// 管理面板搜索 input
(function() {
  var el = document.getElementById('adminSearch');
  if (el) el.addEventListener('input', function() { renderAdminTable(); });
})();

// 编辑站点 URL input → 自动抓取
(function() {
  var el = document.getElementById('editUrl');
  if (el) el.addEventListener('input', autoFetchMeta);
})();

// 图标上传 change
(function() {
  var el = document.getElementById('editIconFile');
  if (el) el.addEventListener('change', function(e) { handleIconUpload(e.target); });
})();
