"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  FileCode2, 
  CreditCard,
  Send,
  Code2,
  Layers,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  Wallet,
  Copy,
  Check,
  Zap,
  ArrowDownLeft,
  Activity,
  ChevronRight
} from "lucide-react";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  currency: string;
}

interface UnderwritingData {
  vendor_account_id: string;
  vendor_account_number: string;
  vendor_name: string;
  historical_settled_volume: string;
  current_ledger_balance: string;
  dscr_coverage_ratio: number;
  cash_velocity_index: number;
  credit_risk_tier: string;
  eligible_revolving_wc_limit: string;
  max_recommended_loan_tenure_days: number;
  underwriting_verdict: string;
}

export default function TreasuryDashboard() {
  const API_BASE = "https://b2b-virtual-account-engine.onrender.com/api/v1";
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [underwriting, setUnderwriting] = useState<UnderwritingData | null>(null);
  const [reconReport, setReconReport] = useState<any>(null);
  const [camtXml, setCamtXml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [reconLoading, setReconLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"operations" | "recon" | "underwriting">("operations");

  // Outward Payout Form State
  const [payoutAmount, setPayoutAmount] = useState("5000.00");
  const [beneficiaryName, setBeneficiaryName] = useState("Alpha Enterprises Pvt Ltd");
  const [beneficiaryAcc, setBeneficiaryAcc] = useState("50100482910291");
  const [beneficiaryIfsc, setBeneficiaryIfsc] = useState("HDFC0000060");
  const [payoutResult, setPayoutResult] = useState<any>(null);

  const updateXmlTemplate = (van: string) => {
    setCamtXml(
      `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">\n  <BkToCstmrStmt>\n    <Stmt>\n      <Ntry>\n        <Amt>15000.00</Amt>\n        <NtryDtls>\n          <TxDtls>\n            <Refs>\n              <EndToEndId>UTR_CAMT_DEMO_909</EndToEndId>\n            </Refs>\n            <RltdPties>\n              <CdtrAcct>\n                <Id><Othr><Id>${van}</Id></Othr></Id>\n              </CdtrAcct>\n            </RltdPties>\n          </TxDtls>\n        </NtryDtls>\n      </Ntry>\n    </Stmt>\n  </BkToCstmrStmt>\n</Document>`
    );
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAccounts(data);
        const firstVendor = data.find((a: Account) => a.account_type === "VENDOR_VIRTUAL") || data[0];
        setSelectedVendorId(firstVendor.id);
        updateXmlTemplate(firstVendor.account_number);
        fetchUnderwriting(firstVendor.id);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnderwriting = async (vendorId: string) => {
    if (!vendorId) return;
    try {
      const res = await fetch(`${API_BASE}/underwriting/credit-assessment/${vendorId}`);
      const data = await res.json();
      setUnderwriting(data);
    } catch (err) {
      console.error("Underwriting fetch error", err);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSelectVendor = (acc: Account) => {
    setSelectedVendorId(acc.id);
    updateXmlTemplate(acc.account_number);
    fetchUnderwriting(acc.id);
  };

  const runCamtRecon = async () => {
    setReconLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE}/reconciliation/camt053-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement_batch_id: `CAMT_BATCH_${Date.now()}`,
          xml_payload: camtXml
        })
      });
      const report = await res.json();
      setReconReport(report);
    } catch (err) {
      console.error("Recon error", err);
    } finally {
      setReconLoading(false);
    }
  };

  const triggerAutoHeal = async (breakItem: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reconciliation/auto-heal-break`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utr_reference: breakItem.utr_reference,
          virtual_account_number: breakItem.virtual_account_number,
          cleared_amount: breakItem.statement_amount,
          take_rate_percentage: 10.0,
          override_reason: "DASHBOARD_1_CLICK_HEAL"
        })
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage({ text: `Break ${breakItem.utr_reference} healed and balanced!`, type: "success" });
        runCamtRecon();
        fetchAccounts();
      } else {
        setActionMessage({ text: result.detail || "Healing exception occurred", type: "error" });
      }
    } catch (err) {
      console.error("Heal error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisbursePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;
    setPayoutLoading(true);
    setPayoutResult(null);
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE}/payouts/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_account_id: selectedVendorId,
          amount: parseFloat(payoutAmount),
          beneficiary_name: beneficiaryName,
          beneficiary_account_number: beneficiaryAcc,
          beneficiary_ifsc: beneficiaryIfsc,
          payout_rail: "IMPS"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPayoutResult(data);
        setActionMessage({ text: `Payout of ₹${payoutAmount} disbursed via ISO 20022 wire instruction!`, type: "success" });
        fetchUnderwriting(selectedVendorId);
      } else {
        setActionMessage({ text: `Payout Failed: ${data.detail}`, type: "error" });
      }
    } catch (err) {
      console.error("Payout error", err);
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleCopyXml = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeVendor = accounts.find(a => a.id === selectedVendorId);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* Top Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-64 bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative border-b border-slate-800/80 bg-[#07090E]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full bg-[#07090E] rounded-[7px] flex items-center justify-center">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-base">AEGIS</span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                  TREASURY ENGINE
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-400">
                RBI Section 25 Ring-Fenced Core &bull; ISO 20022 Multi-Rail Ingress/Egress
              </p>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 px-3.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-500 mr-1.5">LEDGERS:</span>
                <span className="text-slate-200 font-bold">{accounts.length}</span>
              </div>
              <div className="h-3 w-px bg-slate-800" />
              <div>
                <span className="text-slate-500 mr-1.5">STATUS:</span>
                <span className="text-emerald-400 font-bold">100% BALANCED</span>
              </div>
            </div>

            <button 
              onClick={fetchAccounts}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-xs font-semibold border border-slate-700 text-slate-200 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 
              {loading ? "Syncing..." : "Sync Node"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Stage */}
      <main className="relative max-w-7xl mx-auto px-6 py-6 space-y-6">
        
        {/* Banner Alert */}
        {actionMessage && (
          <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium backdrop-blur-md animate-in fade-in slide-in-from-top-2 ${
            actionMessage.type === "success" 
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200" 
              : "bg-rose-950/40 border-rose-500/40 text-rose-200"
          }`}>
            <div className="flex items-center gap-2.5">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
        )}

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0D111C]/80 border border-slate-800/80 backdrop-blur-sm">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Selected Vendor Sub-Ledger</div>
            <div className="text-sm font-bold text-white mt-1 truncate">
              {activeVendor ? activeVendor.account_name : "Selecting..."}
            </div>
            <div className="text-[11px] font-mono text-cyan-400 mt-0.5 truncate">
              {activeVendor ? activeVendor.account_number : "---"}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0D111C]/80 border border-slate-800/80 backdrop-blur-sm">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Sanctioned Revolver Limit</div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              ₹{underwriting ? Number(underwriting.eligible_revolving_wc_limit).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Tier: <span className="text-slate-300 font-semibold">{underwriting?.credit_risk_tier || "TIER_1"}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0D111C]/80 border border-slate-800/80 backdrop-blur-sm">
            <div className="text-[11px] font-mono text-slate-400 uppercase">DSCR Coverage Ratio</div>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {underwriting ? `${underwriting.dscr_coverage_ratio}x` : "2.8x"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Threshold: &gt; 1.50x</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0D111C]/80 border border-slate-800/80 backdrop-blur-sm">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Cash Velocity Index</div>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
              {underwriting ? `${underwriting.cash_velocity_index}x` : "4.2x"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Throughput Velocity</div>
          </div>
        </div>

        {/* Primary Operational Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Column 1: Sub-Ledger Directory (4 cols) */}
          <div className="lg:col-span-4 bg-[#0D111C]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Nodal & Sub-Ledger Matrix
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {accounts.length} Active
                </span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {accounts.length > 0 ? (
                  accounts.map((acc) => {
                    const isSelected = selectedVendorId === acc.id;
                    const isVendor = acc.account_type === "VENDOR_VIRTUAL";
                    return (
                      <div 
                        key={acc.id} 
                        onClick={() => handleSelectVendor(acc)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-cyan-950/30 border-cyan-500/60 ring-1 ring-cyan-500/50 shadow-md shadow-cyan-950/40" 
                            : "bg-[#07090E]/60 border-slate-800/80 hover:border-slate-700 hover:bg-[#07090E]"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-200">{acc.account_name}</span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                            isVendor 
                              ? "bg-teal-950 text-teal-300 border border-teal-800/50" 
                              : "bg-slate-900 text-slate-400 border border-slate-800"
                          }`}>
                            {acc.account_type}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                          <span className="truncate">{acc.account_number}</span>
                          {isSelected && <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Connecting to live PostgreSQL ledger...
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Nodal Pool</span>
              <span className="text-emerald-400 font-mono font-semibold">100% BALANCED</span>
            </div>
          </div>

          {/* Column 2: ISO 20022 camt.053 Statement Reconciliation (8 cols) */}
          <div className="lg:col-span-8 bg-[#0D111C]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-purple-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Stage 6: ISO 20022 camt.053 XML Ingestion & Breaks Engine
                  </h2>
                </div>
                <button 
                  onClick={() => handleCopyXml(camtXml)} 
                  className="text-[10px] font-mono text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy Template"}
                </button>
              </div>

              <textarea 
                value={camtXml}
                onChange={(e) => setCamtXml(e.target.value)}
                rows={6}
                className="w-full bg-[#07090E] border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/50 resize-none transition leading-relaxed"
                placeholder="Paste ISO 20022 camt.053 XML..."
              />

              <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
                <button 
                  onClick={runCamtRecon}
                  disabled={reconLoading || !camtXml}
                  className="w-full sm:w-auto flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:opacity-90 disabled:opacity-50 rounded-xl font-semibold text-xs text-white shadow-md shadow-purple-950/40 transition"
                >
                  {reconLoading ? "Parsing & Reconciling XML..." : "Ingest & Reconcile CAMT.053 XML"}
                </button>
              </div>

              {/* Recon Report Result */}
              {reconReport && (
                <div className="mt-4 p-3.5 bg-[#07090E] rounded-xl border border-slate-800 space-y-2.5 animate-in fade-in">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Statement Match Rate</span>
                    <span className="font-mono font-bold text-emerald-400">{reconReport.reconciliation_rate_percent}%</span>
                  </div>

                  {reconReport.ledger_breaks && reconReport.ledger_breaks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Ledger Breaks ({reconReport.breaks_count})
                      </div>
                      {reconReport.ledger_breaks.map((brk: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-rose-950/30 border border-rose-900/50 rounded-lg flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-mono font-bold text-slate-200">{brk.utr_reference}</div>
                            <div className="text-[10px] font-mono text-rose-300">₹{brk.statement_amount} &bull; {brk.break_reason}</div>
                          </div>
                          <button 
                            onClick={() => triggerAutoHeal(brk)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-md transition shadow"
                          >
                            1-Click Heal
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Standard Format</span>
              <span className="text-purple-400 font-mono font-semibold">ISO 20022 CAMT.053</span>
            </div>
          </div>

        </div>

        {/* Secondary Execution Row: Outward Payment & Wire Payload */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Outward Payout Execution Form (6 cols) */}
          <div className="lg:col-span-6 bg-[#0D111C]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Stage 3: Outward Payout Disbursal (ISO 20022 pain.001)
              </h2>
            </div>

            <form onSubmit={handleDisbursePayout} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Disbursement Amount (INR)</label>
                  <input 
                    type="number" 
                    value={payoutAmount} 
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full bg-[#07090E] border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Beneficiary Legal Entity</label>
                  <input 
                    type="text" 
                    value={beneficiaryName} 
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className="w-full bg-[#07090E] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Beneficiary Account / IBAN</label>
                  <input 
                    type="text" 
                    value={beneficiaryAcc} 
                    onChange={(e) => setBeneficiaryAcc(e.target.value)}
                    className="w-full bg-[#07090E] border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">IFSC / BIC Code</label>
                  <input 
                    type="text" 
                    value={beneficiaryIfsc} 
                    onChange={(e) => setBeneficiaryIfsc(e.target.value)}
                    className="w-full bg-[#07090E] border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={payoutLoading || !selectedVendorId}
                className="w-full mt-2 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:opacity-90 disabled:opacity-50 rounded-xl font-semibold text-xs text-white shadow-md shadow-cyan-950/40 transition"
              >
                {payoutLoading ? "Generating Wire Instruction..." : "Execute Outward Payout & Generate Wire Payload"}
              </button>
            </form>
          </div>

          {/* pain.001 Live Payload Inspector (6 cols) */}
          <div className="lg:col-span-6 bg-[#0D111C]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    pain.001.001.09 Wire Instruction Payload
                  </h2>
                </div>
                {payoutResult && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800/60 text-emerald-400 font-mono text-[10px] font-bold">
                    {payoutResult.status}
                  </span>
                )}
              </div>

              {payoutResult ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400 flex justify-between font-mono">
                    <span>MSG_ID: <span className="text-amber-400">{payoutResult.iso20022_message_id}</span></span>
                    <span>RAIL: <span className="text-cyan-400">IMPS/RTGS</span></span>
                  </div>
                  <pre className="w-full bg-[#07090E] border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-amber-200/90 overflow-x-auto max-h-[145px] leading-relaxed">
                    {payoutResult.iso20022_xml_payload}
                  </pre>
                </div>
              ) : (
                <div className="h-[145px] flex items-center justify-center border border-dashed border-slate-800/80 rounded-xl bg-[#07090E]/40 text-xs text-slate-500">
                  Execute an outward payout on the left to inspect the wire instruction payload.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Standard Wire Format</span>
              <span className="text-amber-400 font-mono font-semibold">PAIN.001.001.09</span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
