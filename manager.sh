#!/bin/bash

# 小暖 (XiaoNuan) 云主机部署管理脚本
# 用法: ./manager.sh [command] [options]

set -euo pipefail

# ==================================================
# 颜色定义
# ==================================================
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==================================================
# 全局配置
# ==================================================
COMPOSE_CMD=""
PROJECT_NAME="xiaonuan"
BACKUP_DIR="./backups"

# ==================================================
# 工具函数
# ==================================================
function detect_compose() {
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}错误: 未安装 Docker Compose${NC}"
        exit 1
    fi
}

function show_usage() {
    echo -e "${BLUE}小暖 (XiaoNuan) 云主机部署管理脚本${NC}"
    echo ""
    echo -e "${BLUE}用法:${NC}"
    echo "  ./manager.sh [command] [options]"
    echo ""
    echo -e "${BLUE}部署命令:${NC}"
    echo "  start            启动所有服务 (后台，含构建)"
    echo "  stop             停止并移除容器"
    echo "  restart          重启容器 (不重建镜像，仅重启)"
    echo "  update           完整更新部署 (拉代码→重建→启动)"
    echo "  build            重新构建服务镜像"
    echo "  db-reset         首次部署：重置数据库和数据目录 (危险操作！)"
    echo ""
    echo -e "${BLUE}运维命令:${NC}"
    echo "  status           查看服务运行状态"
    echo "  logs [service]   查看服务实时日志 (如: logs gateway)"
    echo "  health           检查各服务健康状态"
    echo "  backup           备份数据库到 ./backups/"
    echo "  clean            清理旧日志和未使用镜像"
    echo "  nginx-reload     重载宿主机 nginx 配置"
    echo ""
    echo -e "${BLUE}开发命令 (仅本地):${NC}"
    echo "  dev              启动本地开发模式 (pnpm run dev)"
    echo ""
    echo -e "${YELLOW}提示: update 是最常用的命令，用于发布新版本${NC}"
    echo -e "${RED}警告: db-reset 会删除所有数据，仅在首次部署时使用${NC}"
}

function check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${RED}错误: 未找到 .env 文件${NC}"
        echo -e "${YELLOW}请先执行: cp .env.example .env 并配置生产环境密钥${NC}"
        exit 1
    fi

    # 检查必要变量是否存在
    local required_vars=("JWT_SECRET" "WECHAT_APPID" "WECHAT_SECRET" "DASHSCOPE_API_KEY")
    local missing=0
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env || grep -q "^${var}=your-" .env || grep -q "^${var}=change-me" .env; then
            echo -e "${RED}警告: .env 中 ${var} 未配置或仍是占位符${NC}"
            missing=1
        fi
    done
    if [ $missing -eq 1 ]; then
        echo -e "${YELLOW}请在提交前完善 .env 配置${NC}"
        exit 1
    fi
}

function wait_for_health() {
    echo -e "${BLUE}等待服务健康检查...${NC}"
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        local unhealthy=$(${COMPOSE_CMD} ps --format json 2>/dev/null | grep -c '"Health": "unhealthy"' || true)
        local starting=$(${COMPOSE_CMD} ps --format json 2>/dev/null | grep -c '"Health": "starting"' || true)
        if [ "$starting" -eq 0 ] && [ "$unhealthy" -eq 0 ]; then
            echo -e "${GREEN}所有服务已通过健康检查${NC}"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        echo -n "."
    done
    echo ""
    echo -e "${RED}警告: 部分服务健康检查未通过，请查看日志${NC}"
    ${COMPOSE_CMD} ps
}

