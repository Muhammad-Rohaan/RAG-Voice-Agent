const BASE_URL = 'http://localhost:8000/api/akuh';

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
        credentials: 'include', // Crucial for cookie-based session auth
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.err || data.msg || data.error || 'Something went wrong');
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

    getMessages: () =>
        request('/ai/msgs'),
};
