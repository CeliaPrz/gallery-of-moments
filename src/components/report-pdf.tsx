import { Document, Font, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff?url";
import manrope700 from "@fontsource/manrope/files/manrope-latin-700-normal.woff?url";

import type { ReportContent } from "@/lib/reports.functions";
import { formatDate, formatMillions, formatYield } from "@/lib/format";

Font.register({ family: "Inter", fonts: [{ src: inter400 }, { src: inter600, fontWeight: 600 }] });
Font.register({ family: "Manrope", fonts: [{ src: manrope700, fontWeight: 700 }] });

const GREEN = "#2E4738";
const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9.5, color: "#1E2B24", padding: 40, paddingBottom: 60 },
  h1: { fontFamily: "Manrope", fontWeight: 700, fontSize: 20, color: GREEN },
  h2: { fontFamily: "Manrope", fontWeight: 700, fontSize: 13, color: GREEN, marginTop: 18, marginBottom: 6 },
  muted: { color: "#6B645A" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#DCE5DA", paddingVertical: 3 },
  label: { width: "45%", color: "#6B645A" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#6B645A" },
});

function Line({ label, value }: { label: string; value: string }) {
  return <View style={s.row}><Text style={s.label}>{label}</Text><Text>{value}</Text></View>;
}

function ReportDocument({ c, validatedAt }: { c: ReportContent; validatedAt: string }) {
  const p = c.portfolio;
  return (
    <Document title={`Rapport trimestriel ${c.report.periodLabel} — ${c.investorName}`}>
      <Page size="A4" style={s.page}>
        <View fixed style={s.footer}>
          <Text>Confidentiel — préparé pour {c.investorName} — {formatDate(validatedAt)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
        <Text style={s.h1}>Rapport trimestriel {c.report.periodLabel}</Text>
        <Text style={s.muted}>{c.investorName}{c.report.version > 1 ? ` · version ${c.report.version}` : ""}</Text>

        <Text style={s.h2}>Synthèse du portefeuille</Text>
        <Line label="Valeur" value={formatMillions(p?.totalValue, 1)} />
        <Line label="Loyers annuels" value={formatMillions(p?.totalAnnualRent, 2)} />
        <Line label="Taux d'occupation" value={formatYield(p?.occupancyRate)} />
        <Line label="LTV du portefeuille" value={formatYield(p?.portfolioLtv)} />
        <Line label="Données au" value={formatDate(p?.latestDataDate)} />

        {c.report.commentary ? (<>
          <Text style={s.h2}>Commentaire de gestion</Text>
          {c.report.commentary.split(/\n\s*\n/).map((para, i) => <Text key={i} style={{ marginBottom: 6, lineHeight: 1.4 }}>{para}</Text>)}
        </>) : null}

        {c.assets.map((a) => (
          <View key={a.assetId} wrap={false}>
            <Text style={s.h2}>{a.name}{a.city ? ` · ${a.city}` : ""}</Text>
            <Line label="Valeur" value={formatMillions(a.marketValue, 1)} />
            <Line label="Loyer annuel" value={formatMillions(a.annualRent, 2)} />
            <Line label="Occupation" value={formatYield(a.occupancyRate)} />
            <Line label="LTV" value={formatYield(a.ltv)} />
            {a.loans.map((l, i) => <Line key={i} label={`Encours · ${l.lender}`} value={formatMillions(l.outstanding, 1)} />)}
            {a.leaseEvents.map((e, i) => <Line key={i} label={`Bail · ${e.tenantName}`} value={`Fin ${formatDate(e.endDate)} · Option ${formatDate(e.breakDate)}`} />)}
            {a.bp && <Line label={`BP en vigueur · ${a.bp.versionLabel}`} value={`Rendement initial ${formatYield(a.bp.initialYield)} · TRI cible ${formatYield(a.bp.targetIrr)}`} />}
          </View>
        ))}

        {c.alerts.length > 0 && (<>
          <Text style={s.h2}>Alertes en cours</Text>
          {c.alerts.map((al, i) => <Text key={i} style={{ marginBottom: 2 }}>• {alertText(al)}</Text>)}
        </>)}

        <Text style={s.h2}>Sources</Text>
        {c.sources.map((src, i) => <Text key={i} style={s.muted}>Source : {src.fileName} · {src.templateVersion} · importé le {formatDate(src.importedAt)}</Text>)}
      </Page>
    </Document>
  );
}

export function alertText(a: ReportContent["alerts"][number]): string {
  if (a.kind === "bail") return `${a.assetName} — ${a.tenantName} : ${a.event === "sortie" ? "option de sortie" : "échéance"} le ${formatDate(a.date)}`;
  if (a.kind === "financement") return `${a.assetName} — LTV ${formatYield(a.ltv)} pour un covenant de ${formatYield(a.covenant)}`;
  return `${a.assetName} — lot ${a.label} vacant depuis ${a.months} mois`;
}

export async function renderReportPdf(c: ReportContent, validatedAt: string): Promise<Blob> {
  return pdf(<ReportDocument c={c} validatedAt={validatedAt} />).toBlob();
}