function do_backup() {
    mkdir -p "${BACKUP_DIR}"
    local timestamp=$(date +%Y%m%d_%H%M%S)

    # 1. 数据库标准 SQL 备份（可跨版本恢复）
    local sql_file="${BACKUP_DIR}/postgres_${timestamp}.sql.gz"
    echo -e "${BLUE}正在备份 PostgreSQL...${NC}"
    if ${COMPOSE_CMD} ps | grep -q xiaonuan-postgres; then
        ${COMPOSE_CMD} exec -T postgres pg_dump -U xiaonuan xiaonuan | gzip > "${sql_file}"
        echo -e "${GREEN}SQL 备份完成: ${sql_file}${NC}"
    else
        echo -e "${RED}错误: postgres 容器未运行，无法备份${NC}"
        exit 1
    fi

    # 2. 完整数据目录打包（含向量库、语音文件）
    local data_file="${BACKUP_DIR}/data_full_${timestamp}.tar.gz"
    echo -e "${BLUE}正在打包 data/ 目录...${NC}"
    if [ -d "data" ]; then
        tar czf "${data_file}" data/
        echo -e "${GREEN}数据打包完成: ${data_file}${NC}"
    else
        echo -e "${YELLOW}警告: data/ 目录不存在，跳过完整打包${NC}"
    fi

    echo -e "${GREEN}所有备份已完成，存放于 ${BACKUP_DIR}/${NC}"
}

function do_clean() {
    echo -e "${YELLOW}正在清理...${NC}"
    # 清理未使用的镜像
    docker image prune -af --filter "label=com.docker.compose.project=${PROJECT_NAME}" 2>/dev/null || true
    # 清理已停止的容器
    docker container prune -f 2>/dev/null || true
    # 清理构建缓存（可选）
    docker builder prune -f 2>/dev/null || true
    echo -e "${GREEN}清理完成${NC}"
}

# ==================================================
# 命令实现
# ==================================================

cmd_start() {
    echo -e "${GREEN}正在启动小暖服务...${NC}"
    check_env
    ${COMPOSE_CMD} up -d --build
    wait_for_health
    echo -e "${GREEN}服务已启动。访问: https://your-domain/xiaonuan/${NC}"
}

cmd_stop() {
    echo -e "${RED}正在停止并清理服务...${NC}"
    ${COMPOSE_CMD} down
    echo -e "${GREEN}服务已停止${NC}"
}

cmd_restart() {
    echo -e "${YELLOW}注意: restart 仅重启容器，不会重新构建镜像${NC}"
    echo -e "${YELLOW}如需应用代码变更，请使用: ./manager.sh update${NC}"
    echo ""
    echo -e "${BLUE}正在重启服务...${NC}"
    ${COMPOSE_CMD} restart
    wait_for_health
}

cmd_update() {
    echo -e "${CYAN}========== 开始完整更新部署 ==========${NC}"

    # 1. 备份
    read -r -p "是否先备份数据库? [Y/n] " confirm
    if [[ ! "$confirm" =~ ^[Nn]$ ]]; then
        do_backup
    fi

    # 2. 拉代码
    echo -e "${BLUE}拉取最新代码...${NC}"
    git pull origin main

    # 3. 检查环境
    check_env

    # 4. 构建并启动
    echo -e "${BLUE}重新构建并启动服务...${NC}"
    ${COMPOSE_CMD} down
    ${COMPOSE_CMD} build
    ${COMPOSE_CMD} up -d

    # 5. 健康检查
    wait_for_health

    # 6. 清理旧镜像
    do_clean

    echo -e "${GREEN}========== 更新部署完成 ==========${NC}"
}

cmd_build() {
    echo -e "${BLUE}开始重新构建镜像...${NC}"
    ${COMPOSE_CMD} build
    echo -e "${GREEN}构建完成${NC}"
}

cmd_status() {
    echo -e "${BLUE}服务状态:${NC}"
    ${COMPOSE_CMD} ps
}

cmd_logs() {
    if [ -n "${2:-}" ]; then
        echo -e "${BLUE}显示 $2 日志 (Ctrl+C 退出):${NC}"
        ${COMPOSE_CMD} logs -f "$2"
    else
        echo -e "${BLUE}显示所有服务日志 (Ctrl+C 退出):${NC}"
        ${COMPOSE_CMD} logs -f
    fi
}

cmd_health() {
    echo -e "${BLUE}服务健康状态:${NC}"
    ${COMPOSE_CMD} ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"
}

cmd_backup() {
    do_backup
}

