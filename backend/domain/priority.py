from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from ..normalize import (
    normalize_economic_benefit_expectation,
    normalize_project_category,
    normalize_project_status,
)


def _parse_ts(ts: str) -> int:
    ts = (ts or "").strip()
    if not ts:
        return 0
    try:
        return int(datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").timestamp())
    except ValueError:
        return 0


def compute_priority(items: List[Dict[str, str]]) -> None:
    # Derived priority (higher first). Stored as string for CSV compatibility.
    # Same-field ordering (higher first):
    # - 项目状态：进行中 > 计划中 > 待开始 > 阻塞 > 已完成/中止
    # - 项目分类：执行项目 > 待定 > 管理项目 > 灵感项目
    #
    # Weight dominance (most significant to least):
    # 项目分类 > 时间紧急程度 > 项目经济效益预期 > 项目状态 > updated_at
    status_weight = {
        "1": 300,  # 进行中
        "3": 250,  # 计划中
        "0": 200,  # 待开始
        "4": 100,  # 阻塞
        "2": 0,    # 已完成
        "5": 0,    # 中止
    }
    econ_weight = {
        "0": 500,  # 已产生收益
        "1": 450,  # 短期将产生收益
        "2": 300,  # 未来能产生收益
        "3": 200,  # 不明朗需分析
        "4": 100,  # 不涉及（缺省）
        "5": 0,    # 预期无收益
    }
    category_weight = {
        "2": 300,  # 执行项目
        "0": 200,  # 待定
        "1": 100,  # 管理项目
        "3": 0,    # 灵感项目
    }

    for item in items:
        st = normalize_project_status(str(item.get("project_status", "0")))
        cat = normalize_project_category(str(item.get("project_category", "")))
        cat_score = category_weight.get(cat, 0)
        econ = normalize_economic_benefit_expectation(str(item.get("economic_benefit_expectation", "")))
        econ_score = econ_weight.get(econ, 0)
        urg_raw = str(item.get("urgency_level", "0")).strip()
        urg = int(urg_raw) if urg_raw.isdigit() else 0
        urg = max(0, min(4, urg))
        updated_epoch = _parse_ts(str(item.get("updated_at", "")))
        score = (
            cat_score * 1_000_000_000_000
            + urg * 10_000_000_000
            + econ_score * 10_000_000
            + status_weight.get(st, 0) * 10_000
            + updated_epoch
        )
        item["priority"] = str(score)

