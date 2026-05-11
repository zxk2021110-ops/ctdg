// API 配置
const API_BASE_URL = 'https://758a3c7c.r7.cpolar.cn/api';

// API 客户端
const api = {
    // 注册
    async register(username, password) {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        return response.json();
    },

    // 登录
    async login(username, password) {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        return response.json();
    },

    // 验证 token
    async verifyToken(token) {
        const response = await fetch(`${API_BASE_URL}/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.json();
    },

    // 测试连接
    async test() {
        const response = await fetch(`${API_BASE_URL}/test`);
        return response.json();
    }
};