cmd_clean() {
    do_clean
}

cmd_db_reset() {
    echo -e "${RED}警告: 此操作将删除所有数据库表和数据，以及本地数据目录！${NC}"
    echo -e "${YELLOW}此命令仅用于首次生产部署，生产环境有数据后绝不应使用${NC}"
    echo ""
    read -r -p "确定要继续吗？输入 yes 确认: " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "已取消"
        exit 0
    fi

    echo ""
    echo -e "${BLUE}步骤 1/5: 停止所有服务...${NC}"
    ${COMPOSE_CMD} stop gateway voice-service child-pc || true
    ${COMPOSE_CMD} stop postgres || true

    echo -e "${BLUE}步骤 2/5: 清理本地数据目录...${NC}"
    rm -rf data/postgres/* data/qdrant/* data/redis/* data/voice-audio/*
    echo -e "${GREEN}数据目录已清空${NC}"

    echo -e "${BLUE}步骤 3/5: 重新启动 PostgreSQL...${NC}"
    ${COMPOSE_CMD} up -d postgres
    echo -n "等待 PostgreSQL 启动"
    local waited=0
    while [ $waited -lt 30 ]; do
        if ${COMPOSE_CMD} ps --format json 2>/dev/null | grep -q '"Health": "healthy"' 2>/dev/null || \
           ${COMPOSE_CMD} exec -T postgres pg_isready -U xiaonuan &>/dev/null; then
            echo ""
            echo -e "${GREEN}PostgreSQL 已就绪${NC}"
            break
        fi
        sleep 2
        waited=$((waited + 2))
        echo -n "."
    done
    if [ $waited -ge 30 ]; then
        echo ""
        echo -e "${RED}错误: PostgreSQL 启动超时，请检查日志${NC}"
        ${COMPOSE_CMD} logs postgres
        exit 1
    fi

    echo -e "${BLUE}步骤 4/5: 重置数据库 Schema...${NC}"
    ${COMPOSE_CMD} exec -T postgres psql -U xiaonuan -d xiaonuan -c "
        DROP SCHEMA public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO xiaonuan;
        GRANT ALL ON SCHEMA public TO public;
    "
    echo -e "${GREEN}数据库已重置${NC}"

    echo -e "${BLUE}步骤 5/5: 重新生成 Prisma Client...${NC}"
    pnpm db:generate
    echo -e "${GREEN}Prisma Client 已重新生成${NC}"

    echo ""
    echo -e "${GREEN}========== 数据库重置完成 ==========${NC}"
    echo -e "${YELLOW}下一步: 执行 ./manager.sh start 启动所有服务${NC}"
    echo -e "${YELLOW}Prisma 将在首次启动时通过 migrate deploy 创建数据库表${NC}"
}

cmd_nginx_reload() {
    echo -e "${BLUE}重载宿主机 nginx...${NC}"
    if docker ps | grep -q "gateway"; then
        docker exec gateway nginx -s reload
        echo -e "${GREEN}nginx 已重载${NC}"
    else
        echo -e "${RED}错误: nginx 容器 (gateway) 未运行${NC}"
        exit 1
    fi
}

cmd_dev() {
    echo -e "${YELLOW}警告: dev 模式仅在本地开发环境使用${NC}"
    echo -e "${YELLOW}云主机部署请使用: ./manager.sh start${NC}"
    echo ""
    read -r -p "仍要继续吗? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        check_env
        pnpm run dev
    else
        echo "已取消"
    fi
}

# ==================================================
# 主入口
# ==================================================
detect_compose

case "${1:-}" in
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    restart)    cmd_restart ;;
    update)     cmd_update ;;
    build)      cmd_build ;;
    db-reset)   cmd_db_reset ;;
    status)     cmd_status ;;
    logs)       cmd_logs "$@" ;;
    health)     cmd_health ;;
    backup)     cmd_backup ;;
    clean)      cmd_clean ;;
    nginx-reload) cmd_nginx_reload ;;
    dev)        cmd_dev ;;
    *)          show_usage ;;
esac
