#!/bin/bash
# ============================================================
# 宠物之家 - HTTPS 配置应用脚本
# 使用方法: bash apply-https.sh
# ============================================================

set -e

CONTAINER="yyy"
DATA_DIR="/var/lib/docker/volumes/my_nginx/_data"

echo "=========================================="
echo "  宠物之家 - HTTPS 配置脚本"
echo "=========================================="
echo ""

# 检查 SSL 证书是否存在
if [ ! -f "${DATA_DIR}/ssl/fullchain.pem" ] || [ ! -f "${DATA_DIR}/ssl/privkey.pem" ]; then
    echo "❌ SSL 证书文件不存在"
    echo "请先生成证书："
    echo "  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\"
    echo "    -keyout ${DATA_DIR}/ssl/privkey.pem \\"
    echo "    -out ${DATA_DIR}/ssl/fullchain.pem \\"
    echo "    -subj '/CN=pet-home'"
    exit 1
fi

echo "✅ SSL 证书文件存在"

# 停止并删除旧容器
echo ""
echo "🔄 停止旧容器..."
docker stop ${CONTAINER} 2>/dev/null || true
docker rm ${CONTAINER} 2>/dev/null || true
echo "✅ 旧容器已停止"

# 创建新容器（支持 HTTP 和 HTTPS）
echo ""
echo "🚀 创建新容器（支持 HTTPS）..."
docker run -d \
    --name ${CONTAINER} \
    -p 80:80 \
    -p 443:443 \
    -v ${DATA_DIR}:/usr/share/nginx/html \
    -v ${DATA_DIR}/ssl:/etc/nginx/ssl:ro \
    -v ${DATA_DIR}/nginx-https.conf:/etc/nginx/conf.d/default.conf:ro \
    nginx:latest

echo "✅ 新容器已创建"

# 等待容器启动
echo ""
echo "⏳ 等待容器启动..."
sleep 3

# 检查容器状态
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "✅ 容器运行正常"
else
    echo "❌ 容器启动失败"
    docker logs ${CONTAINER}
    exit 1
fi

# 测试 HTTPS 访问
echo ""
echo "🔍 测试 HTTPS 访问..."
if curl -sk https://localhost > /dev/null 2>&1; then
    echo "✅ HTTPS 访问正常"
else
    echo "⚠️  HTTPS 访问测试失败，请检查日志"
fi

# 测试 HTTP 重定向
echo ""
echo "🔍 测试 HTTP 重定向..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null)
if [ "$HTTP_CODE" = "301" ]; then
    echo "✅ HTTP -> HTTPS 重定向正常"
else
    echo "⚠️  HTTP 重定向可能未生效（状态码: ${HTTP_CODE}）"
fi

echo ""
echo "=========================================="
echo "  ✅ HTTPS 配置完成！"
echo "=========================================="
echo ""
echo "访问地址："
echo "  • HTTPS: https://localhost"
echo "  • HTTP:  http://localhost (会自动重定向到 HTTPS)"
echo ""
echo "⚠️  注意："
echo "  • 使用的是自签名证书，浏览器会显示'不安全'警告"
echo "  • 点击'高级' -> '继续访问'即可正常使用"
echo "  • 如需正式证书，请配置域名并使用 Let's Encrypt"
echo ""