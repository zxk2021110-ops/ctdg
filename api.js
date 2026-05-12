// ============================================================
// 宠物之家 - API 客户端（安全增强版）
// ============================================================

// API 配置
const API_BASE_URL = 'https://47901c7a.r28.cpolar.top/api';

// 安全检查：确保 Security 模块已加载
if (typeof Security === 'undefined') {
    console.error('安全模块未加载，请确保 security.js 已正确引入');
}

// API 客户端
const api = {
    // ============================
    // 通用请求方法
    // ============================

    /**
     * 安全的请求封装
     * @param {string} endpoint - API 端点
     * @param {Object} options - 请求选项
     * @returns {Promise} 响应数据
     */
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;

        // 默认选项
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Time': Date.now().toString()
            }
        };

        // 添加 CSRF Token
        if (typeof Security !== 'undefined') {
            defaultOptions.headers['X-CSRF-Token'] = Security.getCSRFToken();
        }

        // 添加认证 Token
        const token = this.getToken();
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        // 合并选项
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, mergedOptions);

            // 处理 401 响应
            if (response.status === 401) {
                const data = await response.json();

                // Token 过期
                if (data.code === 'TOKEN_EXPIRED') {
                    const refreshed = await this.refreshToken();
                    if (refreshed) {
                        // 重试请求
                        mergedOptions.headers['Authorization'] = `Bearer ${this.getToken()}`;
                        const retryResponse = await fetch(url, mergedOptions);
                        return retryResponse.json();
                    }
                }

                // 认证失败
                this.handleAuthError();
                throw new Error('认证失败');
            }

            return response.json();
        } catch (error) {
            console.error(`API 请求失败 [${endpoint}]:`, error);
            throw error;
        }
    },

    // ============================
    // 认证相关 API
    // ============================

    /**
     * 用户注册
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @param {string} captchaToken - 验证码 token
     * @param {number} captchaAnswer - 验证码答案
     * @returns {Promise} 注册结果
     */
    async register(username, password, captchaToken, captchaAnswer) {
        // 输入验证
        if (typeof Security !== 'undefined') {
            const usernameValidation = Security.validateUsername(username);
            if (!usernameValidation.valid) {
                return { success: false, message: usernameValidation.message };
            }

            const passwordValidation = Security.validatePassword(password);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }
        }

        return this.request('/register', {
            method: 'POST',
            body: JSON.stringify({
                username: username.trim(),
                password,
                captchaToken,
                captchaAnswer
            })
        });
    },

    /**
     * 用户登录
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise} 登录结果
     */
    async login(username, password) {
        // 输入净化
        if (typeof Security !== 'undefined') {
            username = Security.sanitizeInput(username);
        }

        const result = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username: username.trim(), password })
        });

        // 登录成功，保存 token
        if (result.success && result.data) {
            this.setToken(result.data.token);
            if (result.data.refreshToken) {
                this.setRefreshToken(result.data.refreshToken);
            }
            if (typeof Security !== 'undefined') {
                Security.setCurrentUser({
                    id: result.data.id,
                    username: result.data.username
                });
            }
        }

        return result;
    },

    /**
     * 刷新 Token
     * @returns {Promise<boolean>} 是否成功
     */
    async refreshToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) return false;

            const result = await this.request('/refresh-token', {
                method: 'POST',
                body: JSON.stringify({ refreshToken })
            });

            if (result.success && result.data.token) {
                this.setToken(result.data.token);
                return true;
            }

            return false;
        } catch (error) {
            console.error('刷新 token 失败:', error);
            return false;
        }
    },

    /**
     * 验证 Token
     * @returns {Promise} 验证结果
     */
    async verifyToken() {
        return this.request('/verify');
    },

    /**
     * 修改密码
     * @param {string} oldPassword - 旧密码
     * @param {string} newPassword - 新密码
     * @returns {Promise} 修改结果
     */
    async changePassword(oldPassword, newPassword) {
        // 验证新密码强度
        if (typeof Security !== 'undefined') {
            const passwordValidation = Security.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return { success: false, message: passwordValidation.message };
            }
        }

        return this.request('/change-password', {
            method: 'POST',
            body: JSON.stringify({ oldPassword, newPassword })
        });
    },

    /**
     * 获取用户信息
     * @returns {Promise} 用户信息
     */
    async getUserProfile() {
        return this.request('/user/profile');
    },

    // ============================
    // 验证码 API
    // ============================

    /**
     * 获取验证码
     * @returns {Promise} 验证码数据
     */
    async getCaptcha() {
        return this.request('/captcha');
    },

    // ============================
    // 测试 API
    // ============================

    /**
     * 测试 API 连接
     * @returns {Promise} 测试结果
     */
    async test() {
        return this.request('/test');
    },

    /**
     * 健康检查
     * @returns {Promise} 健康状态
     */
    async healthCheck() {
        return this.request('/health');
    },

    // ============================
    // Token 管理
    // ============================

    /**
     * 获取 Token
     * @returns {string|null}
     */
    getToken() {
        if (typeof Security !== 'undefined') {
            return Security.getToken();
        }
        return localStorage.getItem('token');
    },

    /**
     * 设置 Token
     * @param {string} token
     */
    setToken(token) {
        if (typeof Security !== 'undefined') {
            Security.setToken(token);
        } else {
            localStorage.setItem('token', token);
        }
    },

    /**
     * 获取刷新 Token
     * @returns {string|null}
     */
    getRefreshToken() {
        if (typeof Security !== 'undefined') {
            return Security.getRefreshToken();
        }
        return localStorage.getItem('refreshToken');
    },

    /**
     * 设置刷新 Token
     * @param {string} token
     */
    setRefreshToken(token) {
        if (typeof Security !== 'undefined') {
            Security.setRefreshToken(token);
        } else {
            localStorage.setItem('refreshToken', token);
        }
    },

    /**
     * 清除认证信息
     */
    clearAuth() {
        if (typeof Security !== 'undefined') {
            Security.clearAuth();
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('isLogin');
            localStorage.removeItem('username');
        }
    },

    /**
     * 处理认证错误
     */
    handleAuthError() {
        this.clearAuth();
        if (window.location.pathname !== '/login.html') {
            window.location.href = 'login.html';
        }
    },

    // ============================
    // 状态检查
    // ============================

    /**
     * 检查是否已登录
     * @returns {boolean}
     */
    isLoggedIn() {
        if (typeof Security !== 'undefined') {
            return Security.isLoggedIn();
        }
        return localStorage.getItem('isLogin') === 'true';
    },

    /**
     * 获取当前用户名
     * @returns {string}
     */
    getUsername() {
        if (typeof Security !== 'undefined') {
            const user = Security.getCurrentUser();
            return user ? user.username : '新朋友';
        }
        return localStorage.getItem('username') || '新朋友';
    },

    /**
     * 设置登录状态（兼容旧代码）
     * @param {string} username - 用户名
     */
    setLoginStatus(username) {
        localStorage.setItem('isLogin', 'true');
        localStorage.setItem('username', username);
    },

    /**
     * 退出登录
     */
    logout() {
        this.clearAuth();
        window.location.href = 'login.html';
    }
};

// 导出 API 客户端
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
} else {
    window.api = api;
}
