# 백엔드 HTTPS 종단 (Caddy + sslip.io) — CloudFront 없이

제약 환경(CloudFront/도메인 불가, EC2+RDS만)에서 백엔드에 직접 HTTPS를 입힌다.
무료 와일드카드 DNS `13-125-18-200.sslip.io`(→ 13.125.18.200)에 Let's Encrypt 인증서를
Caddy가 자동 발급/갱신하고, `localhost:3000`(Express)로 리버스 프록시한다.

## 1) 보안그룹: 80, 443 인바운드 허용
- IaC: `budgetflow-infra` 스택에 80/443 ingress 추가됨 → `cdk deploy` 로 반영.
- 빠르게: EC2 콘솔에서 해당 SG에 인바운드 TCP **80**, **443** (`0.0.0.0/0`) 직접 추가해도 됨.
  (80 = ACME HTTP-01 챌린지, 443 = HTTPS 서빙)

## 2) EC2에서 Caddy 설치·구동 (Amazon Linux 2023)
```bash
# 설치
curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /tmp/caddy
sudo install -m 0755 /tmp/caddy /usr/local/bin/caddy
sudo useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy 2>/dev/null || true
sudo mkdir -p /etc/caddy /var/lib/caddy && sudo chown -R caddy:caddy /var/lib/caddy

# Caddyfile (sslip.io 호스트 → Express:3000)
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
13-125-18-200.sslip.io {
    reverse_proxy localhost:3000
}
EOF

# systemd 서비스
sudo tee /etc/systemd/system/caddy.service >/dev/null <<'EOF'
[Unit]
Description=Caddy
After=network.target

[Service]
User=caddy
Group=caddy
Environment=XDG_DATA_HOME=/var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now caddy
sudo systemctl status caddy --no-pager
```

## 3) 발급 확인
```bash
curl -i -X POST https://13-125-18-200.sslip.io/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"admin@inha.ac.kr"}'
# → 200 이면 HTTPS 종단 성공 (인증서 자동 발급 완료)
```

## 4) Amplify Rewrite 타깃을 HTTPS로
```json
[
  { "source": "/api/<*>", "status": "200", "target": "https://13-125-18-200.sslip.io/api/<*>" },
  { "source": "/<*>", "status": "404-200", "target": "/index.html" }
]
```
- 환경변수 `NEXT_PUBLIC_BUDGETFLOW_API_BASE_URL=/` 유지 + 재배포.
- 동일 출처 프록시 유지 → CORS 불필요.

## 참고
- EC2 재시작으로 퍼블릭 IP가 바뀌면 sslip.io 호스트명도 바뀌므로, IP 고정(Elastic IP) 권장.
- 기존 `http://13.125.18.200:3000` 직접 접근도 그대로 동작(80/443만 추가한 것).
