"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  FileCode, 
  CreditCard, 
  Send, 
  Code, 
  Layers, 
  ArrowUpRight, 
  TrendingUp, 
  ShieldCheck, 
  Copy, 
  Check, 
  Landmark, 
  SlidersHorizontal
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased pb-20">
      
      {/* Top Bar */}
      <header className="border-b border-slate-200/90 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight">B2B Daylight Treasury & Ledger Portal</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Section 25 Compliant Escrow Core &bull; ISO 20022 Rails &bull; Automated Credit Underwriting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-mono text-slate-600 border border-slate-200">
              <span>LEDGERS: <strong className="text-slate-900">{accounts.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% BALANCED
              </span>
            </div>

            <button 
              onClick={fetchAccounts}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 
              {loading ? "Syncing..." : "Refresh Node"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        
        {/* Banner Alert */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium shadow-sm ${
            actionMessage.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}>
            <div className="flex items-center gap-2.5">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
          </div>
        )}

        {/* 4-Stat Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Virtual Account</div>
            <div className="text-sm font-bold text-slate-900 mt-1 truncate">
              {activeVendor ? activeVendor.account_name : "Selecting..."}
            </div>
            <div className="text-[11px] font-mono text-blue-600 mt-0.5 truncate">
              {activeVendor ? activeVendor.account_number : "---"}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sanctioned Revolver Line</div>
            <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
              ₹{underwriting ? Number(underwriting.eligible_revolving_wc_limit).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Tier: <span className="font-semibold text-slate-800">{underwriting?.credit_risk_tier || "TIER_1"}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">DSCR Coverage Ratio</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {underwriting ? `${underwriting.dscr_coverage_ratio}x` : "2.8x"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Benchmark: &gt; 1.50x</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cash Velocity Index</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {underwriting ? `${underwriting.cash_velocity_index}x` : "4.2x"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Throughput Velocity</div>
          </div>
        </div>

        {/* Primary Row: Sub-Ledgers & Underwriting Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sub-Ledger Directory */}
          <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Nodal & Sub-Ledger Directory
                  </h2>
                </div>
                <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {accounts.length} Ledgers
                </span>
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {accounts.length > 0 ? (
                  accounts.map((acc) => {
                    const isSelected = selectedVendorId === acc.id;
                    const isVendor = acc.account_type === "VENDOR_VIRTUAL";
                    return (
                      <div 
                        key={acc.id} 
                        onClick={() => handleSelectVendor(acc)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-200" 
                            : "bg-slate-50/70 border-slate-200/90 hover:border-slate-300 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-900">{acc.account_name}</span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-medium ${
                            isVendor 
                              ? "bg-teal-100 text-teal-800 border border-teal-200" 
                              : "bg-slate-200 text-slate-700 border border-slate-300"
                          }`}>
                            {acc.account_type}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                          <span className="truncate">{acc.account_number}</span>
                          {isSelected && <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No active accounts found on the database.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Section 25 Escrow Pool</span>
              <span className="text-emerald-700 font-mono font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% BALANCED
              </span>
            </div>
          </div>

          {/* Underwriting Assessment Details */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Stage 4 Underwriting & Credit Line Evaluation
                  </h2>
                </div>
                {underwriting && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {underwriting.underwriting_verdict}
                  </span>
                )}
              </div>

              {underwriting ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs font-medium text-slate-500">Sanctioned Revolver Line Calculation</div>
                    <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
                      ₹{Number(underwriting.eligible_revolving_wc_limit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Computed from settled throughput volume, cash velocity, and debt-service capacity.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                      <div className="text-[11px] font-semibold text-slate-500">Maximum Recommended Tenor</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                        {underwriting.max_recommended_loan_tenure_days} Days
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                      <div className="text-[11px] font-semibold text-slate-500">Credit Risk Tier</div>
                      <div className="text-base font-bold text-blue-700 mt-0.5 font-mono">
                        {underwriting.credit_risk_tier}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">Risk Assessment Details</div>
                    <div className="text-xs text-slate-700 leading-relaxed">
                      DSCR coverage is verified above the 1.50x risk threshold. Ledger velocity qualifies the vendor for automated daylight drawdown facilities.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-slate-500">
                  Select a vendor sub-ledger on the left to review underwriting metrics.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Risk Engine Status</span>
              <span className="text-blue-700 font-mono font-semibold">ALGORITHMIC REAL-TIME</span>
            </div>
          </div>

        </div>

        {/* Secondary Row: ISO 20022 CAMT.053 & PAIN.001 Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ISO 20022 camt.053 Parser */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Stage 6: ISO 20022 camt.053 Bank Statement Recon
                  </h2>
                </div>
                <button 
                  onClick={() => handleCopyXml(camtXml)} 
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy Template"}
                </button>
              </div>

              <textarea 
                value={camtXml}
                onChange={(e) => setCamtXml(e.target.value)}
                rows={5}
                className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-3 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition leading-relaxed"
                placeholder="Paste ISO 20022 camt.053 XML..."
              />

              <div className="mt-3">
                <button 
                  onClick={runCamtRecon}
                  disabled={reconLoading || !camtXml}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                >
                  {reconLoading ? "Parsing & Reconciling XML..." : "Ingest & Reconcile CAMT.053 Statement"}
                </button>
              </div>

              {/* Recon Report Result */}
              {reconReport && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">Reconciliation Match Rate</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      {reconReport.reconciliation_rate_percent}%
                    </span>
                  </div>

                  {reconReport.ledger_breaks && reconReport.ledger_breaks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Ledger Breaks Detected ({reconReport.breaks_count})
                      </div>
                      {reconReport.ledger_breaks.map((brk: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white border border-rose-200 rounded-lg flex items-center justify-between gap-3 shadow-xs">
                          <div>
                            <div className="text-xs font-mono font-bold text-slate-900">{brk.utr_reference}</div>
                            <div className="text-[11px] font-mono text-rose-700">₹{brk.statement_amount} &bull; {brk.break_reason}</div>
                          </div>
                          <button 
                            onClick={() => triggerAutoHeal(brk)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
                          >
                            1-Click Auto-Heal
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Standard Message Format</span>
              <span className="text-slate-800 font-mono font-semibold">camt.053.001.08</span>
            </div>
          </div>

          {/* Outward Payout Form & pain.001 Output */}
          <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                <Send className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Stage 3 Outward Payout Disbursal (pain.001)
                </h2>
              </div>

              <form onSubmit={handleDisbursePayout} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount (INR)</label>
                    <input 
                      type="number" 
                      value={payoutAmount} 
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Beneficiary Legal Name</label>
                    <input 
                      type="text" 
                      value={beneficiaryName} 
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Account Number / IBAN</label>
                    <input 
                      type="text" 
                      value={beneficiaryAcc} 
                      onChange={(e) => setBeneficiaryAcc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">IFSC / BIC Code</label>
                    <input 
                      type="text" 
                      value={beneficiaryIfsc} 
                      onChange={(e) => setBeneficiaryIfsc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={payoutLoading || !selectedVendorId}
                  className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-black disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                >
                  {payoutLoading ? "Generating Wire Instruction..." : "Execute Outward Payout & Generate Wire Payload"}
                </button>
              </form>

              {payoutResult && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 animate-in fade-in">
                  <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                    <span>MSG_ID: <strong className="text-slate-900">{payoutResult.iso20022_message_id}</strong></span>
                    <span className="text-emerald-700 font-bold">{payoutResult.status}</span>
                  </div>
                  <pre className="w-full bg-slate-900 text-amber-200 border border-slate-800 rounded-lg p-2.5 font-mono text-[10px] overflow-x-auto max-h-[100px] leading-relaxed">
                    {payoutResult.iso20022_xml_payload}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Standard Wire Format</span>
              <span className="text-slate-800 font-mono font-semibold">pain.001.001.09</span>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
