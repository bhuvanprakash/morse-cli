<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { apiClient } from '$api/client';
	import { contextStore } from '$lib/stores/context';
	import { auth } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import { confirmDialog } from '$lib/stores/confirm';
	import CopyButton from '$lib/components/studio/CopyButton.svelte';
	import { getDocsUrl } from '$lib/utils/urls';

	type CreatedProject = {
		id: string;
		anon_key: string;
		service_role_key: string;
		slug: string;
		region?: string;
	};

	let step = $state(1);
	const TOTAL_STEPS = 5;

	let projectName = $state('my-first-app');
	let creating = $state(false);
	let loading = $state(false);
	let error = $state('');
	let createdProject = $state<CreatedProject | null>(null);
	let snippetTab = $state<'curl' | 'js' | 'py'>('curl');
	let copied = $state<'anon' | 'service' | ''>('');

	const projectSlug = $derived.by(() =>
		projectName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
	);

	const hasExistingProjects = $derived.by(() => contextStore.projects.length > 0);
	const apiBaseUrl = $derived.by(() => apiClient.getBaseUrl());

	function clearError() {
		error = '';
	}

	async function ensureOrganization(): Promise<string> {
		const orgs = await studioApi.listOrganizations();
		if (Array.isArray(orgs) && orgs.length > 0) {
			return String(orgs[0].id);
		}
		if (orgs && !Array.isArray(orgs) && orgs.id) {
			return String(orgs.id);
		}

		const emailPrefix = String(auth.user?.email || 'org').split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '') || 'default-org';
		const slug = `${emailPrefix}-org`.slice(0, 30).replace(/^-|-$/g, '') || 'default-org';
		const created = await studioApi.createOrganization({
			name: 'My Organization',
			slug,
			owner_email: auth.user?.email || 'owner@indusbase.local'
		});
		return String(created.id);
	}

	async function createProject() {
		if (projectSlug.length < 3) {
			error = 'Project name must generate a slug with at least 3 characters.';
			return;
		}
		creating = true;
		clearError();
		try {
			const orgId = await ensureOrganization();
			const project = await studioApi.createProject({
				name: projectName.trim(),
				slug: projectSlug,
				org_id: orgId,
				region: 'ap-south-1'
			});
			createdProject = {
				id: String(project.id),
				anon_key: String(project.anon_key || ''),
				service_role_key: String(project.service_role_key || ''),
				slug: String(project.slug || projectSlug),
				region: String(project.region || 'ap-south-1')
			};

			if (createdProject.anon_key) {
				localStorage.setItem('active_project_anon_key', createdProject.anon_key);
			}
			if (createdProject.service_role_key) {
				localStorage.setItem('active_project_service_role_key', createdProject.service_role_key);
			}
			await contextStore.load();
			contextStore.setActiveProject(createdProject.id);
			step = 3;
			toastStore.success('Project created successfully');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Project creation failed';
			toastStore.error(error);
		} finally {
			creating = false;
		}
	}

	async function retryCreateProject() {
		const ok = await confirmDialog.open({
			title: 'Retry Project Creation',
			message: 'Retry creating your first project now?',
			confirmText: 'Retry'
		});
		if (!ok) return;
		await createProject();
	}

	function copyKey(kind: 'anon' | 'service') {
		copied = kind;
		setTimeout(() => {
			if (copied === kind) copied = '';
		}, 1200);
	}

	function finishOnboarding() {
		localStorage.setItem('onboarding_complete', 'true');
		goto('/dashboard');
	}

	async function skipForNow() {
		const ok = await confirmDialog.open({
			title: 'Skip Onboarding',
			message: 'You can complete setup later from the dashboard. Continue now?',
			confirmText: 'Skip for now'
		});
		if (!ok) return;
		localStorage.setItem('onboarding_complete', 'true');
		if (contextStore.projects.length > 0) {
			goto('/dashboard');
		} else {
			goto('/settings');
		}
	}

	onMount(async () => {
		loading = true;
		try {
			await contextStore.ensureLoaded();
			if (hasExistingProjects && !createdProject) {
				step = 1;
			}
		} finally {
			loading = false;
		}
	});
</script>

