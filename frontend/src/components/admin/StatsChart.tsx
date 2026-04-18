import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const LINE_COLORS = ["#f97316", "#0b1220", "#0284c7", "#16a34a", "#7c3aed"];
const LABEL: Record<string, string> = {
  signup: "Регистрации",
  trip_created: "Поездки",
  message_sent: "Сообщения",
  trip_shared: "Поделились",
  page_view: "Просмотры",
};

interface Props {
  data: Array<Record<string, number | string>>;
  keys: string[];
}

export function StatsChart({ data, keys }: Props) {
  const safe = data.map((row) => {
    const copy: Record<string, number | string> = { ...row };
    for (const k of keys) if (copy[k] === undefined) copy[k] = 0;
    return copy;
  });

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={safe} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v) =>
              typeof v === "string" && v.length >= 10
                ? v.slice(5, 10).replace("-", ".")
                : String(v)
            }
            stroke="#d1d5db"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            stroke="#d1d5db"
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              fontSize: 12,
              boxShadow: "0 10px 30px -12px rgba(0,0,0,0.12)",
            }}
            formatter={(v, k) => [v as any, LABEL[k as string] ?? k]}
            labelFormatter={(l) => String(l).slice(0, 10)}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
            formatter={(v) => LABEL[String(v)] ?? v}
          />
          {keys.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
