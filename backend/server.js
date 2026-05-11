const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'pethome_secret_key_2024';

// 中间件
app.use(cors());
app.use(express.json());

// 数据库连接配置
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'pethome'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 初始化数据库和表
async function initDB() {
    try {
        // 先连接 MySQL 创建数据库
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        // 创建数据库
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
        console.log('数据库创建成功');

        // 关闭连接
        await connection.end();

        // 再连接到具体数据库
        const dbConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database
        });

        // 创建用户表
        await dbConnection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log('用户表创建成功');
        await dbConnection.end();
    } catch (error) {
        console.error('数据库初始化失败:', error);
    }
}

// 注册接口
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: '用户名和密码不能为空' });
        }

        if (password.length < 6) {
            return res.json({ success: false, message: '密码长度至少6位' });
        }

        // 检查用户名是否已存在
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.json({ success: false, message: '用户名已存在' });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 插入新用户
        const [result] = await pool.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );

        res.json({
            success: true,
            message: '注册成功',
            data: { id: result.insertId, username }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.json({ success: false, message: '注册失败，请重试' });
    }
});

// 登录接口
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({ success: false, message: '用户名和密码不能为空' });
        }

        // 查找用户
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.json({ success: false, message: '用户名或密码错误' });
        }

        const user = users[0];

        // 验证密码
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({ success: false, message: '用户名或密码错误' });
        }

        // 生成 JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: '登录成功',
            data: {
                id: user.id,
                username: user.username,
                token
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.json({ success: false, message: '登录失败，请重试' });
    }
});

// 验证 token 接口
app.get('/api/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.json({ success: false, message: '未提供认证token' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({
            success: true,
            data: { id: decoded.id, username: decoded.username }
        });
    } catch (error) {
        res.json({ success: false, message: 'token无效或已过期' });
    }
});

// 测试接口
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: '后端 API 运行正常' });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`后端服务器运行在 http://0.0.0.0:${PORT}`);
    await initDB();
});
