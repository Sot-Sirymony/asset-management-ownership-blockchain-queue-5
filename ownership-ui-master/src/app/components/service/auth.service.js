export const loginService = async (user) => {
    const { username, password } = user;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";
    let res;
    try {
        res = await fetch(`${apiUrl}/rest/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        }, { next: { tag: ["loginService"] } });
    } catch (err) {
        throw new Error("Cannot reach API at " + apiUrl + ". Is the API running? " + (err?.message || ""));
    }
    const text = await res.text();
    let errorMsg = "Login failed";
    if (!res.ok) {
        try {
            const errorData = text ? JSON.parse(text) : {};
            errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch (_) {
            if (res.status === 401) errorMsg = "Invalid username or password.";
            else if (res.status === 404) errorMsg = "User not found or API endpoint changed.";
            else if (res.status >= 500) errorMsg = "API error. Check if the API is running at " + apiUrl + ".";
        }
        throw new Error(errorMsg);
    }
    const data = text ? JSON.parse(text) : {};
    return data;
};