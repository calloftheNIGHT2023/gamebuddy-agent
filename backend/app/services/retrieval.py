"""Deterministic local retrieval with inspectable citations and bilingual terms.

The small demo packs do not need a hosted vector database. Documents are JSON
leaves, ranked with term-frequency/inverse-document-frequency and concept aliases.
An unrelated query returns no documents instead of substituting arbitrary tips.
"""

import json
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.models.schemas import SupportedGame


PACK_FILES = {
    "pokemon-battle-demo": "pokemon_demo_knowledge.json",
    "moba-postmatch-demo": "moba_demo_knowledge.json",
    "rpg-build-demo": "rpg_demo_knowledge.json",
}
_ROOT = Path(__file__).resolve().parents[1] / "knowledge"
_STOP_WORDS = set(
    "a an the and or to of in on for from with as is are was be been can could should "
    "would do does did not no it its this that these those your you my me we our they "
    "their more most much how what why when where which before after than then into "
    "one also at by if so have has game demo current next please help improve".split()
)
# Each group is a concept, not a translation service. Expanding both documents
# and queries permits colloquial Chinese questions against the English packs.
_ALIASES = (
    ("tempo", "节奏", "控场"),
    ("win condition", "endgame", "closer", "胜利条件", "赢法", "胜负手", "核心"),
    ("pivot", "switch", "换人", "轮转", "安全换入", "转场"),
    ("chip damage", "hazard", "stealth rock", "撒钉", "钉子", "隐形岩", "消耗"),
    ("speed control", "choice scarf", "速度控制", "围巾", "速度线"),
    ("priority", "先制", "先手技能"),
    ("dragon dance", "龙舞", "强化"),
    ("behind", "stabilize", "落后", "劣势", "稳住"),
    ("objective", "目标物", "地图资源", "小龙", "大龙", "资源团", "争龙"),
    ("setup window", "setup", "布置", "提前准备", "站位"),
    ("face check", "fog of war", "探草", "脸探", "战争迷雾"),
    ("vision", "视野", "插眼", "排眼"),
    ("wave", "lane priority", "兵线", "线权", "推线"),
    ("recall", "tempo reset", "回城", "重整", "补给"),
    ("rotation", "late", "转线", "到场", "支援"),
    ("support", "辅助"),
    ("jungler", "camp", "打野", "野怪"),
    ("carry", "输出位", "射手"),
    ("death", "deaths", "阵亡", "死亡", "暴毙"),
    ("build", "build identity", "构筑", "配装", "流派", "加点"),
    ("bottleneck", "weakest", "卡点", "瓶颈", "短板"),
    ("mana", "mana regen", "sustain", "法力", "回蓝", "缺蓝", "续航"),
    ("vitality", "survivability", "survive", "体力", "生存", "血量", "容错"),
    ("threshold", "breakpoint", "阈值", "门槛"),
    ("gear", "item", "itemization", "equipment", "装备", "词条"),
    ("upgrade", "upgrades", "升级", "强化装备"),
    ("spell power", "damage", "伤害", "法强", "输出"),
    ("boss", "首领", "头目"),
    ("progression", "content", "推进", "进度", "目标内容"),
)


def _normalized(text: str) -> str:
    return re.sub(r"[\s_-]+", " ", text.casefold()).strip()


def _contains(text: str, phrase: str) -> bool:
    if re.search(r"[\u3400-\u9fff]", phrase):
        return phrase in text
    return bool(re.search(r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])", text))


def _terms(text: str) -> Counter[str]:
    normalized = _normalized(text)
    tokens = [token for token in re.findall(r"[a-z0-9]+", normalized) if token not in _STOP_WORDS]
    # Character bigrams support native Chinese content in future local packs.
    for sequence in re.findall(r"[\u3400-\u9fff]+", normalized):
        tokens.extend(sequence[index : index + 2] for index in range(len(sequence) - 1))
    for index, aliases in enumerate(_ALIASES):
        if any(_contains(normalized, _normalized(alias)) for alias in aliases):
            tokens.extend([f"concept:{index}"] * 2)
    return Counter(tokens)


def load_knowledge_pack(game: SupportedGame) -> dict[str, Any]:
    """Resolve game identifiers through a fixed allowlist, never a user path."""
    filename = PACK_FILES.get(game)
    if filename is None:
        raise ValueError("Unsupported game knowledge pack")
    return json.loads((_ROOT / filename).read_text(encoding="utf-8"))


def _leaves(node: Any, path: str = ""):
    if isinstance(node, dict):
        for key, value in node.items():
            if key != "game":
                yield from _leaves(value, f"{path}.{key}" if path else key)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _leaves(value, f"{path}[{index}]")
    elif isinstance(node, str) and node.strip():
        yield path, node


@lru_cache(maxsize=3)
def _index(game: SupportedGame) -> tuple[list[dict[str, Any]], Counter[str]]:
    documents: list[dict[str, Any]] = []
    document_frequency: Counter[str] = Counter()
    source = f"backend/app/knowledge/{PACK_FILES[game]}"
    for path, content in _leaves(load_knowledge_pack(game)):
        terms = _terms(f"{path} {content}")
        documents.append({"source": source, "path": path, "content": content, "terms": terms})
        document_frequency.update(terms.keys())
    return documents, document_frequency


def retrieve_knowledge(game: SupportedGame, query: str, *, limit: int = 4) -> list[dict[str, Any]]:
    """Rank matching JSON leaves; return stable source/path/score citations.

    Scores are relevance scores, not probabilities or evidence of correctness.
    Ties break by JSON path so repeated retrieval is reproducible.
    """
    if game not in PACK_FILES:
        raise ValueError("Unsupported game knowledge pack")
    if not isinstance(query, str) or not query.strip() or limit <= 0:
        return []
    query_terms = _terms(query[:8000])
    if not query_terms:
        return []
    documents, frequencies = _index(game)
    count = len(documents)
    results: list[dict[str, Any]] = []
    for document in documents:
        common = query_terms.keys() & document["terms"].keys()
        if not common:
            continue
        score = sum(
            (1 + math.log(document["terms"][term]))
            * math.log(1 + count / (1 + frequencies[term]))
            * (1.7 if term.startswith("concept:") else 1.0)
            for term in common
        ) / math.sqrt(max(1, sum(document["terms"].values())))
        results.append(
            {"source": document["source"], "path": document["path"],
             "content": document["content"], "score": round(score, 6),
             "matched_terms": sorted(common)}
        )
    results.sort(key=lambda document: (-document["score"], document["path"]))
    return results[: min(limit, 8)]


def retrieval_query(question: str, state: dict[str, Any]) -> str:
    """Use the question and observed values without inventing state facts."""
    values: list[str] = []

    def collect(node: Any) -> None:
        if len(values) >= 40:
            return
        if isinstance(node, dict):
            for value in node.values():
                collect(value)
        elif isinstance(node, list):
            for value in node[:10]:
                collect(value)
        elif isinstance(node, str):
            values.append(node[:160])

    collect(state)
    return " ".join([question[:2000], *values])[:8000]
