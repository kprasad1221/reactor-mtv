export const key = "rk_OFFLINE_TEST_ONLY";
export const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
export function fakeProvider({
  terminal = "CLOSED",
  tokenStatus = 200,
  createStatus = 200,
  holdToken,
  holdCreate,
  throwCreate = false,
} = {}) {
  const calls = [];
  const request = async (url, options = {}) => {
    const path = new URL(url).pathname,
      method = options.method || "GET";
    calls.push({ path, method, ...options });
    if (path === "/tokens") {
      if (holdToken) await holdToken;
      return reply(
        {
          jwt: "offline-scoped-token",
          expires_at: Math.floor(Date.now() / 1000) + 120,
        },
        tokenStatus,
      );
    }
    if (path === "/sessions") {
      if (holdCreate) await holdCreate;
      if (throwCreate) throw Error("Network failed after send");
      return reply(
        { session_id: "test-session", state: "PENDING" },
        createStatus,
      );
    }
    if (method === "DELETE") return reply({});
    if (path === "/sessions/test-session") return reply({ state: terminal });
    throw Error("Unexpected provider request");
  };
  return { request, calls };
}
export const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
