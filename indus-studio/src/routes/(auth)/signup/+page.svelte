<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$stores/auth';
	import { Button, Input } from '$components/ui';
	import { toastStore } from '$stores/toast';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let passwordError = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		
		// Validate passwords match
		if (password !== confirmPassword) {
			passwordError = 'Passwords do not match';
			return;
		}
		
		if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters';
			return;
		}
		
		passwordError = '';
		loading = true;

		const success = await auth.signup(email, password);
		
		if (success) {
			toastStore.success('Account created!');
			goto('/dashboard');
		} else {
			toastStore.error(auth.error || 'Signup failed');
		}
		
		loading = false;
	}
</script>

<div class="min-h-screen bg-surface-1 flex items-center justify-center p-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-surface-12">Create Account</h1>
			<p class="mt-2 text-surface-10">Sign up for IndusBase</p>
		</div>

		<form onsubmit={handleSubmit} class="space-y-6 bg-surface-2 p-8 rounded-xl border border-surface-6">
			<Input
				label="Email"
				type="email"
				bind:value={email}
				placeholder="you@example.com"
				required
			/>

			<Input
				label="Password"
				type="password"
				bind:value={password}
				placeholder="••••••••"
				required
			/>

			<Input
				label="Confirm Password"
				type="password"
				bind:value={confirmPassword}
				placeholder="••••••••"
				error={passwordError}
				required
			/>

			<Button type="submit" variant="primary" fullWidth {loading}>
				Create Account
			</Button>
		</form>

		<p class="text-center text-sm text-surface-10">
			Already have an account?
			<a href="/login" class="text-accent-9 hover:underline">Sign in</a>
		</p>
	</div>
</div>
