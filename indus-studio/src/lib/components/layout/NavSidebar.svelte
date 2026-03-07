<script lang="ts">
	import { page } from '$app/stores';
	import { Sidebar, type SidebarItem } from '$components/ui';
	import { auth } from '$stores/auth';
	import { contextStore } from '$lib/stores/context';

	let currentPath = $derived($page.url.pathname);
	const isAdmin = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});
	const hasProject = $derived.by(() => !!contextStore.activeProjectId);
	const navItems = $derived.by<SidebarItem[]>(() => [
		{
			label: 'Control Plane',
			icon: '◈',
			children: [
				{
					label: 'Dashboard',
					href: '/dashboard',
					icon: '📊',
					active: currentPath === '/dashboard'
				},
				{
					label: 'Onboarding',
					href: '/onboarding',
					icon: '✨',
					active: currentPath === '/onboarding',
					badge: hasProject ? undefined : 'setup'
				},
				{
					label: 'Settings',
					href: '/settings',
					icon: '⚙️',
					active: currentPath === '/settings'
				}
			]
		},
		{
			label: 'Build',
			icon: '⬢',
			children: [
				{
					label: 'Table Editor',
					href: '/table-editor',
					icon: '📋',
					active: currentPath.startsWith('/table-editor')
				},
				{
					label: 'SQL Editor',
					href: '/sql-editor',
					icon: '⌨️',
					active: currentPath === '/sql-editor'
				},
				{
					label: 'Realtime',
					href: '/realtime',
					icon: '📡',
					active: currentPath === '/realtime'
				},
				{
					label: 'Storage',
					href: '/storage',
					icon: '📁',
					active: currentPath === '/storage'
				},
				{
					label: 'AI Search',
					href: '/ai',
					icon: '🤖',
					active: currentPath === '/ai'
				}
			]
		},
		{
			label: 'Operate',
			icon: '⬣',
			children: [
				{
					label: 'Auth Users',
					href: '/auth-users',
					icon: '🔐',
					active: currentPath === '/auth-users'
				},
				{
					label: 'Job Queue',
					href: '/queue',
					icon: '⚡',
					active: currentPath === '/queue'
				},
				{
					label: 'Notifications',
					href: '/notifications',
					icon: '🔔',
					active: currentPath === '/notifications'
				},
				{
					label: 'Feature Flags',
					href: '/flags',
					icon: '🚩',
					active: currentPath === '/flags'
				},
				{
					label: 'Secrets',
					href: '/secrets',
					icon: '🔏',
					active: currentPath === '/secrets'
				},
				{
					label: 'Status',
					href: '/status',
					icon: '📈',
					active: currentPath === '/status'
				},
				{
					label: 'Billing',
					href: '/billing',
					icon: '💳',
					active: currentPath === '/billing'
				}
			]
		},
		{
			label: 'Govern',
			icon: '⬡',
			children: [
				{
					label: 'Audit Logs',
					href: '/audit',
					icon: '📜',
					active: currentPath === '/audit'
				},
				{
					label: 'Enterprise SSO',
					href: '/enterprise/sso',
					icon: '🏢',
					active: currentPath.startsWith('/enterprise/sso')
				},
				{
					label: 'DPDP Compliance',
					href: '/dpdp',
					icon: '🛡️',
					active: currentPath === '/dpdp'
				},
				...(isAdmin
					? [
							{
								label: 'Trust Center',
								href: '/trust-center',
								icon: '🧾',
								active: currentPath === '/trust-center'
							},
							{
								label: 'Security',
								href: '/security',
								icon: '🛡️',
								active: currentPath === '/security'
							},
							{
								label: 'Support',
								href: '/support',
								icon: '🧰',
								active: currentPath === '/support'
							}
						]
					: [])
			]
		}
	]);
</script>

<Sidebar items={navItems} />
