import type { Metrics } from "../rules/selectors";

const CARDS: { key: keyof Metrics; label: string; hint: string }[] = [
  { key: "recheck", label: "待复查", hint: "复查准入进行中" },
  { key: "abnormalGait", label: "异常步态风险", hint: "蹄裂/挫伤/明显跛行" },
  { key: "replaced", label: "闭环前换蹄铁", hint: "旧结论失效留档" },
  { key: "horses", label: "马匹档案", hint: "编号 + 蹄位唯一" },
];

export function MetricsBar({ metrics }: { metrics: Metrics }) {
  return (
    <section className="metrics">
      {CARDS.map((card) => (
        <article key={card.key}>
          <small>
            {card.label}
            <span className="metric-hint">{card.hint}</span>
          </small>
          <strong>{metrics[card.key]}</strong>
        </article>
      ))}
    </section>
  );
}