<div class="wizard-wrap" data-testid="onboarding-page">
	<div class="wizard-card">
		<div class="progress">
			{#each Array(TOTAL_STEPS) as _, i}
				<div class="bar {i < step ? 'active' : ''}"></div>
			{/each}
			<span>{step}/{TOTAL_STEPS}</span>
		</div>

		{#if step === 1}
			<section class="step">
				<h1>Welcome to IndusBase</h1>
				<p>India-first Postgres-native BaaS for production apps. Default region: <code>ap-south-1</code> • Timezone: IST.</p>
				<pre>indus-gate  :8000  API Gateway
indus-auth  :8001  Auth + WhatsApp OTP + Enterprise SSO
indus-query :8002  REST + GraphQL
indus-live  :8004  Realtime
indus-store :8005  Object Storage
indus-ai    :8007  Vector Search
indus-queue :8008  Jobs + Webhooks + Cron
indus-notify:8009  Push + SMS + Email
indus-config:8010  Feature Flags + Remote Config</pre>
				<div class="actions">
					<button class="primary" onclick={() => (step = 2)} disabled={loading} data-testid="onboarding-start">Start Onboarding</button>
					<button class="secondary" onclick={skipForNow}>Skip for now</button>
				</div>
			</section>
		{/if}

		{#if step === 2}
			<section class="step">
				<h2>Create your first project</h2>
				<p class="muted">This provisions isolated project schema, API keys, and control-plane context.</p>
				<label for="project_name">Project Name</label>
				<input id="project_name" bind:value={projectName} placeholder="my-awesome-app" data-testid="project-name-input" />
				<label for="project_slug">Slug</label>
				<input id="project_slug" disabled value={projectSlug} />
				{#if error}<p class="error">{error}</p>{/if}
				<div class="actions">
					<button class="primary" disabled={creating || projectSlug.length < 3} onclick={createProject} data-testid="create-project-submit">
						{creating ? 'Creating project...' : 'Create Project'}
					</button>
					{#if error}
						<button class="secondary" onclick={retryCreateProject}>Retry</button>
					{/if}
					<button class="secondary" onclick={skipForNow}>Skip for now</button>
				</div>
			</section>
		{/if}

		{#if step === 3}
			<section class="step">
				<h2>Project created successfully</h2>
				<p>Keys are shown once in onboarding. Keep service role key server-side only.</p>

				<div class="codebox">
					<div class="box-head">
						<p>Anon Key (public)</p>
						<CopyButton value={createdProject?.anon_key || ''} label={copied === 'anon' ? 'Copied' : 'Copy'} testId="copy-anon-key" />
					</div>
					<code>{createdProject?.anon_key}</code>
				</div>

				<div class="codebox">
					<div class="box-head">
						<p>Service Role Key (private)</p>
						<CopyButton value={createdProject?.service_role_key || ''} label={copied === 'service' ? 'Copied' : 'Copy'} testId="copy-service-role-key" />
					</div>
					<code>{createdProject?.service_role_key}</code>
				</div>

				<div class="tabs">
					<button class:active={snippetTab === 'curl'} onclick={() => (snippetTab = 'curl')}>curl</button>
					<button class:active={snippetTab === 'js'} onclick={() => (snippetTab = 'js')}>JavaScript</button>
					<button class:active={snippetTab === 'py'} onclick={() => (snippetTab = 'py')}>Python</button>
				</div>

				{#if snippetTab === 'curl'}
					<pre>curl "{apiBaseUrl}/rest/public/users?limit=1" \\
  -H "apikey: {createdProject?.anon_key?.slice(0, 20)}..."</pre>
				{/if}
				{#if snippetTab === 'js'}
					<pre>import &#123; createClient &#125; from 'indusbase-js'
const client = createClient('{apiBaseUrl}', '{createdProject?.anon_key?.slice(0, 20)}...')
const &#123; data &#125; = await client.from('users').select('*').limit(1)</pre>
				{/if}
				{#if snippetTab === 'py'}
					<pre>from indusbase import create_client
client = create_client("{apiBaseUrl}", "{createdProject?.anon_key?.slice(0, 20)}...")
print(client.table("users").select("*").limit(1).execute())</pre>
				{/if}

				<div class="actions">
					<button class="primary" onclick={() => { copyKey('anon'); step = 4; }}>Next: Notifications</button>
				</div>
			</section>
		{/if}

		{#if step === 4}
			<section class="step">
				<h2>Set up notifications</h2>
				<ul>
					<li>✅ <code>TWOFACTOR_API_KEY</code> for India DLT SMS</li>
					<li>✅ <code>TWOFACTOR_SENDER_ID</code> DLT sender ID</li>
					<li>✅ <code>FCM_CREDENTIALS_JSON</code> for Android/Web push</li>
					<li>✅ <code>SENDGRID_API_KEY</code> or SMTP credentials for email</li>
					<li>✅ <code>APNS_KEY_P8</code> for iOS push (optional)</li>
				</ul>
				<p>Add provider keys to <code>.env</code> and restart your stack to enable channels.</p>
				<div class="actions">
					<button class="primary" onclick={() => (step = 5)}>Next: Go Live</button>
					<a class="secondary-link" href={getDocsUrl('/notifications/overview')} target="_blank" rel="noreferrer">Open notification docs</a>
				</div>
			</section>
		{/if}

		{#if step === 5}
			<section class="step">
				<h2>You're ready to launch</h2>
				<p>Project context is active and your control plane is ready for first users.</p>
				<div class="links">
					<a href="/dashboard">📊 Dashboard</a>
					<a href="/table-editor">🗄️ Table Editor</a>
					<a href="/notifications">🔔 Notifications</a>
					<a href="/flags">🚩 Feature Flags</a>
					<a href="/ai">🤖 AI Search</a>
					<a href={getDocsUrl()} target="_blank" rel="noreferrer">📖 Documentation</a>
				</div>
				<div class="actions">
					<button class="primary" onclick={finishOnboarding}>Open Dashboard</button>
					<button class="secondary" onclick={skipForNow}>Finish later</button>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.wizard-wrap {
		min-height: calc(100vh - 2rem);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: linear-gradient(135deg, #fff7ed 0%, #fff 35%, #f8fafc 100%);
	}
	.wizard-card {
		width: min(940px, 100%);
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 18px;
		padding: 1.5rem;
		box-shadow: 0 20px 40px rgba(2, 6, 23, 0.08);
	}
	.progress {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.bar {
		flex: 1;
		height: 8px;
		background: #e5e7eb;
		border-radius: 999px;
	}
	.bar.active {
		background: #f97316;
	}
	.step h1,
	.step h2 {
		margin: 0 0 0.65rem;
		color: #111827;
	}
	.step p {
		color: #475569;
		margin: 0 0 1rem;
	}
	.step .muted {
		font-size: 0.9rem;
		color: #64748b;
	}
	pre {
		background: #0f172a;
		color: #e2e8f0;
		padding: 0.75rem;
		border-radius: 10px;
		overflow: auto;
		font-size: 0.8rem;
	}
	label {
		display: block;
		margin: 0.4rem 0 0.2rem;
		font-size: 0.85rem;
		color: #374151;
	}
	input {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		margin-bottom: 0.5rem;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		margin-top: 0.75rem;
	}
	.primary {
		background: #ea580c;
		color: #fff;
		border: 0;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
	}
	.primary:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.secondary {
		border: 1px solid #d1d5db;
		background: #fff;
		color: #334155;
		padding: 0.6rem 0.9rem;
		border-radius: 10px;
		cursor: pointer;
	}
	.secondary-link {
		color: #ea580c;
		font-size: 0.9rem;
		text-decoration: none;
	}
	.secondary-link:hover {
		text-decoration: underline;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}
	.tabs button {
		border: 1px solid #d1d5db;
		background: #fff;
		border-radius: 8px;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
	}
	.tabs button.active {
		border-color: #f97316;
		color: #ea580c;
	}
	.codebox {
		background: #f8fafc;
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		padding: 0.65rem;
		margin-bottom: 0.6rem;
	}
	.box-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.35rem;
	}
	.codebox p {
		margin: 0;
		font-size: 0.75rem;
		color: #6b7280;
	}
	.codebox code {
		font-size: 0.75rem;
		overflow-wrap: anywhere;
	}
	.links {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.links a {
		border: 1px solid #d1d5db;
		border-radius: 10px;
		padding: 0.75rem;
		text-decoration: none;
		color: #111827;
	}
	.error {
		color: #dc2626;
		font-size: 0.85rem;
	}
	ul {
		padding-left: 1.1rem;
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}
</style>
