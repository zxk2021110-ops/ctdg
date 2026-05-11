# 宠物之家 - 安全加固指南

## 一、应用 nginx 安全配置（立即执行）

```bash
cd /var/lib/docker/volumes/my_nginx/_data
bash apply-security.sh
```

---

## 二、配置 HTTPS（强烈推荐）

没有 HTTPS 的网站在视频平台展示时，浏览器会标记为"不安全"，且流量可被轻易截获。

### 方案 A：Let's Encrypt 免费证书（推荐）

#### 前提条件
- 拥有一个域名（如 `pet-home.example.com`）
- 域名已解析到你服务器的公网 IP
- 服务器 80 端口可从外网访问

#### 步骤

```bash
# 1. 安装 certbot
# CentOS/RHEL
yum install -y epel-release
yum install -y certbot

# Ubuntu/Debian
apt install -y certbot

# 2. 申请证书（先停止 nginx 占用 80 端口，或用 webroot 模式）
# 方法一：standalone 模式（需要临时停止 nginx）
docker stop yyy
certbot certonly --standalone -d your-domain.com
docker start yyy

# 方法二：webroot 模式（不停止 nginx）
# 先在 nginx 配置中添加：
# location /.well-known/acme-challenge/ {
#     root /var/www/certbot;
# }
certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 3. 证书会保存在：
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# 4. 创建 HTTPS nginx 配置
```

#### HTTPS nginx 配置

创建 `nginx-https.conf`：

```nginx
# HTTP -> HTTPS 重定向
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # SSL 安全设置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS（强制 HTTPS）
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self';" always;

    # 速率限制
    limit_req zone=req_limit burst=20 nodelay;
    limit_conn conn_limit 50;

    server_tokens off;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }

    location ~ /\. { deny all; }
}
```

#### 应用 HTTPS 配置

```bash
# 1. 将证书复制到 Docker 卷
mkdir -p /var/lib/docker/volumes/my_nginx/_data/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /var/lib/docker/volumes/my_nginx/_data/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /var/lib/docker/volumes/my_nginx/_data/ssl/

# 2. 复制 HTTPS 配置
docker cp nginx-https.conf yyy:/etc/nginx/conf.d/default.conf

# 3. Docker 需要映射 443 端口
# 停止并删除旧容器，重新创建：
docker stop yyy
docker rm yyy
docker run -d \
    --name yyy \
    -p 80:80 \
    -p 443:443 \
    -v /var/lib/docker/volumes/my_nginx/_data:/usr/share/nginx/html \
    -v /var/lib/docker/volumes/my_nginx/_data/ssl:/etc/nginx/ssl:ro \
    -v /var/lib/docker/volumes/my_nginx/_data/nginx.conf:/etc/nginx/nginx.conf:ro \
    nginx:latest

# 4. 设置证书自动续期
echo "0 3 * * * certbot renew --quiet && docker exec yyy nginx -s reload" | crontab -
```

### 方案 B：自签名证书（测试用，不推荐生产环境）

```bash
# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /var/lib/docker/volumes/my_nginx/_data/ssl/privkey.pem \
    -out /var/lib/docker/volumes/my_nginx/_data/ssl/fullchain.pem \
    -subj "/CN=pet-home"
```

> 注意：自签名证书浏览器会显示"不安全"警告，仅适合内部测试。

---

## 三、防火墙配置

### 方案 A：firewalld（CentOS/RHEL 推荐）

```bash
# 1. 检查防火墙状态
systemctl status firewalld

# 2. 启动防火墙（如果未启动）
systemctl start firewalld
systemctl enable firewalld

# 3. 只开放必要端口
firewall-cmd --permanent --remove-service=ssh   # 先保留 SSH
firewall-cmd --permanent --add-service=http      # 80 端口
firewall-cmd --permanent --add-service=https     # 443 端口

# 4. 如果你用的是非标准端口 2222
firewall-cmd --permanent --add-port=2222/tcp

# 5. 限制 SSH 只允许特定 IP（可选，替换为你的IP）
firewall-cmd --permanent --remove-service=ssh
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="你的IP/32" service name="ssh" accept'

# 6. 重载防火墙
firewall-cmd --reload

# 7. 查看当前规则
firewall-cmd --list-all
```

### 方案 B：iptables（通用）

```bash
# 1. 查看当前规则
iptables -L -n

# 2. 清空规则（谨慎！确保 SSH 不会被断开）
iptables -F

# 3. 允许本地回环
iptables -A INPUT -i lo -j ACCEPT

# 4. 允许已建立的连接
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 5. 允许 SSH（确保你能远程管理）
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 6. 允许 HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 7. 如果用非标准端口 2222
iptables -A INPUT -p tcp --dport 2222 -j ACCEPT

# 8. 限制单 IP 连接数（防 DDoS）
iptables -A INPUT -p tcp --dport 80 -m connlimit --connlimit-above 50 -j REJECT
iptables -A INPUT -p tcp --dport 443 -m connlimit --connlimit-above 50 -j REJECT

# 9. 限制 ICMP（防 Ping 洪水）
iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s -j ACCEPT

# 10. 丢弃其他所有入站
iptables -P INPUT DROP

# 11. 保存规则
# CentOS/RHEL
service iptables save
# 或
iptables-save > /etc/sysconfig/iptables

# Ubuntu/Debian
iptables-save > /etc/iptables/rules.v4
```

### 方案 C：云服务器安全组（阿里云/腾讯云等）

如果你用的是云服务器，在控制台配置安全组最简单：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 你的IP/32 | SSH 管理 |
| TCP | 80 | 0.0.0.0/0 | HTTP |
| TCP | 443 | 0.0.0.0/0 | HTTPS |
| ICMP | - | 0.0.0.0/0 | Ping（可选）|

---

## 四、额外安全建议

### 1. 定期更新

```bash
# 更新 nginx 镜像
docker pull nginx:latest
# 重新创建容器（数据卷不受影响）

# 更新系统
yum update -y    # CentOS
apt upgrade -y   # Ubuntu
```

### 2. 日志监控

```bash
# 查看访问日志，关注异常 IP
docker exec yyy tail -f /var/log/nginx/access.log

# 统计访问最多的 IP
docker exec yyy awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20

# 查看 444 状态码（被拒绝的请求）
docker exec yyy grep '" 444 ' /var/log/nginx/access.log
```

### 3. 备份策略

```bash
# 备份网站文件
tar -czf backup-$(date +%Y%m%d).tar.gz /var/lib/docker/volumes/my_nginx/_data/

# 备份 nginx 配置
docker cp yyy:/etc/nginx/nginx.conf ./nginx-backup.conf
docker cp yyy:/etc/nginx/conf.d/default.conf ./default-backup.conf
```

### 4. Fail2Ban（防暴力破解）

```bash
# 安装
yum install -y fail2ban    # CentOS
apt install -y fail2ban    # Ubuntu

# 配置 /etc/fail2ban/jail.local
cat > /etc/fail2ban/jail.local << 'EOF'
[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
EOF

systemctl start fail2ban
systemctl enable fail2ban
```

---

## 五、安全检查清单

- [ ] 运行 `apply-security.sh` 应用 nginx 安全配置
- [ ] 配置 HTTPS（域名 + Let's Encrypt）
- [ ] 配置防火墙，只开放 80/443/22 端口
- [ ] 云服务器配置安全组
- [ ] 安装 Fail2Ban
- [ ] 设置自动备份
- [ ] 定期更新系统和 nginx
- [ ] 监控访问日志
