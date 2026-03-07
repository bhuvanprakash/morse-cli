const load = async ({ cookies }) => {
  const accessToken = cookies.get("access_token");
  const refreshToken = cookies.get("refresh_token");
  return {
    isAuthenticated: !!(accessToken && refreshToken)
  };
};
export {
  load
};
