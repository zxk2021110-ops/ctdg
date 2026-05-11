#!/bin/bash

# 启动后端服务器
cd /var/lib/docker/volumes/my_nginx/_data/backend
node server.js &
BACKEND_PID=$!
echo "后端服务器启动成功 (PID: $BACKEND_PID)"

# 启动 cpolar
cpolar http 3000 &
CPOLAR_PID=$!
echo "cpolar 启动成功 (PID: $CPOLAR_PID)"

# 等待 cpolar 启动
sleep 5

# 获取 cpolar 公网地址
echo "正在获取公网地址..."
PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*' | head -1)

if [ -z "$PUBLIC_URL" ]; then
    # 备用方案：从网页获取
    PUBLIC_URL=$(curl -s http://127.0.0.1:4040/http/in 2>/dev/null | grep -o 'https://[^"]*\.cpolar\.top' | head -1)
fi

if [ -z "$PUBLIC_URL" ]; then
    # 再次尝试
    sleep 3
    PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*' | head -1)
fi

if [ -n "$PUBLIC_URL" ]; then
    echo "公网地址: $PUBLIC_URL"

    # 更新 api.js 文件
    API_FILE="/var/lib/docker/volumes/my_nginx/_data/api.js"
    sed -i "s|const API_BASE_URL = '.*';|const API_BASE_URL = '$PUBLIC_URL/api';|" "$API_FILE"
    echo "已更新 api.js 文件"

    # 自动提交并推送到 GitHub
    cd /var/lib/docker/volumes/my_nginx/_data
    git add api.js
    git commit -m "自动更新 API 地址: $PUBLIC_URL" 2>/dev/null
    git push origin main 2>/dev/null
    echo "已推送到 GitHub"
else
    echo "无法获取公网地址，请手动检查 cpolar 控制台"
fi

echo ""
echo "=========================================="
echo "  后端服务已启动"
echo "  公网地址: $PUBLIC_URL"
echo "  本地地址: http://localhost:3000"
echo "=========================================="
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待进程
wait
