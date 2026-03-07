// @ts-nocheck
import type { LayoutServerLoad } from './$types';

export const load = async ({ cookies }: Parameters<LayoutServerLoad>[0]) => {
    // Check for auth cookie on server side
    const accessToken = cookies.get('access_token');
    const refreshToken = cookies.get('refresh_token');

    return {
        isAuthenticated: !!(accessToken && refreshToken)
    };
};
