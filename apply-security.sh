#!/bin/bash
# ============================================================
# 宠物之家 - 安全加固应用脚本
# 使用方法: bash apply-security.sh
# ============================================================

set -e

CONTAINER="yyy"
DATA_DIR="/var/lib/docker/volumes/my_nginx/_data"

echo "=========================================="
echo "  宠物之家 - 安全加固脚本"
echo "=========================================="
echo ""

# 检查容器是否运行
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "❌ 容器 ${CONTAINER} 未运行，请先启动容器"
    exit 1
fi

echo "✅ 容器 ${CONTAINER} 正在运行"

# 备份原配置
echo ""
echo "📦 备份原始配置..."
docker exec ${CONTAINER} cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak 2>/dev/null || true
docker exec ${CONTAINER} cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true
echo "✅ 备份完成"

# 复制新配置
echo ""
echo "📝 应用安全配置..."
docker cp ${DATA_DIR}/nginx.conf ${CONTAINER}:/etc/nginx/nginx.conf
docker cp ${DATA_DIR}/nginx-secure.conf ${CONTAINER}:/etc/nginx/conf.d/default.conf
echo "✅ 配置已复制"

# 测试配置
echo ""
echo "🔍 测试 nginx 配置..."
if docker exec ${CONTAINER} nginx -t 2>&1; then
    echo "✅ 配置测试通过"
else
    echo "❌ 配置测试失败，正在回滚..."
    docker exec ${CONTAINER} cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf
    docker exec ${CONTAINER} cp /etc/nginx/conf.d/default.conf.bak /etc/nginx/conf.d/default.conf
    echo "已回滚到原始配置"
    exit 1
fi

# 重载 nginx
echo ""
echo "🔄 重载 nginx..."
docker exec ${CONTAINER} nginx -s reload
echo "✅ nginx 已重载"

# 验证安全头
echo ""
echo "🔍 验证安全响应头..."
HEADERS=$(curl -sI http://localhost:2222/ 2>/dev/null)

check_header() {
    local name="$1"
    if echo "$HEADERS" | grep -qi "$name"; then
        echo "  ✅ $name 已生效"
    else
        echo "  ⚠️  $name 未检测到"
    fi
}

check_header "X-Frame-Options"
check_header "X-Content-Type-Options"
check_header "X-XSS-Protection"
check_header "Content-Security-Policy"
check_header "Referrer-Policy"

# 检查版本号是否隐藏
if echo "$HEADERS" | grep -qi "server: nginx"; then
    if echo "$HEADERS" | grep -qi "server: nginx/"; then
        echo "  ⚠️  nginx 版本号仍然可见"
    else
        echo "  ✅ nginx 版本号已隐藏"
    fi
fi

echo ""
echo "=========================================="
echo "  ✅ 安全加固完成！"
echo "=========================================="
echo ""
echo "已应用的安全措施:"
echo "  • 安全响应头 (X-Frame-Options, CSP, XSS Protection 等)"
echo "  • 速率限制 (每IP 10请求/秒，突发20)"
echo "  • 并发连接限制 (每IP 50个)"
echo "  • 请求体大小限制 (1MB)"
echo "  • 超时设置优化"
echo "  • 隐藏文件访问禁止"
echo "  • nginx 版本号隐藏"
echo "  • Gzip 压缩"
echo "  • 静态资源缓存"
echo ""
echo "⚠️  建议继续完成:"
echo "  1. 配置 HTTPS (参考 security-guide.md)"
echo "  2. 配置防火墙 (参考 security-guide.md)"
echo "  3. 定期更新 nginx 镜像"
echo ""
