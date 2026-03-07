import { e as escape_html, a as attr_class, c as attr_style, d as ensure_array_like, s as stringify } from "../../../../chunks/index2.js";
import { B as Button } from "../../../../chunks/Button.js";
import { B as Badge } from "../../../../chunks/Badge.js";
import "../../../../chunks/toast.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let complianceScore = 72;
    let daysUntilDeadline = 0;
    const lawfulProcessingItems = [
      {
        id: "lp1",
        name: "Consent Management System",
        status: "completed",
        section: "4"
      },
      {
        id: "lp2",
        name: "Legitimate Use Documentation",
        status: "completed",
        section: "4"
      },
      {
        id: "lp3",
        name: "State Function Compliance",
        status: "pending",
        section: "4"
      },
      {
        id: "lp4",
        name: "Employment Purpose Tracking",
        status: "completed",
        section: "4"
      }
    ];
    const consentItems = [
      {
        id: "c1",
        name: "Granular Consent Capture",
        status: "completed",
        section: "6"
      },
      {
        id: "c2",
        name: "Consent Withdrawal Mechanism",
        status: "completed",
        section: "6"
      },
      {
        id: "c3",
        name: "Consent Audit Trail",
        status: "completed",
        section: "6"
      },
      {
        id: "c4",
        name: "Parental Consent for Minors",
        status: "pending",
        section: "6"
      }
    ];
    const dataQualityItems = [
      {
        id: "dq1",
        name: "Data Accuracy Procedures",
        status: "completed",
        section: "8"
      },
      {
        id: "dq2",
        name: "Data Completeness Checks",
        status: "in_progress",
        section: "8"
      },
      {
        id: "dq3",
        name: "Data Update Mechanisms",
        status: "completed",
        section: "8"
      }
    ];
    const accessRightsItems = [
      {
        id: "ar1",
        name: "Data Portability Interface",
        status: "completed",
        section: "11"
      },
      {
        id: "ar2",
        name: "Processing Disclosure",
        status: "completed",
        section: "11"
      },
      {
        id: "ar3",
        name: "Identity Verification for Access",
        status: "completed",
        section: "11"
      }
    ];
    const correctionItems = [
      {
        id: "ce1",
        name: "Data Correction Workflow",
        status: "completed",
        section: "12"
      },
      {
        id: "ce2",
        name: "Data Erasure (Right to be Forgotten)",
        status: "completed",
        section: "12"
      },
      {
        id: "ce3",
        name: "Completion Request Handling",
        status: "pending",
        section: "12"
      }
    ];
    const breachItems = [
      {
        id: "bn1",
        name: "Breach Detection System",
        status: "in_progress",
        section: "17"
      },
      {
        id: "bn2",
        name: "Board Notification (72 hours)",
        status: "pending",
        section: "17"
      },
      {
        id: "bn3",
        name: "Data Principal Notification",
        status: "pending",
        section: "17"
      }
    ];
    const childrenItems = [
      {
        id: "cd1",
        name: "Age Verification System",
        status: "pending",
        section: "9"
      },
      {
        id: "cd2",
        name: "Parental Consent Workflow",
        status: "pending",
        section: "9"
      },
      {
        id: "cd3",
        name: "Behavioral Monitoring Prohibition",
        status: "completed",
        section: "9"
      }
    ];
    const localizationItems = [
      {
        id: "dl1",
        name: "Financial Data in India",
        status: "completed",
        section: "RBI"
      },
      {
        id: "dl2",
        name: "Payment Data Localization",
        status: "completed",
        section: "RBI"
      },
      {
        id: "dl3",
        name: "SEBI Sensitive Data Storage",
        status: "in_progress",
        section: "SEBI"
      },
      {
        id: "dl4",
        name: "Cross-border Transfer Auditing",
        status: "completed",
        section: "RBI"
      }
    ];
    const allItems = [
      ...lawfulProcessingItems,
      ...consentItems,
      ...dataQualityItems,
      ...accessRightsItems,
      ...correctionItems,
      ...breachItems,
      ...childrenItems,
      ...localizationItems
    ];
    const quickActions = [
      {
        id: "erasure",
        title: "Data Erasure Requests",
        description: "Process right to be forgotten requests",
        icon: "🗑️",
        count: 3,
        color: "red"
      },
      {
        id: "consent",
        title: "Consent Management",
        description: "Review and manage user consents",
        icon: "✅",
        count: 15234,
        color: "blue"
      },
      {
        id: "breach",
        title: "Breach Notifications",
        description: "Report and track data breaches",
        icon: "🚨",
        count: 0,
        color: "orange"
      },
      {
        id: "audit",
        title: "Audit Log Export",
        description: "Export compliance audit logs",
        icon: "📋",
        count: null,
        color: "green"
      }
    ];
    function getStatusColor(status) {
      switch (status) {
        case "completed":
          return "green";
        case "in_progress":
          return "yellow";
        case "pending":
          return "gray";
        default:
          return "gray";
      }
    }
    function getStatusLabel(status) {
      switch (status) {
        case "completed":
          return "Completed";
        case "in_progress":
          return "In Progress";
        case "pending":
          return "Pending";
        default:
          return status;
      }
    }
    function getScoreColor(score) {
      return "text-yellow-600";
    }
    $$renderer2.push(`<div class="space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-gray-900">DPDP Compliance Center</h1> <p class="text-sm text-gray-500 mt-1">Digital Personal Data Protection Act, 2023 Compliance Dashboard</p></div> <div class="flex items-center gap-3"><span class="text-sm text-gray-500">Last Audit: 2024-03-01</span> `);
    Button($$renderer2, {
      variant: "secondary",
      size: "sm",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->Export Report`);
      }
    });
    $$renderer2.push(`<!----></div></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3"><span class="text-2xl">⚠️</span> <div class="flex-1"><h3 class="font-semibold text-orange-900">Compliance Deadline Approaching</h3> <p class="text-sm text-orange-700">Full DPDP compliance required by May 15, 2027. <span class="font-semibold">${escape_html(daysUntilDeadline)} days remaining.</span></p></div> `);
      Button($$renderer2, {
        variant: "primary",
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->View Action Plan`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="grid grid-cols-1 md:grid-cols-4 gap-4"><div class="md:col-span-1"><div class="bg-white rounded-lg border border-gray-200 p-6 text-center"><div class="text-sm font-medium text-gray-500 mb-2">Compliance Score</div> <div${attr_class(`text-5xl font-bold ${stringify(getScoreColor())} mb-2`)}>72%</div> <div class="w-full bg-gray-200 rounded-full h-2 mb-2"><div${attr_class(`h-2 rounded-full transition-all duration-500 ${stringify("bg-yellow-500")}`)}${attr_style(`width: ${stringify(complianceScore)}%`)}></div></div> <div class="text-xs text-gray-500">${escape_html(allItems.filter((i) => i.status === "completed").length)} of ${escape_html(allItems.length)} requirements met</div></div></div> <div class="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4"><div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-2xl font-bold text-green-600">${escape_html(allItems.filter((i) => i.status === "completed").length)}</div> <div class="text-sm text-gray-500">Completed</div></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-2xl font-bold text-yellow-600">${escape_html(allItems.filter((i) => i.status === "in_progress").length)}</div> <div class="text-sm text-gray-500">In Progress</div></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-2xl font-bold text-gray-600">${escape_html(allItems.filter((i) => i.status === "pending").length)}</div> <div class="text-sm text-gray-500">Pending</div></div> <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-2xl font-bold text-blue-600">8</div> <div class="text-sm text-gray-500">DPDP Sections</div></div></div></div> <div><h2 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2> <div class="grid grid-cols-1 md:grid-cols-4 gap-4"><!--[-->`);
    const each_array = ensure_array_like(quickActions);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let action = each_array[$$index];
      $$renderer2.push(`<button class="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-400 hover:shadow-md transition-all group"><div class="flex items-start justify-between mb-2"><span class="text-2xl">${escape_html(action.icon)}</span> `);
      if (action.count !== null) {
        $$renderer2.push("<!--[0-->");
        Badge($$renderer2, {
          variant: action.count > 0 ? "red" : "green",
          children: ($$renderer3) => {
            $$renderer3.push(`<!---->${escape_html(action.count)}`);
          }
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <h3 class="font-semibold text-gray-900 group-hover:text-blue-600">${escape_html(action.title)}</h3> <p class="text-sm text-gray-500 mt-1">${escape_html(action.description)}</p></button>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="grid grid-cols-1 lg:grid-cols-2 gap-6"><div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 4: Lawful Processing</h3> `);
    Badge($$renderer2, {
      variant: lawfulProcessingItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(lawfulProcessingItems.filter((i) => i.status === "completed").length)}/${escape_html(lawfulProcessingItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_1 = ensure_array_like(lawfulProcessingItems);
    for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
      let item = each_array_1[$$index_1];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 6: Consent Management</h3> `);
    Badge($$renderer2, {
      variant: consentItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(consentItems.filter((i) => i.status === "completed").length)}/${escape_html(consentItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_2 = ensure_array_like(consentItems);
    for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
      let item = each_array_2[$$index_2];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 8: Data Quality</h3> `);
    Badge($$renderer2, {
      variant: dataQualityItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(dataQualityItems.filter((i) => i.status === "completed").length)}/${escape_html(dataQualityItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_3 = ensure_array_like(dataQualityItems);
    for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
      let item = each_array_3[$$index_3];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 11: Right to Access</h3> `);
    Badge($$renderer2, {
      variant: accessRightsItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(accessRightsItems.filter((i) => i.status === "completed").length)}/${escape_html(accessRightsItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_4 = ensure_array_like(accessRightsItems);
    for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
      let item = each_array_4[$$index_4];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 12: Right to Correction/Erasure</h3> `);
    Badge($$renderer2, {
      variant: correctionItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(correctionItems.filter((i) => i.status === "completed").length)}/${escape_html(correctionItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_5 = ensure_array_like(correctionItems);
    for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
      let item = each_array_5[$$index_5];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 17: Data Breach Notification</h3> `);
    Badge($$renderer2, {
      variant: breachItems.every((i) => i.status === "completed") ? "green" : "red",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(breachItems.filter((i) => i.status === "completed").length)}/${escape_html(breachItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_6 = ensure_array_like(breachItems);
    for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
      let item = each_array_6[$$index_6];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Section 9: Children's Data Protection</h3> `);
    Badge($$renderer2, {
      variant: childrenItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(childrenItems.filter((i) => i.status === "completed").length)}/${escape_html(childrenItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_7 = ensure_array_like(childrenItems);
    for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
      let item = each_array_7[$$index_7];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="bg-white rounded-lg border border-gray-200 p-6"><div class="flex items-center justify-between mb-4"><h3 class="font-semibold text-gray-900">Data Localization (RBI/SEBI Mandate)</h3> `);
    Badge($$renderer2, {
      variant: localizationItems.every((i) => i.status === "completed") ? "green" : "yellow",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(localizationItems.filter((i) => i.status === "completed").length)}/${escape_html(localizationItems.length)}`);
      }
    });
    $$renderer2.push(`<!----></div> <div class="space-y-2"><!--[-->`);
    const each_array_8 = ensure_array_like(localizationItems);
    for (let $$index_8 = 0, $$length = each_array_8.length; $$index_8 < $$length; $$index_8++) {
      let item = each_array_8[$$index_8];
      $$renderer2.push(`<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"><div class="flex items-center gap-2"><span class="text-sm text-gray-700">${escape_html(item.name)}</span> `);
      Badge($$renderer2, {
        variant: "gray",
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(item.section)}`);
        }
      });
      $$renderer2.push(`<!----></div> `);
      Badge($$renderer2, {
        variant: getStatusColor(item.status),
        size: "sm",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(getStatusLabel(item.status))}`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div> <div class="bg-blue-50 border border-blue-200 rounded-lg p-6"><h3 class="font-semibold text-blue-900 mb-2">DPDP Compliance Resources</h3> <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm"><a href="https://www.meity.gov.in/data-protection-framework" target="_blank" class="text-blue-700 hover:underline">📄 Official DPDP Act, 2023</a> <a href="https://www.meity.gov.in/writereaddata/files/DPDP_Rules_2024.pdf" target="_blank" class="text-blue-700 hover:underline">📄 DPDP Rules, 2024</a> <a href="https://www.digitalpersonaldataprotection.in/" target="_blank" class="text-blue-700 hover:underline">ℹ️ Data Protection Board of India</a></div></div></div>`);
  });
}
export {
  _page as default
};
