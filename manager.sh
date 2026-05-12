#!/bin/bash

# 小暖 (XiaoNuan) 项目管理脚本

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function show_usage() {
    echo -e "${BLUE}用法:${NC}"
    echo "  ./manager.sh [command]"
    echo ""
    echo -e "${BLUE}命令:${NC}"
    echo "  start    启动所有服务 (后台)"
    echo "  stop     停止并移除容器"
    echo "  restart  重启所有服务"
    echo "  status   查看服务运行状态"
    echo "  logs     查看服务实时日志"
    echo "  build    重新构建服务镜像"
    echo "  dev      启动本地开发模式 (pnpm run dev)"
    echo ""
}

function check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${RED}警告: 未找到 .env 文件，请先根据 .env.example 创建并配置。${NC}"
    fi
}

case "$1" in
    start)
        echo -e "${GREEN}正在启动小暖服务...${NC}"
        check_env
        docker-compose up -d
        echo -e "${GREEN}启动指令已发送。${NC}"
        ;;
    stop)
        echo -e "${RED}正在停止并清理服务...${NC}"
        docker-compose down
        ;;
    restart)
        echo -e "${BLUE}正在重启服务...${NC}"
        docker-compose restart
        ;;
    status)
        echo -e "${BLUE}服务状态:${NC}"
        docker-compose ps
        ;;
    logs)
        if [ -n "$2" ]; then
            docker-compose logs -f "$2"
        else
            echo -e "${BLUE}显示所有服务日志 (Ctrl+C 退出):${NC}"
            docker-compose logs -f
        fi
        ;;
    build)
        echo -e "${BLUE}开始重新构建镜像...${NC}"
        docker-compose build
        ;;
    dev)
        echo -e "${GREEN}正在进入开发模式...${NC}"
        check_env
        pnpm run dev
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
