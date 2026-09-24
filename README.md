# Jev Inbox Decision · AI Agent Decision Layer for Gmail

> **核心理念**：
> **LLM 负责生成，Jev 负责决定什么时候值得生成。**  
> 面对 17 封邮件，传统 Agent 会无差别调用 17 次昂贵的大模型；而引入 Jev 作为决策层后，仅需 2 次 LLM 调用，其余全部由毫秒级 System One 快速分流。

这是一个专为**录制视频演示（Demo Video）**打造的 **Tampermonkey 油猴脚本**，运行在 Gmail 页面（`https://mail.google.com/*`），展示 [TypeSafe Jev](https://docs.typesafe.ai/) 作为 AI Agent 的 Decision Layer。

---

## 📸 核心演示效果

1. **零侵入原生 Gmail**：不改变 Gmail 任何原生布局，右侧浮现暗色系、半透明毛玻璃（Glassmorphism）的 AI 决策控制台。
2. **渐进式决策动画（专门适配视频录制）**：
   - 邮件在 Gmail 列表中逐行柔和高亮；
   - 悬浮窗中逐层展现 Jev System One 决策过程：
     - **Choice**：`立即查看` / `稍后阅读` / `需要回复` / `归档` / `忽略` 概率分布与置信度；
     - **Score**：`0~4` 级价值权重与排序打分；
     - **Nouls (Parallel)**：`今天值得处理？`、`需要 LLM？`、`营销推广？`；
   - 决策完成自动消除高亮并平滑推进下一封。
3. **高震撼力 Summary Dashboard**：
   - **17 Emails** · **85 Decisions** · **2 Need LLM**（节省 88% 大模型开销）；
   - 直观传达：**大量小判断交给 Jev，生成式大模型仅在真正需要生成内容（如起草回复）时才参与**。
4. **任意邮件点选穿梭（Single Email Inspection）**：
   - 在 Gmail 邮件列表中直接点击任意一封邮件，该行即刻高亮，右侧浮窗立刻展示该邮件的 Jev 完整决策细节；
   - 浮窗自带 `[ ◀ 上一封 ] [ 下一封 ▶ ]` 快速翻页，方便逐封向观众细致剖析；
   - 分析汇总看板中点击任意历史记录，也可直接点对点溯源展开。

---

## 🚀 安装与运行

真实 Gmail 只需要一个 Tampermonkey 油猴脚本，**不需要启动本地 Server**。脚本通过
`GM_xmlhttpRequest` 直连 `https://api.typesafe.ai/v1/systemone`，API Key 保存在
Tampermonkey 的脚本存储中，不写入本项目文件。

### 1. 申请 Jev API Key

1. 打开 [TypeSafe Console](https://console.typesafe.ai/) 并使用 Google 或邮箱登录。
2. 进入 [API Keys](https://console.typesafe.ai/keys) 页面。
3. 点击 **Create key**，为 Key 填写容易识别的名称，例如 `gmail`。
4. 创建后立即复制以 `apikey_` 开头的完整 Key，并妥善保存。页面之后通常只显示掩码。
5. 可在 [Usage](https://console.typesafe.ai/usage) 查看请求次数、Token 和费用。

不要把真实 API Key 写入脚本、截图、Issue 或 Git 提交。若 Key 泄露，请在 TypeSafe
Console 中撤销并重新创建。

### 2. 安装 Tampermonkey

1. 从 [Tampermonkey 官网](https://www.tampermonkey.net/) 安装 Chrome / Edge 扩展。
2. 安装完成后，点击浏览器工具栏中的 Tampermonkey 图标。
3. 打开 **管理面板**，确认扩展处于启用状态。

### 3. 安装本用户脚本

1. 在 Tampermonkey 管理面板点击 **添加新脚本**。
2. 删除编辑器里的默认模板。
3. 打开仓库中的 [`jev-inbox-decision.user.js`](./jev-inbox-decision.user.js)，复制全部内容并粘贴到编辑器。
4. 按 `Ctrl+S`（macOS 为 `⌘S`）保存。
5. 在“已安装脚本”中确认 **Jev Inbox Decision** 已启用，匹配地址为
   `https://mail.google.com/*`。

直接在浏览器中查看 `.user.js` 文件不一定代表已经安装；以 Tampermonkey 的“已安装脚本”
列表为准。

### 4. 在 Gmail 中运行

1. 打开或刷新 [Gmail](https://mail.google.com/)。
2. 页面右侧出现 **Jev · Inbox Decision** 面板。
3. 在面板的 **Jev API Key** 输入框粘贴 Key，点击 **保存**。
4. 点击 **开始分析**。脚本会读取当前 Gmail 列表中可见邮件的发件人、主题、摘要、
   未读和星标状态，并发送给 TypeSafe Jev 进行判断。
5. 分析结束后，每行会显示“立即查看 / 稍后阅读 / 需要回复 / 归档 / 忽略”标签。

Gmail 会在滚动时回收并重建邮件行。本脚本会根据发件人和主题恢复已完成的标签，滚动后
最多等待约 1.2 秒即可重新出现。

### 可选：离线视觉 Preview

`preview-demo.html` 与 `demo-data.js` 仅用于 Mock 视觉演示，不调用 Jev API，也不参与
真实 Gmail 的运行。直接打开 `preview-demo.html` 即可查看。

---

## 🎛 控制面板功能说明

悬浮窗支持自由拖拽、最小化、关闭与随时唤醒：

| 控件 / 状态 | 说明 | 录屏建议 |
| :--- | :--- | :--- |
| **● jev-latest · 17 封就绪** | 决策模型与邮件数据状态。统一加载 17 封高仿真邮件体系。 | 保持默认状态即可直接演示。 |
| **Jev API** | Jev System One 决策层接口状态，直连 TypeSafe 智能决策引擎。 | 保持常亮就绪，录屏画面完全自然逼真。 |

---

## 🎬 录屏演示解说脚本（建议 60~90 秒）

> **【0:00 - 0:15 痛点切入】**  
> “大家看，如果让传统的 AI Agent 来帮我打理这 17 封未读邮件，通常的做法是对每封邮件都调用一次大模型去读、去想、去写。但这不仅速度慢、容易超时，而且其中绝大多数都是账单、打折广告或者订阅周刊，根本不需要调用昂贵的大模型。”

> **【0:15 - 0:45 展示 Jev 决策层】**  
> “这里我们接入了 Jev 作为决策层。点击「开始分析」，注意看右侧的 Jev System One 引擎：  
> 它不会直接写作文，而是针对每封邮件瞬间并行评估几个关键维度：  
> 1. **Choice**：它判断出应该归档、稍后阅读还是回复；  
> 2. **Score**：评定 0 到 4 级的价值权重；  
> 3. **Nouls**：重点看这一项——**「需要 LLM？」**。比如 Nike 打折邮件，LLM 需求仅 1%，直接归档；而遇到这封朋友聚餐和播客访谈邀请，Jev 敏锐识别出需要回复，LLM 需求立刻飙升到 80% 以上！”

> **【0:45 - 1:15 总结收尾】**  
> “分析完成！看最终的统计看板：  
> **17 封邮件，完成了 85 次精准决策，但最终真正唤醒大模型的只有 2 封！**  
> 其余 15 封全部由毫秒级的 Jev 快速分流，相当于减少了 88% 的大模型无效调用。  
> **记住这句话：LLM 负责生成，Jev 负责决定什么时候值得生成。**”

---

## 🧩 代码架构

遵循完全解耦与模块化设计，无任何原生 Gmail 逻辑外溢：

```text
jev-inbox-decision.user.js
│
├── CONFIG               // 集中配置项（API URL, Key, 演示延时, 模式开关）
├── DEMO_EMAILS          // 17 封固定仿真邮件数据及 Jev 输出结果
├── GmailDomAdapter      // 封装所有 Gmail DOM 选择器（getVisibleEmails, highlightEmail 等）
├── MockJevClient        // 确定性 Mock 引擎（保证视频录制 100% 可复现）
├── RealJevClient        // 真实 TypeSafe System One API 客户端（基于 GM_xmlhttpRequest）
├── DecisionEngine       // 编排批量流水线、节奏延时与进度事件
├── DecisionRenderer     // 渐进式动画卡片渲染器（Choice, Score, Nouls）
├── SummaryRenderer      // 统计看板渲染器（指标卡片、分流表格、明细穿梭）
├── FloatingPanel        // 浮动拖拽窗口容器（玻璃拟物暗色 UI, 最小化, 模式切换）
└── App (initApp)        // 入口自执行与路由自适应监听
```

---

## 📊 17 封 Demo 邮件分布明细

| 序号 | 发件人 | 邮件主题 | Jev 决策 (Choice) | 重要度 | 需要 LLM？ | 说明 |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | Nike Store | 独家特惠：精选运动鞋低至 5 折 | 归档 (ARCHIVE 92%) | 0 / 4 | 1% | 营销推广，无需人工，直接归档 |
| 2 | OpenAI Team | OpenAI Weekly: New tools for agents | 稍后阅读 (READ_LATER 84%) | 3 / 4 | 5% | 深度技术资讯，空闲精读 |
| 3 | GitHub | [agent-runtime] Issue #142: Fix latency | 立即查看 (VIEW_NOW 86%) | 3 / 4 | 14% | 重要研发通知，需立即跟进 |
| **4** | **王晨** | **本周五晚上有空聚一下吗？好久没见了** | **需要回复 (REPLY 94%)** | **3 / 4** | **82% ⚡** | **朋友沟通，触发 LLM 起草回复** |
| 5 | 招商银行信用卡 | 交易提醒：境外消费 USD 20.00 | 归档 (ARCHIVE 88%) | 1 / 4 | 0% | 流水账单，直接归档 |
| **6** | **TechTalk Podcast** | **播客访谈邀请：聊聊 AI Agent 架构** | **需要回复 (REPLY 89%)** | **3 / 4** | **88% ⚡** | **合作邀请，触发 LLM 起草回复** |
| 7 | Linear Billing | Invoice #LIN-2026-0922 Receipt | 归档 (ARCHIVE 85%) | 1 / 4 | 0% | SaaS 订阅续费凭证 |
| 8 | Cursor Team | Introducing Cursor 2.0: Instant Agent | 稍后阅读 (READ_LATER 81%) | 2 / 4 | 8% | 产品更新公告 |
| 9 | GrowthBoost Agency | Quick question about your SEO ranking | 忽略 (IGNORE 95%) | 0 / 4 | 0% | 垃圾群发外链推广 |
| 10 | Sarah Jenkins | 紧急：Q3 交付评审会议纪要确认 | 立即查看 (VIEW_NOW 93%) | 4 / 4 | 42% | 工作核心交付，今日紧急处理 |
| 11 | 阿里云通知 | 【账单通知】您 2026 年 08 月份结算账单 | 归档 (ARCHIVE 91%) | 1 / 4 | 0% | 月度常规扣款 |
| 12 | Stripe Receipts | Receipt from Supabase Inc. ($25.00) | 归档 (ARCHIVE 89%) | 1 / 4 | 0% | 基础设施发票 |
| 13 | Notion Team | What is new in Notion: Forms & Automation | 稍后阅读 (READ_LATER 82%) | 2 / 4 | 6% | 产品功能上新 |
| 14 | AWS Security Hub | Weekly Compliance Report - Zero Findings | 归档 (ARCHIVE 87%) | 2 / 4 | 0% | 安全检查合规报告 |
| 15 | CloudFlare | Deep Dive into Workers AI and Latencies | 稍后阅读 (READ_LATER 85%) | 2 / 4 | 5% | 架构技术博客 |
| 16 | Figma | 权限提醒：您被添加为设计规范管理员 | 立即查看 (VIEW_NOW 91%) | 3 / 4 | 18% | 核心团队权限变更 |
| 17 | Apple Store | 您的 Apple 电子发票（订单编号） | 归档 (ARCHIVE 93%) | 1 / 4 | 0% | 电子发票凭证 |

**汇总指标**：
- **立即查看 (VIEW_NOW)**：3 封
- **稍后阅读 (READ_LATER)**：4 封
- **需要回复 (REPLY)**：2 封（**触发 LLM 撰写回复**）
- **归档 (ARCHIVE)**：7 封
- **忽略 (IGNORE)**：1 封
- **共 17 封邮件，完成 85 次决策，仅 2 次需要大模型，节省 15 次 LLM 消耗！**
