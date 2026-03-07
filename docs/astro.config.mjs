import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const skipSitemap = () => ({
  name: '@astrojs/sitemap',
  hooks: {}
});

export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },
  integrations: [
    skipSitemap(),
    starlight({
      title: 'IndusBase Docs',
      description: "India's Postgres-native BaaS — documentation",
      logo: {
        src: './public/favicon.svg',
        alt: 'IndusBase'
      },
      social: {
        github: 'https://github.com/indusbase/indusbase',
        twitter: 'https://twitter.com/indusbase'
      },
      customCss: ['./src/styles/custom.css'],
      editLink: {
        baseUrl: 'https://github.com/indusbase/indusbase/edit/main/docs/'
      },
      head: [
        { tag: 'meta', attrs: { name: 'title', content: 'IndusBase - Supabase alternative for India' } },
        { tag: 'meta', attrs: { name: 'keywords', content: 'Open source BaaS India, Postgres backend India' } },
        { tag: 'meta', attrs: { property: 'og:title', content: 'IndusBase - Supabase alternative for India' } },
        { tag: 'meta', attrs: { property: 'og:description', content: 'Open source, self-hosted Postgres-native BaaS built for Indian developers with WhatsApp OTP, DPDP readiness, GraphQL, notifications, and feature flags.' } },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://docs.indusbase.com/og-image.png' } }
      ],
      sidebar: [
        {
          label: '🚀 Getting Started',
          items: [
            { label: 'Introduction', link: '/index' },
            { label: 'Docker Compose', link: '/self-hosting/docker-compose' },
            { label: 'Kubernetes', link: '/self-hosting/kubernetes' },
            { label: 'Environment Variables', link: '/self-hosting/environment-variables' }
          ]
        },
        {
          label: '🔐 Authentication',
          items: [
            { label: 'Overview', link: '/auth/overview' },
            { label: 'Email OTP', link: '/auth/email-otp' },
            { label: 'OAuth Providers', link: '/auth/oauth' },
            { label: '🇮🇳 WhatsApp OTP', link: '/auth/whatsapp-otp' },
            { label: '🇮🇳 Aadhaar eKYC', link: '/auth/aadhaar-ekyc' }
          ]
        },
        {
          label: '🗄️ Database',
          items: [
            { label: 'Overview', link: '/database/overview' },
            { label: 'REST API', link: '/database/rest-api' },
            { label: 'GraphQL', link: '/database/graphql' },
            { label: 'Row Level Security', link: '/database/rls' },
            { label: 'Migrations', link: '/database/migrations' }
          ]
        },
        {
          label: '⚡ Realtime',
          items: [
            { label: 'Overview', link: '/realtime/overview' },
            { label: 'Subscriptions', link: '/realtime/subscriptions' }
          ]
        },
        {
          label: '🗂️ Storage',
          items: [
            { label: 'Overview', link: '/storage/overview' },
            { label: 'Buckets', link: '/storage/buckets' },
            { label: 'Signed URLs', link: '/storage/signed-urls' }
          ]
        },
        {
          label: '⚙️ Edge Functions',
          items: [
            { label: 'Overview', link: '/edge-functions/overview' },
            { label: 'Writing Functions', link: '/edge-functions/writing-functions' }
          ]
        },
        {
          label: '🤖 AI & Vector Search',
          items: [
            { label: 'Overview', link: '/ai/overview' },
            { label: 'Vector Search', link: '/ai/vector-search' },
            { label: 'RAG Guide', link: '/ai/rag-guide' }
          ]
        },
        {
          label: '⚡ Job Queue',
          items: [
            { label: 'Overview', link: '/queue/overview' },
            { label: 'Jobs', link: '/queue/jobs' },
            { label: 'Webhooks', link: '/queue/webhooks' },
            { label: 'Cron', link: '/queue/cron' }
          ]
        },
        {
          label: '🔔 Notifications',
          items: [
            { label: 'Overview', link: '/notifications/overview' },
            { label: 'Push (FCM + APNs)', link: '/notifications/push' },
            { label: '🇮🇳 SMS (2Factor.in)', link: '/notifications/sms' },
            { label: 'Email', link: '/notifications/email' }
          ]
        },
        {
          label: '🚩 Feature Flags',
          items: [
            { label: 'Overview', link: '/feature-flags/overview' },
            { label: 'Targeting Rules', link: '/feature-flags/targeting' }
          ]
        },
        {
          label: '📦 SDKs',
          items: [
            { label: 'JavaScript / TypeScript', link: '/sdk/javascript' },
            { label: 'Python', link: '/sdk/python' }
          ]
        },
        {
          label: '🖥️ Studio',
          items: [
            { label: 'Overview', link: '/studio/overview' },
            { label: 'Onboarding', link: '/studio/onboarding' },
            { label: 'Project Switching', link: '/studio/project-switching' },
            { label: 'Admin Consoles', link: '/studio/admin-consoles' }
          ]
        },
        {
          label: '🏢 Enterprise',
          items: [
            { label: 'SSO (SAML + OIDC)', link: '/enterprise/sso' },
            { label: 'SCIM Provisioning', link: '/enterprise/scim' }
          ]
        },
        {
          label: '💳 Billing',
          items: [
            { label: 'Overview', link: '/billing/overview' },
            { label: 'Usage Metering', link: '/billing/usage-metering' }
          ]
        },
        {
          label: '🔐 Secrets',
          items: [
            { label: 'Overview', link: '/secrets/overview' },
            { label: 'Rotation', link: '/secrets/rotation' }
          ]
        },
        {
          label: '🛠️ Operations',
          items: [
            { label: 'Incidents', link: '/operations/incidents' },
            { label: 'Release Management', link: '/operations/release-management' },
            { label: 'Security Scanning', link: '/operations/security-scanning' },
            { label: 'Support Console', link: '/operations/support-console' },
            { label: 'Backup & Restore', link: '/self-hosting/backup-restore' }
          ]
        },
        {
          label: '🛡️ Trust Center',
          items: [
            { label: 'Overview', link: '/trust-center/overview' },
            { label: 'Security', link: '/trust-center/security' },
            { label: 'Compliance', link: '/trust-center/compliance' },
            { label: 'Subprocessors', link: '/trust-center/subprocessors' },
            { label: 'Availability', link: '/trust-center/availability' },
            { label: 'Responsible Disclosure', link: '/trust-center/responsible-disclosure' },
            { label: 'Security Scanning', link: '/trust-center/security-scanning' }
          ]
        },
        {
          label: '🛡️ Compliance',
          items: [
            { label: '🇮🇳 DPDP 2023', link: '/compliance/dpdp' },
            { label: '🇮🇳 Data Localization', link: '/compliance/data-localization' }
          ]
        },
        {
          label: '📖 Reference',
          items: [
            { label: 'API Reference', link: '/reference/api' },
            { label: 'CLI Reference', link: '/reference/cli' }
          ]
        }
      ]
    })
  ],
  site: 'https://docs.indusbase.com'
});
