#!/usr/bin/env python3
"""已写章节的「风格/内容」扫描器（可重复运行）。

用法：
  python3 _meta/audit/style-scan.py            # 全部已写
  python3 _meta/audit/style-scan.py 05 10      # 只看 ch-05、ch-10

只读：不修改任何正文，仅输出统计。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]

# 套话/教材腔（出现即说明有模板化嫌疑）
CLICHE = [
    "本章目标", "本章小结", "前置知识", "一句话总结", "让我们一起",
    "众所周知", "不言而喻", "值得注意的是", "综上所述", "由此可见",
    "首先我们来看", "下面我们", "接下来我们", "让我们一起",
]
# 空转连接词（数量多不等于废话，但密度高时句子会松）
FILLER = ["也就是说", "换句话说", "说白了", "你会发现", "你一定", "其实", "事实上", "基本上"]
# 语气词
TONE = {"你": r"你", "必须": r"必须", "别": r"别(?![人的])", "我们": r"我们", "记住": r"记住"}


def load_sections(prefix=None):
    lines = (ROOT / "_meta/chapters.tsv").read_text(encoding="utf-8").splitlines()[1:]
    out = []
    for line in lines:
        cols = line.split("\t")
        if len(cols) < 10 or cols[-1] != "已写":
            continue
        sec, chap, _, part, rel, title = cols[0], cols[1], cols[2], cols[3], cols[4], cols[5]
        if prefix and not any(f"ch-{p}" in rel for p in prefix):
            continue
        path = ROOT / rel if rel.startswith("book/") else ROOT / "book" / rel
        out.append({"sec": sec, "chap": chap, "part": part, "file": path, "title": title})
    return out


def han_count(text):
    return len(re.findall(r"[\u4e00-\u9fff]", text))


def strip_code(text):
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    return re.sub(r"`[^`\n]+`", " ", text)


def shingles(text, n=12):
    text = re.sub(r"[^\u4e00-\u9fff]", " ", text)
    grams = set()
    for part in text.split():
        for i in range(len(part) - n + 1):
            grams.add(part[i:i + n])
    return grams


def main():
    prefix = [a for a in sys.argv[1:] if a.isdigit()]
    sections = load_sections(prefix or None)
    print(f"扫描范围：{len(sections)} 节\n")

    total_han = 0
    for s in sections:
        raw = s["file"].read_text(encoding="utf-8")
        body = strip_code(raw)
        s["han"] = han_count(body)
        total_han += s["han"]
        s["code"] = raw.count("```") // 2
        s["mermaid"] = len(re.findall(r"```mermaid", raw))
        s["h2"] = len(re.findall(r"^## ", raw, flags=re.M))
        s["cliche"] = {w: raw.count(w) for w in CLICHE if w in raw}
        s["filler"] = {w: raw.count(w) for w in FILLER if w in raw}
        s["tone"] = {k: len(re.findall(v, raw)) for k, v in TONE.items()}
        s["long_sentence"] = len([x for x in re.split(r"[。！？；\n]", body) if han_count(x) > 60])
    print(f"正文汉字合计 {total_han}，平均 {total_han // max(1, len(sections))}\n")

    print("== 模板化文字（套话/教材腔）==")
    hits = [(s["sec"], s["cliche"]) for s in sections if s["cliche"]]
    print("  无" if not hits else "\n".join(f"  {sec}: {d}" for sec, d in hits))

    print("\n== 空转连接词密度 Top 5 ==")
    for s in sorted(sections, key=lambda x: sum(x["filler"].values()) / max(1, x["han"]), reverse=True)[:5]:
        total = sum(s["filler"].values())
        print(f"  {s['sec']}  {total:3d} 次 / {s['han']} 字（{total / max(1, s['han']) * 1000:.1f}‰）{s['filler']}")

    print("\n== 语气密度（必须/别 最多的 5 节）==")
    for s in sorted(sections, key=lambda x: x["tone"]["必须"] + x["tone"]["别"], reverse=True)[:5]:
        print(f"  {s['sec']}  必须 {s['tone']['必须']:2d}  别 {s['tone']['别']:2d}  你 {s['tone']['你']:2d}  记住 {s['tone']['记住']}")

    print("\n== 跨节重复（12-gram 重叠率 > 0.02）==")
    grams = {s["sec"]: shingles(s["file"].read_text(encoding="utf-8")) for s in sections}
    secs = list(grams)
    pairs = []
    for i in range(len(secs)):
        for j in range(i + 1, len(secs)):
            a, b = grams[secs[i]], grams[secs[j]]
            inter = len(a & b)
            if not inter:
                continue
            rate = inter / max(1, min(len(a), len(b)))
            if rate > 0.02:
                pairs.append((rate, inter, secs[i], secs[j]))
    pairs.sort(reverse=True)
    print("  无" if not pairs else "\n".join(f"  {a} ~ {b}: {i} gram, {r:.3f}" for r, i, a, b in pairs[:10]))

    print("\n== 术语一致性 ==")
    raw_all = "\n".join(s["file"].read_text(encoding="utf-8") for s in sections)
    for a, b in [("DTO", "dto"), ("Redis", "redis"), ("Prisma 8", "Prisma8"), ("Session", "session"), ("JWT", "jwt")]:
        print(f"  {a}: {raw_all.count(a)}   {b}: {raw_all.count(b)}")

    print("\n== 事实性口径抽查（版本/绝对化措辞）==")
    pats = [
        (r"12\.3\.x", "过时的 Nest 版本口径"),
        (r"node:22", "Node 22 基础镜像（当前 LTS 已到 26）"),
        (r"根本没有|绝对不|永远不|一定不会", "绝对化断言（易与版本演进冲突）"),
        (r"实测", "「实测」字样"),
        (r"未实测", "「未实测」标注"),
    ]
    for pat, label in pats:
        n = len(re.findall(pat, raw_all))
        print(f"  {label}: {n} 处")


if __name__ == "__main__":
    main()
