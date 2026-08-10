const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';


async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        credentials: 'include',
    };

    try {
        const response = await fetch(url, config);
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            throw new Error(`Server returned non-JSON response (HTTP ${response.status}): ${text.substring(0, 200)}`);
        }
        if (!response.ok) {
            throw new Error(data.err || data.msg || data.error || `HTTP ${response.status}: Something went wrong`);
        }
        return data;
    } catch (error) {
        console.error(`API Request Error [${path}]:`, error);
        throw error;
    }
}

export const api = {
    register: (username, email, password) => 
        request('/auth/register-user', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
        }),

    login: (email, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        }),

    googleAuth: (token) =>
        request('/auth/google', {
            method: 'POST',
            body: JSON.stringify({ token }),
        }),

    logout: () =>
        request('/auth/logout', {
            method: 'POST',
        }),

    getUsers: () =>
        request('/auth/users'),

    sendMessage: (userQuery) =>
        request('/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ userQuery }),
        }),

    startVoiceSession: (userQuery) =>
        request('/ai/voice/start-session', {
            method: 'POST',
            body: JSON.stringify({ userQuery }),
        }),


    getMessages: () =>
        request('/ai/msgs'),
};

