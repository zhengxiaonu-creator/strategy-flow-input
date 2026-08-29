/* Generated from contracts/strategy-taxonomy-2026-09.json. Do not edit here. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.STRATEGY_TAXONOMY_2026_09 = factory();
})(typeof self !== "undefined" ? self : this, () => ({
  "schemaVersion": "strategy-taxonomy/2026-09",
  "fields": [
    {
      "fieldCode": "lifecycle",
      "label": "生命周期",
      "cardinality": "multi",
      "required": true,
      "values": [
        {
          "code": "new",
          "label": "新客",
          "status": "active"
        },
        {
          "code": "existing",
          "label": "存量",
          "status": "active"
        }
      ],
      "customProposals": {
        "allowed": false,
        "codeGeneratedBy": "not_applicable",
        "approvalRequired": false,
        "scope": "none"
      },
      "x-default": null
    },
    {
      "fieldCode": "customerClass",
      "label": "客群归属",
      "cardinality": "multi",
      "required": true,
      "values": [
        {
          "code": "generic",
          "label": "通用客群",
          "status": "active"
        },
        {
          "code": "tail",
          "label": "长尾客群",
          "status": "active"
        },
        {
          "code": "mass",
          "label": "大众客群",
          "status": "active"
        },
        {
          "code": "hnw",
          "label": "高净值客群",
          "status": "active"
        },
        {
          "code": "uhnw",
          "label": "超高净值客群",
          "status": "active"
        }
      ],
      "customProposals": {
        "allowed": false,
        "codeGeneratedBy": "not_applicable",
        "approvalRequired": false,
        "scope": "none"
      },
      "x-default": null
    },
    {
      "fieldCode": "assetRange",
      "label": "资产区间",
      "cardinality": "multi",
      "required": true,
      "parentFieldCode": "customerClass",
      "values": [
        {
          "code": "unlimited",
          "label": "不限资产",
          "parentCode": "generic",
          "status": "active"
        },
        {
          "code": "0_0.1w",
          "label": "(0, 0.1w)",
          "parentCode": "tail",
          "status": "active"
        },
        {
          "code": "0.1w_1w",
          "label": "[0.1w, 1w)",
          "parentCode": "tail",
          "status": "active"
        },
        {
          "code": "1w_5w",
          "label": "[1w, 5w)",
          "parentCode": "tail",
          "status": "active"
        },
        {
          "code": "5w_10w",
          "label": "[5w, 10w)",
          "parentCode": "mass",
          "status": "active"
        },
        {
          "code": "10w_30w",
          "label": "[10w, 30w)",
          "parentCode": "mass",
          "status": "active"
        },
        {
          "code": "30w_50w",
          "label": "[30w, 50w)",
          "parentCode": "mass",
          "status": "active"
        },
        {
          "code": "50w_100w",
          "label": "[50w, 100w)",
          "parentCode": "hnw",
          "status": "active"
        },
        {
          "code": "100w_300w",
          "label": "[100w, 300w)",
          "parentCode": "hnw",
          "status": "active"
        },
        {
          "code": "300w_inf",
          "label": "[300w, ∞)",
          "parentCode": "uhnw",
          "status": "active"
        }
      ],
      "dependencyRules": [
        {
          "code": "parent_value_match"
        },
        {
          "code": "each_selected_parent_requires_child"
        },
        {
          "code": "exclusive_value",
          "valueCode": "unlimited"
        },
        {
          "code": "value_requires_parent_value",
          "valueCode": "unlimited",
          "parentValueCode": "generic"
        }
      ],
      "customProposals": {
        "allowed": false,
        "codeGeneratedBy": "not_applicable",
        "approvalRequired": false,
        "scope": "none"
      },
      "x-default": null
    },
    {
      "fieldCode": "riskLevel",
      "label": "风险等级",
      "cardinality": "multi",
      "required": true,
      "values": [
        {
          "code": "unspecified",
          "label": "不设分风险等级",
          "status": "active"
        },
        {
          "code": "C1",
          "label": "C1",
          "status": "active"
        },
        {
          "code": "C2",
          "label": "C2",
          "status": "active"
        },
        {
          "code": "C3",
          "label": "C3",
          "status": "active"
        },
        {
          "code": "C4",
          "label": "C4",
          "status": "active"
        },
        {
          "code": "C5",
          "label": "C5",
          "status": "active"
        }
      ],
      "dependencyRules": [
        {
          "code": "exclusive_value",
          "valueCode": "unspecified"
        }
      ],
      "customProposals": {
        "allowed": false,
        "codeGeneratedBy": "not_applicable",
        "approvalRequired": false,
        "scope": "none"
      },
      "x-default": null
    },
    {
      "fieldCode": "businessScene",
      "label": "业务场景",
      "cardinality": "single",
      "required": true,
      "values": [
        {
          "code": "new_customer_service",
          "label": "新客服务",
          "status": "active"
        },
        {
          "code": "user_activation",
          "label": "用户激活",
          "status": "active"
        },
        {
          "code": "asset_promotion",
          "label": "资产提升",
          "status": "active"
        },
        {
          "code": "churn_retention",
          "label": "流失挽留",
          "status": "active"
        },
        {
          "code": "product_sales",
          "label": "产品销售",
          "status": "active"
        },
        {
          "code": "business_open",
          "label": "业务开通",
          "status": "active"
        },
        {
          "code": "user_operations",
          "label": "用户运营",
          "status": "active"
        }
      ],
      "customProposals": {
        "allowed": true,
        "codeGeneratedBy": "strategy_workbench",
        "approvalRequired": true,
        "scope": "workbench"
      },
      "x-default": null
    },
    {
      "fieldCode": "strategyType",
      "label": "策略类型",
      "cardinality": "multi",
      "required": true,
      "parentFieldCode": "businessScene",
      "values": [
        {
          "code": "new_customer_deposit",
          "label": "新客入金",
          "parentCode": "new_customer_service",
          "status": "active"
        },
        {
          "code": "tail_customer_operation",
          "label": "长尾客户运营策略",
          "parentCode": "user_activation",
          "status": "active"
        },
        {
          "code": "asset_downgrade_alert",
          "label": "资产降级预警",
          "parentCode": "asset_promotion",
          "status": "active"
        },
        {
          "code": "asset_upgrade_deposit",
          "label": "资产升级入金策略",
          "parentCode": "asset_promotion",
          "status": "active"
        },
        {
          "code": "asset_downgrade_defense",
          "label": "资产降级防御策略",
          "parentCode": "asset_promotion",
          "status": "active"
        },
        {
          "code": "customer_churn_alert",
          "label": "客户流失预警",
          "parentCode": "churn_retention",
          "status": "active"
        },
        {
          "code": "mass_customer_retention",
          "label": "大众客户防流失策略",
          "parentCode": "churn_retention",
          "status": "active"
        },
        {
          "code": "premium_customer_retention",
          "label": "高阶客户防流失策略",
          "parentCode": "churn_retention",
          "status": "active"
        },
        {
          "code": "value_added_tool_sales",
          "label": "增值工具销售策略",
          "parentCode": "product_sales",
          "status": "active"
        },
        {
          "code": "public_fund_sales",
          "label": "公募产品销售策略",
          "parentCode": "product_sales",
          "status": "active"
        },
        {
          "code": "premium_advisory_sales",
          "label": "高阶投顾销售策略",
          "parentCode": "product_sales",
          "status": "active"
        },
        {
          "code": "private_fund_sales",
          "label": "私募产品销售策略",
          "parentCode": "product_sales",
          "status": "active"
        },
        {
          "code": "asset_allocation_sales",
          "label": "资配产品销售策略",
          "parentCode": "product_sales",
          "status": "active"
        },
        {
          "code": "permission_100k_open",
          "label": "10万资产业务权限开通策略",
          "parentCode": "business_open",
          "status": "active"
        },
        {
          "code": "permission_500k_open",
          "label": "50万资产业务权限开通策略",
          "parentCode": "business_open",
          "status": "active"
        },
        {
          "code": "basic_service",
          "label": "基础服务策略",
          "parentCode": "user_operations",
          "status": "active"
        },
        {
          "code": "node_marketing",
          "label": "节点营销策略",
          "parentCode": "user_operations",
          "status": "active"
        },
        {
          "code": "wecom_operation",
          "label": "企业微信运营策略",
          "parentCode": "user_operations",
          "status": "active"
        },
        {
          "code": "wecom_migration",
          "label": "企微承接迁移策略",
          "parentCode": "user_operations",
          "status": "active"
        }
      ],
      "dependencyRules": [
        {
          "code": "parent_value_match"
        },
        {
          "code": "each_selected_parent_requires_child"
        }
      ],
      "customProposals": {
        "allowed": true,
        "codeGeneratedBy": "strategy_workbench",
        "approvalRequired": true,
        "scope": "workbench"
      },
      "x-default": null
    },
    {
      "fieldCode": "strategySubtype",
      "label": "策略子类",
      "cardinality": "free_text",
      "required": true,
      "customProposals": {
        "allowed": false,
        "codeGeneratedBy": "not_applicable",
        "approvalRequired": false,
        "scope": "none"
      },
      "x-default": null
    },
    {
      "fieldCode": "touchScene",
      "label": "触达场景",
      "cardinality": "multi",
      "required": true,
      "values": [
        {
          "code": "wecom",
          "label": "企业微信",
          "status": "active"
        },
        {
          "code": "app",
          "label": "APP触达",
          "status": "active"
        },
        {
          "code": "phone",
          "label": "电话触达",
          "status": "active"
        },
        {
          "code": "sms",
          "label": "短信触达",
          "status": "active"
        }
      ],
      "customProposals": {
        "allowed": true,
        "codeGeneratedBy": "strategy_workbench",
        "approvalRequired": true,
        "scope": "workbench"
      },
      "x-default": null
    },
    {
      "fieldCode": "touchMethod",
      "label": "触达方式",
      "cardinality": "multi",
      "required": true,
      "parentFieldCode": "touchScene",
      "values": [
        {
          "code": "wecom_clue_push",
          "label": "企微线索推送",
          "parentCode": "wecom",
          "status": "active"
        },
        {
          "code": "wecom_private_chat",
          "label": "企微私聊",
          "parentCode": "wecom",
          "status": "active"
        },
        {
          "code": "in_app_message",
          "label": "站内信",
          "parentCode": "app",
          "status": "active"
        },
        {
          "code": "popup",
          "label": "弹窗",
          "parentCode": "app",
          "status": "active"
        },
        {
          "code": "manual_phone",
          "label": "人工电话",
          "parentCode": "phone",
          "status": "active"
        },
        {
          "code": "ai_phone",
          "label": "AI电话",
          "parentCode": "phone",
          "status": "active"
        },
        {
          "code": "sms_notification",
          "label": "短信通知",
          "parentCode": "sms",
          "status": "active"
        }
      ],
      "dependencyRules": [
        {
          "code": "parent_value_match"
        },
        {
          "code": "each_selected_parent_requires_child"
        }
      ],
      "customProposals": {
        "allowed": true,
        "codeGeneratedBy": "strategy_workbench",
        "approvalRequired": true,
        "scope": "workbench"
      },
      "x-default": null
    }
  ]
}));
