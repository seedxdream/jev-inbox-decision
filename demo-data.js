/**
 * Jev Demo Benchmarks & Datasets
 * Dedicated to preview-demo.html for reproducible video recording.
 * Decoupled from the production Gmail userscript.
 */
window.JEV_DEMO_EMAILS = [
    {
      id: 'demo-1',
      sender: 'Nike Store <members@nike-email.com>',
      subject: '独家特惠：精选运动鞋与潮流服饰低至 5 折，限时抢购',
      snippet: '探索会员专属折扣，Air Max 与 Jordan 系列参与限时促销，立即选购您的专属装备。限时 48 小时...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.92, IGNORE: 0.05, READ_LATER: 0.02, VIEW_NOW: 0.01, REPLY: 0.0 },
          confidence: 0.94
        },
        importance: {
          score: 0,
          label: '基本无关',
          confidence: 0.96
        },
        processToday: {
          probability: 0.03
        },
        needLLM: {
          probability: 0.01
        },
        promotion: {
          probability: 0.98
        }
      }
    },
    {
      id: 'demo-2',
      sender: 'OpenAI Team <newsletter@openai.com>',
      subject: 'OpenAI Weekly: New tools and best practices for building agents',
      snippet: 'Discover how developers are structuring agent loops, evaluation benchmarks, and multi-turn workflows with System One...',
      unread: true,
      starred: true,
      mockResult: {
        action: {
          value: 'READ_LATER',
          label: '稍后阅读',
          probabilities: { READ_LATER: 0.84, VIEW_NOW: 0.11, ARCHIVE: 0.03, REPLY: 0.02, IGNORE: 0.0 },
          confidence: 0.91
        },
        importance: {
          score: 3,
          label: '重要',
          confidence: 0.88
        },
        processToday: {
          probability: 0.88
        },
        needLLM: {
          probability: 0.05
        },
        promotion: {
          probability: 0.46
        }
      }
    },
    {
      id: 'demo-3',
      sender: 'GitHub Notifications <notifications@github.com>',
      subject: '[typesafe-ai/agent-runtime] Issue #142: Fix latency spike on concurrent batch evaluation',
      snippet: '@alex commented: I tracked this down to the connection pool reuse in the Node.js client. PR is incoming...',
      unread: true,
      starred: false,
      mockResult: {
        action: {
          value: 'VIEW_NOW',
          label: '立即查看',
          probabilities: { VIEW_NOW: 0.86, READ_LATER: 0.10, REPLY: 0.04, ARCHIVE: 0.0, IGNORE: 0.0 },
          confidence: 0.90
        },
        importance: {
          score: 3,
          label: '重要',
          confidence: 0.89
        },
        processToday: {
          probability: 0.92
        },
        needLLM: {
          probability: 0.14
        },
        promotion: {
          probability: 0.00
        }
      }
    },
    {
      id: 'demo-4',
      sender: '王晨 <wangchen.personal@gmail.com>',
      subject: '本周五晚上有空聚一下吗？好久没见了',
      snippet: '周五下班后去三里屯那家新开的云南菜怎么样？李博也来，看看你时间合适不，回复我～',
      unread: true,
      starred: false,
      mockResult: {
        action: {
          value: 'REPLY',
          label: '需要回复',
          probabilities: { REPLY: 0.94, VIEW_NOW: 0.04, READ_LATER: 0.02, ARCHIVE: 0.0, IGNORE: 0.0 },
          confidence: 0.97
        },
        importance: {
          score: 3,
          label: '重要',
          confidence: 0.92
        },
        processToday: {
          probability: 0.89
        },
        needLLM: {
          probability: 0.82
        },
        promotion: {
          probability: 0.01
        }
      }
    },
    {
      id: 'demo-5',
      sender: '招商银行信用卡 <alert@cmbchina.com>',
      subject: '交易提醒：您的招商银行信用卡发生一笔境外消费 USD 20.00',
      snippet: '您尾号 8826 的信用卡于 09月23日 16:32 发生消费：OPENAI API SUBSCRIPTION USD 20.00。如非本人操作请立即致电...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.88, VIEW_NOW: 0.08, IGNORE: 0.04, READ_LATER: 0.0, REPLY: 0.0 },
          confidence: 0.91
        },
        importance: {
          score: 1,
          label: '低价值',
          confidence: 0.85
        },
        processToday: {
          probability: 0.08
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.02
        }
      }
    },
    {
      id: 'demo-6',
      sender: 'TechTalk Daily Podcast <hosts@techtalkdaily.fm>',
      subject: '播客访谈邀请：聊聊 AI Agent Decision Layer 与新型架构',
      snippet: '您好！我们是 TechTalk 播客团队，一直关注您在 AI 架构方面的分享，想邀请您做一期 45 分钟的线上对谈，不知下周是否有档期？...',
      unread: true,
      starred: true,
      mockResult: {
        action: {
          value: 'REPLY',
          label: '需要回复',
          probabilities: { REPLY: 0.89, VIEW_NOW: 0.08, READ_LATER: 0.03, ARCHIVE: 0.0, IGNORE: 0.0 },
          confidence: 0.93
        },
        importance: {
          score: 3,
          label: '重要',
          confidence: 0.90
        },
        processToday: {
          probability: 0.91
        },
        needLLM: {
          probability: 0.88
        },
        promotion: {
          probability: 0.02
        }
      }
    },
    {
      id: 'demo-7',
      sender: 'Linear Billing <billing@linear.app>',
      subject: 'Invoice #LIN-2026-0922 from Linear Inc. - Receipt',
      snippet: 'Thank you for your payment. Your Standard Plan subscription has renewed successfully for 5 members...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.85, VIEW_NOW: 0.10, IGNORE: 0.05, READ_LATER: 0.0, REPLY: 0.0 },
          confidence: 0.89
        },
        importance: {
          score: 1,
          label: '低价值',
          confidence: 0.86
        },
        processToday: {
          probability: 0.05
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.05
        }
      }
    },
    {
      id: 'demo-8',
      sender: 'Cursor Announcements <team@cursor.sh>',
      subject: 'Introducing Cursor 2.0: Instant Agent Background Check & Fast Edit',
      snippet: 'We are excited to announce our major release featuring background agents, instant diff review, and enhanced terminal integration...',
      unread: true,
      starred: false,
      mockResult: {
        action: {
          value: 'READ_LATER',
          label: '稍后阅读',
          probabilities: { READ_LATER: 0.81, VIEW_NOW: 0.12, ARCHIVE: 0.05, REPLY: 0.02, IGNORE: 0.0 },
          confidence: 0.87
        },
        importance: {
          score: 2,
          label: '一般',
          confidence: 0.82
        },
        processToday: {
          probability: 0.75
        },
        needLLM: {
          probability: 0.08
        },
        promotion: {
          probability: 0.65
        }
      }
    },
    {
      id: 'demo-9',
      sender: 'GrowthBoost Agency <lead@seo-globalmarketing.biz>',
      subject: 'Quick question about your website SEO and domain ranking',
      snippet: 'Dear founder, I noticed several high-impact backlink opportunities for your site. Would you have 10 minutes to discuss? Guaranteed rankings...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'IGNORE',
          label: '忽略',
          probabilities: { IGNORE: 0.95, ARCHIVE: 0.04, VIEW_NOW: 0.01, READ_LATER: 0.0, REPLY: 0.0 },
          confidence: 0.96
        },
        importance: {
          score: 0,
          label: '基本无关',
          confidence: 0.98
        },
        processToday: {
          probability: 0.01
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.99
        }
      }
    },
    {
      id: 'demo-10',
      sender: 'Sarah Jenkins <s.jenkins@acme-corp.internal>',
      subject: '紧急：Q3 交付评审会议纪要与 Action Items 确认（需今天下班前确认）',
      snippet: '团队大家好，附上今天评审会纪要。请核心负责人重点看第 3 节的风险项并于今日 18:00 前回复确认，明天将向高管汇报...',
      unread: true,
      starred: true,
      mockResult: {
        action: {
          value: 'VIEW_NOW',
          label: '立即查看',
          probabilities: { VIEW_NOW: 0.93, REPLY: 0.05, READ_LATER: 0.02, ARCHIVE: 0.0, IGNORE: 0.0 },
          confidence: 0.95
        },
        importance: {
          score: 4,
          label: '非常重要',
          confidence: 0.96
        },
        processToday: {
          probability: 0.98
        },
        needLLM: {
          probability: 0.42
        },
        promotion: {
          probability: 0.00
        }
      }
    },
    // Supplementary items:
    // VIEW_NOW: 3, READ_LATER: 4, REPLY: 2, ARCHIVE: 7, IGNORE: 1 -> Total 17
    {
      id: 'demo-11',
      sender: '阿里云通知 <service@aliyun.com>',
      subject: '【账单通知】您 2026 年 08 月份结算账单已生成',
      snippet: '尊敬的客户，您 2026 年 08 月周期消费账单已出具，总计消费 328.40 元，已成功扣款。',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.91, VIEW_NOW: 0.06, IGNORE: 0.03, READ_LATER: 0.0, REPLY: 0.0 },
          confidence: 0.93
        },
        importance: {
          score: 1,
          label: '低价值',
          confidence: 0.88
        },
        processToday: {
          probability: 0.05
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.05
        }
      }
    },
    {
      id: 'demo-12',
      sender: 'Stripe Receipts <receipts@stripe.com>',
      subject: 'Receipt from Supabase Inc. ($25.00 paid)',
      snippet: 'Your payment of $25.00 to Supabase Inc. has been processed. Download invoice PDF anytime...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.89, VIEW_NOW: 0.08, IGNORE: 0.03, READ_LATER: 0.0, REPLY: 0.0 },
          confidence: 0.92
        },
        importance: {
          score: 1,
          label: '低价值',
          confidence: 0.85
        },
        processToday: {
          probability: 0.04
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.02
        }
      }
    },
    {
      id: 'demo-13',
      sender: 'Notion Team <team@m.notion.so>',
      subject: 'What is new in Notion: Forms, Automation, and Team Sites',
      snippet: 'Introducing Notion Forms: collect responses directly into your Notion database with custom logic...',
      unread: true,
      starred: false,
      mockResult: {
        action: {
          value: 'READ_LATER',
          label: '稍后阅读',
          probabilities: { READ_LATER: 0.82, VIEW_NOW: 0.10, ARCHIVE: 0.08, REPLY: 0.0, IGNORE: 0.0 },
          confidence: 0.86
        },
        importance: {
          score: 2,
          label: '一般',
          confidence: 0.80
        },
        processToday: {
          probability: 0.58
        },
        needLLM: {
          probability: 0.06
        },
        promotion: {
          probability: 0.52
        }
      }
    },
    {
      id: 'demo-14',
      sender: 'AWS Security Hub <no-reply@amazon.com>',
      subject: 'AWS Security Hub: Weekly Compliance Report - Zero Critical Findings',
      snippet: 'Your AWS accounts passed 98.4% of CIS AWS Foundations Benchmark checks. No critical findings detected...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.87, VIEW_NOW: 0.10, READ_LATER: 0.03, REPLY: 0.0, IGNORE: 0.0 },
          confidence: 0.90
        },
        importance: {
          score: 2,
          label: '一般',
          confidence: 0.83
        },
        processToday: {
          probability: 0.12
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.01
        }
      }
    },
    {
      id: 'demo-15',
      sender: 'CloudFlare Updates <newsletter@cloudflare.com>',
      subject: 'Deep Dive into Workers AI and Global Inference Latencies',
      snippet: 'Learn how edge compute architectures reduce round-trip latencies for inference workloads across 300+ cities...',
      unread: true,
      starred: false,
      mockResult: {
        action: {
          value: 'READ_LATER',
          label: '稍后阅读',
          probabilities: { READ_LATER: 0.85, VIEW_NOW: 0.09, ARCHIVE: 0.06, REPLY: 0.0, IGNORE: 0.0 },
          confidence: 0.89
        },
        importance: {
          score: 2,
          label: '一般',
          confidence: 0.81
        },
        processToday: {
          probability: 0.62
        },
        needLLM: {
          probability: 0.05
        },
        promotion: {
          probability: 0.38
        }
      }
    },
    {
      id: 'demo-16',
      sender: 'Figma Notifications <notifications@figma.com>',
      subject: '权限提醒：您被添加为「2026 Core Product Redesign」团队核心管理员',
      snippet: 'Design Lead Alex 邀请您加入核心设计规范项目，请立即确认团队协作空间访问权限与编辑状态...',
      unread: true,
      starred: true,
      mockResult: {
        action: {
          value: 'VIEW_NOW',
          label: '立即查看',
          probabilities: { VIEW_NOW: 0.91, REPLY: 0.05, READ_LATER: 0.04, ARCHIVE: 0.0, IGNORE: 0.0 },
          confidence: 0.94
        },
        importance: {
          score: 3,
          label: '重要',
          confidence: 0.91
        },
        processToday: {
          probability: 0.95
        },
        needLLM: {
          probability: 0.18
        },
        promotion: {
          probability: 0.00
        }
      }
    },
    {
      id: 'demo-17',
      sender: 'Apple Store <order-update@apple.com>',
      subject: '您的 Apple 电子发票（订单编号：W1082918847）',
      snippet: '感谢您选购 Apple 产品。您于 09月21日订购的配件电子增值税发票已开具，可点击查验并下载...',
      unread: false,
      starred: false,
      mockResult: {
        action: {
          value: 'ARCHIVE',
          label: '归档',
          probabilities: { ARCHIVE: 0.93, VIEW_NOW: 0.05, IGNORE: 0.02, READ_LATER: 0.0, REPLY: 0.0 },
          confidence: 0.95
        },
        importance: {
          score: 1,
          label: '低价值',
          confidence: 0.89
        },
        processToday: {
          probability: 0.04
        },
        needLLM: {
          probability: 0.00
        },
        promotion: {
          probability: 0.05
        }
      }
    }
  ];;
